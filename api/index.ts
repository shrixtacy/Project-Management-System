import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { v2 as cloudinary } from 'cloudinary';
import path from 'path';

// ── Supabase admin client ────────────────────────────────────────────────────
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

// ── Helpers ──────────────────────────────────────────────────────────────────
async function verifyAdmin(req: VercelRequest): Promise<string | null> {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return 'Missing token';

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return 'Invalid token';

  const { data: userData } = await supabaseAdmin
    .from('users').select('role').eq('id', user.id).single();
  if (!userData || userData.role !== 'ADMIN') return 'Forbidden';

  return null; // null = no error = admin verified
}

// ── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = req.url || '';
  const method = req.method || 'GET';

  // Health check
  if (url.includes('/api/health')) {
    return res.json({
      status: 'ok',
      env: {
        hasSupabase:   !!process.env.SUPABASE_URL,
        hasCloudinary: !!process.env.CLOUDINARY_CLOUD_NAME,
      },
    });
  }

  // ── POST /api/auth/create-user ─────────────────────────────────────────────
  if (method === 'POST' && url.includes('/api/auth/create-user')) {
    const authErr = await verifyAdmin(req);
    if (authErr) return res.status(authErr === 'Forbidden' ? 403 : 401).json({ error: authErr });

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

      return res.status(201).json({ message: 'User created successfully', user: data.user });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Internal server error' });
    }
  }

  // ── GET /api/upload/signature ──────────────────────────────────────────────
  if (method === 'GET' && url.includes('/api/upload/signature')) {
    try {
      const { CLOUDINARY_API_SECRET: apiSecret, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_CLOUD_NAME: cloudName } = process.env;
      if (!apiSecret || !apiKey || !cloudName)
        return res.status(500).json({ error: 'Cloudinary env vars missing on server' });

      const timestamp = Math.round(Date.now() / 1000);
      const signature = cloudinary.utils.api_sign_request(
        { timestamp, folder: 'pms_deliverables' }, apiSecret
      );
      return res.json({ timestamp, signature, cloudName, apiKey });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── GET /api/upload/proxy-download ────────────────────────────────────────
  if (method === 'GET' && url.includes('/api/upload/proxy-download')) {
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

      res.setHeader('Location', fetchUrl);
      return res.status(302).end();
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST /api/upload/delete-files ─────────────────────────────────────────
  if (method === 'POST' && url.includes('/api/upload/delete-files')) {
    try {
      const { urls } = req.body;
      if (!urls || urls.length === 0) return res.json({ message: 'No URLs' });

      const rawIds: string[] = [];
      for (const u of urls) {
        if (!u.includes('cloudinary.com')) continue;
        const parts = u.split('/');
        const uploadIdx = parts.findIndex((p: string) => p === 'upload');
        if (uploadIdx !== -1) {
          const afterUpload = parts.slice(uploadIdx + 1).filter((p: string) => !/^v\d+$/.test(p));
          rawIds.push(afterUpload.join('/'));
        }
      }

      if (rawIds.length > 0)
        await cloudinary.api.delete_resources(rawIds, { resource_type: 'raw' });

      return res.json({ message: 'Deleted' });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(404).json({ error: 'Route not found', path: url });
}
