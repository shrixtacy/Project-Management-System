import express from 'express';
import cors from 'cors';
import serverless from 'serverless-http';
import { createClient } from '@supabase/supabase-js';
import type { Request, Response, NextFunction } from 'express';

const app = express();
app.use(cors());
app.use(express.json());

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' });

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid Token' });

  const { data: userData, error: dbError } = await supabaseAdmin
    .from('users').select('role').eq('id', user.id).single();

  if (dbError || !userData || userData.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden. Requires ADMIN role.' });
  }
  next();
};

app.post('/api/auth/create-user', requireAdmin, async (req, res) => {
  try {
    const { email, password, name, role } = req.body;
    if (!email || !password || !name || !role)
      return res.status(400).json({ error: 'Missing required fields' });
    if (!['DESIGNER', 'OPERATIONS'].includes(role))
      return res.status(400).json({ error: 'Invalid role' });

    const { data, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { name, role }
    });
    if (authError) throw authError;

    const { error: dbError } = await supabaseAdmin.from('users').insert({
      id: data.user.id, name, email, role, is_active: true
    });
    if (dbError && dbError.code !== '23505') console.error('Failed to insert user:', dbError);

    res.status(201).json({ message: 'User created successfully', user: data.user });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

app.delete('/api/auth/delete-user/:id', requireAdmin, async (req, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) return res.status(400).json({ error: 'Missing user ID' });

    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (error) throw error;

    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error: any) {
    if (error.code === '23503')
      return res.status(400).json({ error: 'Cannot delete user: They are assigned to one or more projects.' });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

app.delete('/api/auth/delete-project/:id', requireAdmin, async (req, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) return res.status(400).json({ error: 'Missing project ID' });

    // Fetch deliverable URLs before cascade-delete wipes them
    const { data: stages } = await supabaseAdmin.from('design_stages').select('id').eq('project_id', id);
    let cloudinaryUrls: string[] = [];
    if (stages && stages.length > 0) {
      const stageIds = stages.map((s: any) => s.id);
      const { data: deliverables } = await supabaseAdmin
        .from('deliverables').select('file_url').in('stage_id', stageIds);
      if (deliverables) {
        cloudinaryUrls = deliverables
          .map((d: any) => d.file_url)
          .filter((url: string) => url.includes('cloudinary.com'));
      }
    }

    // Delete project — service role bypasses RLS, CASCADE handles child rows
    const { error } = await supabaseAdmin.from('projects').delete().eq('id', id);
    if (error) throw error;

    // Best-effort Cloudinary cleanup
    if (cloudinaryUrls.length > 0) {
      const rawIds: string[] = [];
      for (const url of cloudinaryUrls) {
        try {
          const parts = url.split('/');
          const uploadIdx = parts.findIndex((p: string) => p === 'upload');
          if (uploadIdx !== -1) {
            // skip version segment (v1234567)
            const afterUpload = parts.slice(uploadIdx + 1).filter((p: string) => !/^v\d+$/.test(p));
            rawIds.push(afterUpload.join('/'));
          }
        } catch (_) {}
      }
      if (rawIds.length > 0) {
        try {
          const { v2: cloudinary } = await import('cloudinary');
          cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
          });
          await cloudinary.api.delete_resources(rawIds, { resource_type: 'raw' });
        } catch (cErr: any) {
          console.warn('Cloudinary cleanup failed (non-critical):', cErr.message);
        }
      }
    }

    res.status(200).json({ message: 'Project deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default serverless(app);
