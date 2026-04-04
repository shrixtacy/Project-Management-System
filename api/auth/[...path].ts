import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function verifyAdmin(req: VercelRequest): Promise<boolean> {
  const authHeader = req.headers.authorization;
  if (!authHeader) return false;

  const token = (authHeader as string).replace('Bearer ', '');
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return false;

  const { data: userData, error: dbError } = await supabaseAdmin
    .from('users').select('role').eq('id', user.id).single();

  return !!(userData && userData.role === 'ADMIN');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Parse the sub-path from the URL
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const pathParts = url.pathname.replace('/api/auth/', '').split('/');
  const action = pathParts[0]; // "create-user" or "delete-user"
  const paramId = pathParts[1]; // user ID for delete

  // Verify admin
  const isAdmin = await verifyAdmin(req);
  if (!isAdmin) return res.status(403).json({ error: 'Forbidden. Requires ADMIN role.' });

  // ─── POST /api/auth/create-user ───
  if (action === 'create-user' && req.method === 'POST') {
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

      return res.status(201).json({ message: 'User created successfully', user: data.user });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  // ─── DELETE /api/auth/delete-user/:id ───
  if (action === 'delete-user' && req.method === 'DELETE' && paramId) {
    try {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(paramId);
      if (error) throw error;
      return res.status(200).json({ message: 'User deleted successfully' });
    } catch (error: any) {
      if (error.code === '23503')
        return res.status(400).json({ error: 'Cannot delete user: They are assigned to one or more projects.' });
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  // ─── DELETE /api/auth/delete-project/:id ───
  if (action === 'delete-project' && req.method === 'DELETE' && paramId) {
    try {
      const { error: delErr } = await supabaseAdmin.from('projects').delete().eq('id', paramId);
      if (delErr) throw delErr;

      res.status(200).json({ message: 'Project deleted successfully' });

      // Fire-and-forget Cloudinary cleanup (won't block response)
      try {
        const { data: stages } = await supabaseAdmin
          .from('design_stages').select('id').eq('project_id', paramId);
        if (stages && stages.length > 0) {
          const stageIds = stages.map((s: any) => s.id);
          const { data: deliverables } = await supabaseAdmin
            .from('deliverables').select('file_url').in('stage_id', stageIds);
          if (deliverables && deliverables.length > 0) {
            const rawIds: string[] = [];
            for (const d of deliverables) {
              const fileUrl: string = d.file_url;
              if (!fileUrl.includes('cloudinary.com')) continue;
              const parts = fileUrl.split('/');
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
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
    return;
  }

  return res.status(404).json({ error: 'Not found' });
}
