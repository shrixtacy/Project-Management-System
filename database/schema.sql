-- Create ENUMs
CREATE TYPE user_role AS ENUM ('ADMIN', 'DESIGNER', 'OPERATIONS');
CREATE TYPE project_status AS ENUM ('DESIGN', 'OPERATIONS', 'COMPLETED');
CREATE TYPE stage_status AS ENUM ('LOCKED', 'IN_PROGRESS', 'PENDING_APPROVAL', 'APPROVED');
CREATE TYPE task_category AS ENUM ('PROCUREMENT', 'INSTALLATION', 'INSPECTION', 'SNAG', 'OTHER');
CREATE TYPE task_priority AS ENUM ('HIGH', 'MEDIUM', 'LOW');
CREATE TYPE task_status AS ENUM ('TODO', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED');

-- Create Tables
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role user_role NOT NULL DEFAULT 'DESIGNER',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_contact TEXT NOT NULL,
  location TEXT NOT NULL,
  status project_status NOT NULL DEFAULT 'DESIGN',
  assigned_designer_id UUID REFERENCES public.users(id),
  assigned_ops_id UUID REFERENCES public.users(id),
  handoff_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Note: We map UUID types in the frontend from UUID format. It's fine since we used crypto.randomUUID()
CREATE TABLE public.design_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  stage_number INTEGER NOT NULL,
  stage_name TEXT NOT NULL,
  status stage_status NOT NULL DEFAULT 'LOCKED',
  completed_at TIMESTAMPTZ
);

CREATE TABLE public.deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id UUID REFERENCES public.design_stages(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  uploaded_by UUID REFERENCES public.users(id),
  notes TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id UUID REFERENCES public.design_stages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id),
  user_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.ops_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category task_category NOT NULL,
  assigned_to UUID REFERENCES public.users(id),
  priority task_priority NOT NULL,
  status task_status NOT NULL DEFAULT 'TODO',
  due_date TIMESTAMPTZ,
  attachments TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id),
  user_name TEXT NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.design_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Base View Policies
CREATE POLICY "Logged in users can view users" ON public.users FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can update users" ON public.users FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
);
CREATE POLICY "Users can read all projects" ON public.projects FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can read all stages" ON public.design_stages FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can read deliverables" ON public.deliverables FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can read comments" ON public.comments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can read tasks" ON public.ops_tasks FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can read audit logs" ON public.audit_logs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can manage own notifications" ON public.notifications FOR ALL USING (user_id = auth.uid());

-- Mutation Policies
CREATE POLICY "Admins can manage projects" ON public.projects FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
);
CREATE POLICY "Admins can delete projects" ON public.projects FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
);
CREATE POLICY "Users can update projects" ON public.projects FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage stages" ON public.design_stages FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert deliverables" ON public.deliverables FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can insert comments" ON public.comments FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can manage tasks" ON public.ops_tasks FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');
