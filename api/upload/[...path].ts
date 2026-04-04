import express from 'express';
import cors from 'cors';
import serverless from 'serverless-http';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import axios from 'axios';
import path from 'path';
import { PassThrough } from 'stream';
import { createClient } from '@supabase/supabase-js';

const app = express();
app.use(cors());
app.use(express.json());

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Service role client — bypasses RLS for admin operations
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Middleware: verify the caller is an authenticated ADMIN
const requireAdmin = async (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Missing token' });
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid token' });
  const { data: userData } = await supabaseAdmin.from('users').select('role').eq('id', user.id).single();
  if (!userData || userData.role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });
  next();
};

const upload = multer({ storage: multer.memoryStorage() });

// POST /api/upload — upload file to Cloudinary
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const originalName = req.file.originalname;
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);
    const randomId = Math.random().toString(36).substring(2, 10);
    const publicId = `${randomId}_${baseName.replace(/[^a-zA-Z0-9_-]/g, '_')}${ext}`;

    const result: any = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'pms_deliverables', resource_type: 'raw', public_id: publicId, type: 'upload', access_mode: 'public' },
        (error, result) => { if (result) resolve(result); else reject(error); }
      );
      const passThrough = new PassThrough();
      passThrough.end(req.file!.buffer);
      passThrough.pipe(stream);
    });

    res.status(200).json({
      message: 'Upload successful',
      url: result.secure_url,
      publicId: result.public_id,
      format: ext.replace('.', '') || 'unknown',
      resourceType: 'raw',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error uploading file' });
  }
});

// GET /api/upload/proxy-download — proxy download with signed URL for raw files
app.get('/api/upload/proxy-download', async (req, res) => {
  try {
    const fileUrl = req.query.url as string;
    const fileName = (req.query.name as string) || 'download';
    if (!fileUrl) return res.status(400).json({ error: 'Missing url' });

    const ext = path.extname(fileName).toLowerCase();
    const extToMime: Record<string, string> = {
      '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
      '.svg': 'image/svg+xml', '.zip': 'application/zip',
      '.dwg': 'application/acad', '.dxf': 'application/dxf',
    };

    let fetchUrl = fileUrl;

    if (fileUrl.includes('cloudinary.com') && fileUrl.includes('/raw/upload/')) {
      try {
        const urlObj = new URL(fileUrl);
        const parts = urlObj.pathname.split('/raw/upload/');
        if (parts.length === 2) {
          const publicId = parts[1].replace(/^v\d+\//, '');
          fetchUrl = cloudinary.utils.private_download_url(publicId, ext.replace('.', '') || 'pdf', {
            resource_type: 'raw',
            type: 'upload',
            expires_at: Math.floor(Date.now() / 1000) + 60,
          });
        }
      } catch (e: any) {
        console.warn('Signed URL generation failed, using original:', e.message);
      }
    }

    const response = await axios.get(fetchUrl, {
      responseType: 'arraybuffer',
      maxRedirects: 10,
      timeout: 30000,
      headers: { 'Accept': '*/*', 'User-Agent': 'Mozilla/5.0' },
    });

    const buffer = Buffer.from(response.data);
    let contentType = response.headers['content-type'] || 'application/octet-stream';
    if (contentType.startsWith('text/plain') || contentType === 'application/octet-stream') {
      contentType = extToMime[ext] || 'application/octet-stream';
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (error: any) {
    if (error.response) {
      const statusCode = error.response.status >= 400 ? error.response.status : 502;
      return res.status(statusCode).json({ error: `Storage error: ${error.response.status}` });
    }
    res.status(500).json({ error: error.message });
  }
});

// GET /api/upload/signature — Cloudinary signature
app.get('/api/upload/signature', (req, res) => {
  try {
    const timestamp = Math.round(Date.now() / 1000);
    const signature = cloudinary.utils.api_sign_request(
      { timestamp, folder: 'pms_deliverables' },
      process.env.CLOUDINARY_API_SECRET!
    );
    res.status(200).json({ timestamp, signature });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/upload/delete-files — delete Cloudinary files
app.post('/api/upload/delete-files', async (req, res) => {
  try {
    const { urls } = req.body;
    if (!urls || urls.length === 0) return res.status(200).json({ message: 'No URLs' });

    const rawIds: string[] = [];
    const others: string[] = [];

    for (const url of urls) {
      if (!url.includes('cloudinary.com')) continue;
      const parts = url.split('/');
      const type = parts.length > 4 ? parts[4] : 'image';
      const file = parts.pop() || '';
      const folder = parts.pop() || '';
      const pid = `${folder}/${file}`;
      if (type === 'raw') rawIds.push(pid);
      else others.push(pid.split('.')[0]);
    }

    if (rawIds.length > 0) await cloudinary.api.delete_resources(rawIds, { resource_type: 'raw' });
    if (others.length > 0) await cloudinary.api.delete_resources(others);

    res.status(200).json({ message: 'Deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/upload/delete-project — delete project using service role (bypasses RLS)
app.delete('/api/upload/delete-project', requireAdmin, async (req, res) => {
  try {
    const { projectId } = req.body;
    if (!projectId) return res.status(400).json({ error: 'Missing projectId' });

    const { error } = await supabaseAdmin.from('projects').delete().eq('id', projectId);
    if (error) return res.status(500).json({ error: error.message });

    res.status(200).json({ message: 'Project deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

const handler = serverless(app);
export default handler;

// Vercel-specific: disable body parsing so multer can handle multipart uploads
export const config = {
  api: {
    bodyParser: false,
  },
};
