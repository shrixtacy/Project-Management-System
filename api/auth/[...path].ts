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

app.delete('/api/auth/delete-project/:id', async (req: Request, res: Response) => {
  try {
    // Inline auth check — faster than middleware, single call
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Missing token' });

    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });

    // Check role directly from JWT metadata to avoid extra DB call
    const role = user.user_metadata?.role || user.app_metadata?.role;
    if (role !== 'ADMIN') {
      // Fallback: check DB (only if metadata doesn't have role)
      const { data: userData } = await supabaseAdmin
        .from('users').select('role').eq('id', user.id).single();
      if (!userData || userData.role !== 'ADMIN')
        return res.status(403).json({ error: 'Forbidden' });
    }

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) return res.status(400).json({ error: 'Missing project ID' });

    // Fetch Cloudinary URLs before delete (non-blocking — run in parallel with nothing)
    const stagesPromise = supabaseAdmin
      .from('design_stages').select('id').eq('project_id', id);

    // Delete project immediately — CASCADE handles all child rows
    const { error: delErr } = await supabaseAdmin.from('projects').delete().eq('id', id);
    if (delErr) throw delErr;

    // Respond immediately — don't wait for Cloudinary
    res.status(200).json({ message: 'Project deleted successfully' });

    // Cloudinary cleanup after response is sent (fire and forget)
    try {
      const { data: stages } = await stagesPromise;
      if (stages && stages.length > 0) {
        const stageIds = stages.map((s: any) => s.id);
        const { data: deliverables } = await supabaseAdmin
          .from('deliverables').select('file_url').in('stage_id', stageIds);
        // Note: deliverables are already cascade-deleted, but we have the URLs from before
        if (deliverables && deliverables.length > 0) {
          const rawIds: string[] = [];
          for (const d of deliverables) {
            const url: string = d.file_url;
            if (!url.includes('cloudinary.com')) continue;
            const parts = url.split('/');
            const uploadIdx = parts.findIndex((p: string) => p === 'upload');
            if (uploadIdx !== -1) {
              const afterUpload = parts.slice(uploadIdx + 1).filter((p: string) => !/^v\d+$/.test(p));
              rawIds.push(afterUpload.join('/'));
            }
          }
          if (rawIds.length > 0) {
            const { v2: cloudinary } = await import('cloudinary');
            cloudinary.config({
              cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
              api_key: process.env.CLOUDINARY_API_KEY,
              api_secret: process.env.CLOUDINARY_API_SECRET,
            });
            await cloudinary.api.delete_resources(rawIds, { resource_type: 'raw' });
          }
        }
      }
    } catch (cErr: any) {
      console.warn('Post-delete Cloudinary cleanup failed:', cErr.message);
    }
  } catch (error: any) {
    if (!res.headersSent)
      res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default serverless(app);
