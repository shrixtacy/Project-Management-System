import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v2 as cloudinary } from 'cloudinary';
import { createClient } from '@supabase/supabase-js';
import { IncomingForm, File as FormidableFile } from 'formidable';
import { readFileSync } from 'fs';
import path from 'path';
import axios from 'axios';
import { PassThrough } from 'stream';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function verifyAdmin(req: VercelRequest): Promise<boolean> {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return false;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return false;
  const { data: userData } = await supabaseAdmin.from('users').select('role').eq('id', user.id).single();
  return !!(userData && userData.role === 'ADMIN');
}

function parseMultipartForm(req: VercelRequest): Promise<{ fields: any; files: any }> {
  return new Promise((resolve, reject) => {
    const form = new IncomingForm({ keepExtensions: true, maxFileSize: 50 * 1024 * 1024 });
    form.parse(req as any, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url!, `http://${req.headers.host}`);
  const subPath = url.pathname.replace('/api/upload', '').replace(/^\//, '');

  // ─── POST /api/upload (file upload to Cloudinary) ───
  if (req.method === 'POST' && (!subPath || subPath === '')) {
    try {
      const { files } = await parseMultipartForm(req);
      const fileField = files.file;
      const file: FormidableFile = Array.isArray(fileField) ? fileField[0] : fileField;

      if (!file) return res.status(400).json({ error: 'No file provided' });

      const originalName = file.originalFilename || 'upload';
      const ext = path.extname(originalName);
      const baseName = path.basename(originalName, ext);
      const randomId = Math.random().toString(36).substring(2, 10);
      const publicId = `${randomId}_${baseName.replace(/[^a-zA-Z0-9_-]/g, '_')}${ext}`;

      const buffer = readFileSync(file.filepath);

      const result: any = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'pms_deliverables', resource_type: 'raw', public_id: publicId, type: 'upload', access_mode: 'public' },
          (error, result) => { if (result) resolve(result); else reject(error); }
        );
        const passThrough = new PassThrough();
        passThrough.end(buffer);
        passThrough.pipe(stream);
      });

      return res.status(200).json({
        message: 'Upload successful',
        url: result.secure_url,
        publicId: result.public_id,
        format: ext.replace('.', '') || 'unknown',
        resourceType: 'raw',
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Error uploading file' });
    }
  }

  // ─── GET /api/upload/proxy-download ───
  if (req.method === 'GET' && subPath === 'proxy-download') {
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
              resource_type: 'raw', type: 'upload',
              expires_at: Math.floor(Date.now() / 1000) + 60,
            });
          }
        } catch (e: any) {
          console.warn('Signed URL generation failed, using original:', e.message);
        }
      }

      const response = await axios.get(fetchUrl, {
        responseType: 'arraybuffer', maxRedirects: 10, timeout: 30000,
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
      return res.send(buffer);
    } catch (error: any) {
      if (error.response) {
        const statusCode = error.response.status >= 400 ? error.response.status : 502;
        return res.status(statusCode).json({ error: `Storage error: ${error.response.status}` });
      }
      return res.status(500).json({ error: error.message });
    }
  }

  // ─── GET /api/upload/signature ───
  if (req.method === 'GET' && subPath === 'signature') {
    try {
      const timestamp = Math.round(Date.now() / 1000);
      const signature = cloudinary.utils.api_sign_request(
        { timestamp, folder: 'pms_deliverables' },
        process.env.CLOUDINARY_API_SECRET!
      );
      return res.status(200).json({ timestamp, signature });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  // ─── POST /api/upload/delete-files ───
  if (req.method === 'POST' && subPath === 'delete-files') {
    try {
      const { urls } = req.body;
      if (!urls || urls.length === 0) return res.status(200).json({ message: 'No URLs' });

      const rawIds: string[] = [];
      const others: string[] = [];

      for (const fileUrl of urls) {
        if (!fileUrl.includes('cloudinary.com')) continue;
        const parts = fileUrl.split('/');
        const type = parts.length > 4 ? parts[4] : 'image';
        const file = parts.pop() || '';
        const folder = parts.pop() || '';
        const pid = `${folder}/${file}`;
        if (type === 'raw') rawIds.push(pid);
        else others.push(pid.split('.')[0]);
      }

      if (rawIds.length > 0) await cloudinary.api.delete_resources(rawIds, { resource_type: 'raw' });
      if (others.length > 0) await cloudinary.api.delete_resources(others);

      return res.status(200).json({ message: 'Deleted' });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  // ─── DELETE /api/upload/delete-project ───
  if (req.method === 'DELETE' && subPath === 'delete-project') {
    const isAdmin = await verifyAdmin(req);
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    try {
      const { projectId } = req.body;
      if (!projectId) return res.status(400).json({ error: 'Missing projectId' });

      const { error } = await supabaseAdmin.from('projects').delete().eq('id', projectId);
      if (error) return res.status(500).json({ error: error.message });

      return res.status(200).json({ message: 'Project deleted' });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(404).json({ error: 'Not found' });
}
