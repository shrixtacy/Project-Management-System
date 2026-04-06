import express from 'express';
import cors from 'cors';
import serverless from 'serverless-http';
import { createClient } from '@supabase/supabase-js';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import axios from 'axios';
import path from 'path';
import { PassThrough } from 'stream';
import type { Request, Response, NextFunction } from 'express';

const app = express();
app.use(cors());
app.use(express.json());

// ── Supabase admin client (service role — bypasses RLS) ──────────────────────
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ── Cloudinary ───────────────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── Auth middleware ──────────────────────────────────────────────────────────
const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Missing token' });

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid token' });

  const { data: userData } = await supabaseAdmin
    .from('users').select('role').eq('id', user.id).single();
  if (!userData || userData.role !== 'ADMIN')
    return res.status(403).json({ error: 'Forbidden' });

  next();
};

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    env: {
      hasSupabase:   !!process.env.SUPABASE_URL,
      hasCloudinary: !!process.env.CLOUDINARY_CLOUD_NAME,
    },
  });
});

// ════════════════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ════════════════════════════════════════════════════════════════════════════

// POST /api/auth/create-user
app.post('/api/auth/create-user', requireAdmin, async (req, res) => {
  try {
    const { email, password, name, role } = req.body;
    if (!email || !password || !name || !role)
      return res.status(400).json({ error: 'Missing required fields' });
    if (!['DESIGNER', 'OPERATIONS', 'ADMIN'].includes(role))
      return res.status(400).json({ error: 'Invalid role' });

    const { data, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { name, role },
    });
    if (authError) throw authError;

    const { error: dbError } = await supabaseAdmin.from('users').insert({
      id: data.user.id, name, email, role, is_active: true,
    });
    if (dbError && dbError.code !== '23505')
      console.error('Failed to insert into public.users:', dbError);

    res.status(201).json({ message: 'User created successfully', user: data.user });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// UPLOAD ROUTES
// ════════════════════════════════════════════════════════════════════════════

// GET /api/upload/signature
app.get('/api/upload/signature', (req, res) => {
  try {
    const { CLOUDINARY_API_SECRET: apiSecret, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_CLOUD_NAME: cloudName } = process.env;
    if (!apiSecret || !apiKey || !cloudName)
      return res.status(500).json({ error: 'Cloudinary env vars missing on server' });

    const timestamp = Math.round(Date.now() / 1000);
    const signature = cloudinary.utils.api_sign_request(
      { timestamp, folder: 'pms_deliverables' }, apiSecret
    );
    res.json({ timestamp, signature, cloudName, apiKey });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/upload/proxy-download
app.get('/api/upload/proxy-download', async (req, res) => {
  try {
    const fileUrl = req.query.url as string;
    const fileName = (req.query.name as string) || 'download';
    if (!fileUrl) return res.status(400).json({ error: 'Missing url' });

    const ext = path.extname(fileName).toLowerCase();

    let fetchUrl = fileUrl;
    if (fileUrl.includes('cloudinary.com') && fileUrl.includes('/raw/upload/')) {
      try {
        const parts = new URL(fileUrl).pathname.split('/raw/upload/');
        if (parts.length === 2) {
          const publicId = parts[1].replace(/^v\d+\//, '');
          fetchUrl = cloudinary.utils.private_download_url(publicId, ext.replace('.', '') || 'pdf', {
            resource_type: 'raw', type: 'upload',
            expires_at: Math.floor(Date.now() / 1000) + 60,
          });
        }
      } catch (e: any) {
        console.warn('Signed URL failed, using original:', e.message);
      }
    }

    return res.redirect(302, fetchUrl);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/upload/delete-files
app.post('/api/upload/delete-files', async (req, res) => {
  try {
    const { urls } = req.body;
    if (!urls || urls.length === 0) return res.status(200).json({ message: 'No URLs' });

    const rawIds: string[] = [];
    for (const url of urls) {
      if (!url.includes('cloudinary.com')) continue;
      const parts = url.split('/');
      const uploadIdx = parts.findIndex((p: string) => p === 'upload');
      if (uploadIdx !== -1) {
        const afterUpload = parts.slice(uploadIdx + 1).filter((p: string) => !/^v\d+$/.test(p));
        rawIds.push(afterUpload.join('/'));
      }
    }

    if (rawIds.length > 0)
      await cloudinary.api.delete_resources(rawIds, { resource_type: 'raw' });

    res.json({ message: 'Deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default serverless(app);
