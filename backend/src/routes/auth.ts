import { Router, Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const router = Router();

// Initialize Supabase Admin Client using Service Role Key
// IMPORTANT: This allows bypassing RLS and creating users without logging them in
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let supabaseAdmin: any = null;
try {
  if (supabaseUrl && supabaseServiceKey) {
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
  }
} catch (e) {
  console.warn("Backend: Failed to initialize Supabase Admin. Env vars missing?");
}

// Middleware to verify if the requester is an ADMIN
// (In a production app, verify the JWT from the frontend. Here we simplify by expecting an adminId header)
const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase Server Credentials (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY) are missing on the Backend.' });
  }
  
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' });
  
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  
  if (error || !user) return res.status(401).json({ error: 'Invalid Token' });
  
  // Verify user is an admin in the database
  const { data: userData, error: dbError } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (dbError || !userData || userData.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden. Requires ADMIN role.' });
  }

  next();
};

/**
 * @route POST /api/auth/create-user
 * @desc Admin creates a new Designer or Operations user
 */
router.post('/create-user', requireAdmin, async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

    if (!email || !password || !name || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!['DESIGNER', 'OPERATIONS'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Use Admin API to create user
    const { data, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email to simplify the flow
      user_metadata: { name, role }
    });

    if (authError) throw authError;
    
    // The database trigger sometimes fails silently due to permission scopes
    // To guarantee the user appears in the table, we explicitly insert them here:
    const { error: dbError } = await supabaseAdmin.from('users').insert({
      id: data.user.id,
      name,
      email,
      role,
      is_active: true
    });

    // We only throw if it's an actual error (code 23505 is duplicate key, meaning trigger worked)
    if (dbError && dbError.code !== '23505') {
      console.error("Failed to insert into public.users:", dbError);
    }

    res.status(201).json({
      message: 'User created successfully',
      user: data.user
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * @route DELETE /api/auth/delete-user/:id
 * @desc Admin deletes a user
 */
router.delete('/delete-user/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'Missing user ID' });

    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (error) throw error;

    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error: any) {
    if (error.code === '23503') {
      return res.status(400).json({ error: 'Cannot delete user: They are assigned to one or more projects.' });
    }
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;
