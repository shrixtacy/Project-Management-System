-- Run this once in Supabase SQL Editor
-- Creates a SECURITY DEFINER function that bypasses RLS to delete a project
-- ON DELETE CASCADE in schema handles all child rows (stages, deliverables, comments, tasks)

CREATE OR REPLACE FUNCTION delete_project(project_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only allow ADMIN users to call this
  IF (SELECT role FROM public.users WHERE id = auth.uid()) != 'ADMIN' THEN
    RAISE EXCEPTION 'Forbidden: ADMIN role required';
  END IF;

  DELETE FROM public.projects WHERE id = project_id;
END;
$$;
