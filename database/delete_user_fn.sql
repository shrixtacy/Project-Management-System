-- Run this once in Supabase SQL Editor
-- Deletes a user from auth.users (which cascades to public.users via ON DELETE CASCADE)
-- SECURITY DEFINER runs as DB owner, bypassing RLS
-- Only ADMIN users can call this

CREATE OR REPLACE FUNCTION delete_user(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only allow ADMIN users to call this
  IF (SELECT role FROM public.users WHERE id = auth.uid()) != 'ADMIN' THEN
    RAISE EXCEPTION 'Forbidden: ADMIN role required';
  END IF;

  -- Prevent admin from deleting themselves
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete your own account';
  END IF;

  -- Nullify all FK references before deleting
  UPDATE public.projects SET assigned_designer_id = NULL WHERE assigned_designer_id = target_user_id;
  UPDATE public.projects SET assigned_ops_id = NULL WHERE assigned_ops_id = target_user_id;
  UPDATE public.audit_logs SET user_id = NULL WHERE user_id = target_user_id;
  UPDATE public.ops_tasks SET assigned_to = NULL WHERE assigned_to = target_user_id;
  UPDATE public.deliverables SET uploaded_by = NULL WHERE uploaded_by = target_user_id;
  UPDATE public.comments SET user_id = NULL WHERE user_id = target_user_id;

  -- Delete from auth.users — cascades to public.users automatically
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;
