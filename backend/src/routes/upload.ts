import { Router } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import dotenv from 'dotenv';
import path from 'path';
import { Readable, PassThrough } from 'stream';
import axios from 'axios';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const router = Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const upload = multer({ storage: multer.memoryStorage() });

router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      console.error('Backend: No file in req.file');
      return res.status(400).json({ error: 'No file provided' });
    }

    console.log(`Backend: Received file "${req.file.originalname}", size: ${req.file.buffer.length} bytes`);
    
    const originalName = req.file.originalname;
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);
    const randomId = Math.random().toString(36).substring(2, 10);
    const publicId = `${randomId}_${baseName.replace(/[^a-zA-Z0-9_-]/g, '_')}${ext}`;

    const streamUpload = (buffer: Buffer) => {
        return new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                {
                    folder: 'pms_deliverables',
                    resource_type: 'raw',
                    public_id: publicId,
                    type: 'upload',
                    access_mode: 'public'
                },
                (error, result) => {
                    if (result) resolve(result);
                    else reject(error);
                }
            );
            
            const passThrough = new PassThrough();
            passThrough.end(buffer);
            passThrough.pipe(stream);
        });
    };

    const result: any = await streamUpload(req.file.buffer);
    console.log('Backend: Cloudinary upload successful:', result.secure_url);

    res.status(200).json({
      message: 'Upload successful',
      url: result.secure_url,
      publicId: result.public_id,
      format: ext.replace('.', '') || 'unknown',
      resourceType: 'raw'
    });
  } catch (error: any) {
    console.error('Backend: Upload exception:', error);
    res.status(500).json({ error: error.message || 'Error uploading file' });
  }
});

router.get('/proxy-download', async (req, res) => {
  try {
    const fileUrl = req.query.url as string;
    const fileName = (req.query.name as string) || 'download';

    if (!fileUrl) return res.status(400).json({ error: 'Missing url' });

    console.log(`Backend: Proxying download for ${fileUrl}`);

    const ext = path.extname(fileName).toLowerCase();
    const extToMime: Record<string, string> = {
      '.pdf':  'application/pdf',
      '.png':  'image/png',
      '.jpg':  'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif':  'image/gif',
      '.webp': 'image/webp',
      '.svg':  'image/svg+xml',
      '.zip':  'application/zip',
      '.dwg':  'application/acad',
      '.dxf':  'application/dxf',
    };

    let fetchUrl = fileUrl;

    if (fileUrl.includes('cloudinary.com') && fileUrl.includes('/raw/upload/')) {
      try {
        const urlObj = new URL(fileUrl);
        const parts = urlObj.pathname.split('/raw/upload/');
        if (parts.length === 2) {
          const withoutVersion = parts[1].replace(/^v\d+\//, '');
          const publicId = withoutVersion;
          console.log(`Backend: Fetching raw asset via Admin API for public_id: ${publicId}`);

          fetchUrl = cloudinary.utils.private_download_url(publicId, ext.replace('.', '') || 'pdf', {
            resource_type: 'raw',
            type: 'upload',
            expires_at: Math.floor(Date.now() / 1000) + 60, // valid for 60 seconds
          });
          console.log(`Backend: Using private_download_url: ${fetchUrl}`);
        }
      } catch (signErr: any) {
        console.warn('Backend: Admin API approach failed, falling back to original URL:', signErr.message);
        fetchUrl = fileUrl;
      }
    }

    // Bypass Vercel Edge Serverless 4.5MB limits by redirecting the client to Cloudinary directly!
    return res.redirect(302, fetchUrl);
  } catch (error: any) {
    console.error('Backend: Proxy catch:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/signature', (req, res) => {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const signature = cloudinary.utils.api_sign_request(
      { timestamp, folder: 'pms_deliverables' },
      process.env.CLOUDINARY_API_SECRET!
    );
    res.status(200).json({ 
      timestamp, 
      signature,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/delete-files', async (req, res) => {
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

export default router;
