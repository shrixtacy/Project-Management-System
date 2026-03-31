/**
 * API Service Layer — Supported by Supabase
 */
import {
  User, Project, DesignStage, StageDeliverable, Comment,
  OpsTask, AuditLog, Notification, Role, StageStatus, TaskStatus, Priority, TaskCategory, STAGE_NAMES, ProjectStatus,
} from '@/types';
import { supabase, BACKEND_URL } from './supabaseClient';

const generateId = () => crypto.randomUUID();
const now = () => new Date().toISOString();

export function seedIfEmpty() {
  // Disabling local seeding since we use real backend DB now.
}

// ==================== AUTH ====================
export async function login(email: string, password: string): Promise<User | null> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw error;
  
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', data.user.id)
    .single();

  if (userError || !userData) throw userError;
  return {
    ...userData,
    isActive: userData.is_active,
    createdAt: userData.created_at
  } as User;
}

export async function logout() {
  await supabase.auth.signOut();
}

export async function getCurrentUser(): Promise<User | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data: userData } = await supabase
    .from('users')
    .select('*')
    .eq('id', session.user.id)
    .single();

  return {
    ...userData,
    isActive: userData.is_active,
    createdAt: userData.created_at
  } as User;
}

// ==================== USERS ====================
export async function getUsers(): Promise<User[]> {
  const { data, error } = await supabase.from('users').select('*');
  if (error) throw error;
  return data.map((u: any) => ({
    ...u,
    isActive: u.is_active,
    createdAt: u.created_at
  })) as User[];
}

export async function createUser(data: Omit<User, 'id' | 'createdAt' | 'isActive'>): Promise<User> {
  const { data: session } = await supabase.auth.getSession();
  if (!session?.session) throw new Error("Unauthorized");

  const res = await fetch(`${BACKEND_URL}/auth/create-user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.session.access_token}`
    },
    body: JSON.stringify(data)
  });
  
  const resData = await res.json();
  if (!res.ok) throw new Error(resData.error || 'Failed to create user');
  
  return resData.user;
}

export async function deleteUser(id: string): Promise<boolean> {
  const { data: session } = await supabase.auth.getSession();
  if (!session?.session) throw new Error("Unauthorized");

  const res = await fetch(`${BACKEND_URL}/auth/delete-user/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${session.session.access_token}`
    }
  });

  const resData = await res.json();
  if (!res.ok) throw new Error(resData.error || 'Failed to delete user');
  
  return true;
}

export async function updateUser(id: string, data: Partial<User>): Promise<User | null> {
  const payload: any = { ...data };
  if (data.isActive !== undefined) {
    payload.is_active = data.isActive;
    delete payload.isActive;
  }
  
  const { data: updated, error } = await supabase
    .from('users')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error || !updated) return null;
  return {
    ...updated,
    isActive: updated.is_active,
    createdAt: updated.created_at
  } as User;
}

// ==================== PROJECTS ====================
export async function getProjects(role?: Role, userId?: string): Promise<Project[]> {
  let query = supabase.from('projects').select('*');
  if (role === 'DESIGNER' && userId) {
    query = query.eq('assigned_designer_id', userId);
  } else if (role === 'OPERATIONS' && userId) {
    query = query.eq('assigned_ops_id', userId).in('status', ['OPERATIONS', 'COMPLETED']);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  
  // Transform DB snake_case to camelCase
  return data.map((p: any) => ({
    ...p,
    clientName: p.client_name,
    clientContact: p.client_contact,
    assignedDesignerId: p.assigned_designer_id,
    assignedOpsId: p.assigned_ops_id,
    handoffAcknowledged: p.handoff_acknowledged,
    createdAt: p.created_at,
  })) as Project[];
}

export async function createProject(data: Omit<Project, 'id' | 'createdAt' | 'status' | 'handoffAcknowledged'>): Promise<Project> {
  // First create project
  const projectObj = {
    title: data.title,
    client_name: data.clientName,
    client_contact: data.clientContact,
    location: data.location,
    assigned_designer_id: data.assignedDesignerId,
    assigned_ops_id: data.assignedOpsId,
  };
  
  const { data: newProj, error: proError } = await supabase
    .from('projects')
    .insert([projectObj])
    .select()
    .single();
    
  if (proError || !newProj) throw proError;

  // Auto-create stages
  for (let i = 1; i <= 6; i++) {
    await supabase.from('design_stages').insert([{
      project_id: newProj.id,
      stage_number: i,
      stage_name: STAGE_NAMES[i],
      status: i === 1 ? 'IN_PROGRESS' : 'LOCKED'
    }]);
  }
  return { ...newProj, clientName: newProj.client_name, clientContact: newProj.client_contact } as Project;
}

export async function getProject(id: string): Promise<Project | null> {
  const { data, error } = await supabase.from('projects').select('*').eq('id', id).single();
  if (error || !data) return null;
  return {
    ...data,
    clientName: data.client_name,
    clientContact: data.client_contact,
    assignedDesignerId: data.assigned_designer_id,
    assignedOpsId: data.assigned_ops_id,
    handoffAcknowledged: data.handoff_acknowledged,
    createdAt: data.created_at,
  } as Project;
}

export async function updateProject(id: string, data: Partial<Project>): Promise<Project | null> {
  const updatePayload: any = { ...data };
  if (data.clientName) updatePayload.client_name = data.clientName;
  if (data.clientContact) updatePayload.client_contact = data.clientContact;
  if (data.assignedDesignerId) updatePayload.assigned_designer_id = data.assignedDesignerId;
  if (data.assignedOpsId) updatePayload.assigned_ops_id = data.assignedOpsId;
  if (data.handoffAcknowledged !== undefined) updatePayload.handoff_acknowledged = data.handoffAcknowledged;

  const { data: updated, error } = await supabase
    .from('projects')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();
    
  if (error || !updated) return null;
  return updated as Project; // Needs mapping ideally
}

export async function deleteProject(id: string): Promise<boolean> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session) throw new Error('Not authenticated');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

  try {
    const res = await fetch(`/api/auth/delete-project/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${sessionData.session.access_token}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to delete project');
    return true;
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') throw new Error('Request timed out');
    throw err;
  }
}

// ==================== STAGES ====================
export async function getStages(projectId: string): Promise<DesignStage[]> {
  const { data, error } = await supabase
    .from('design_stages')
    .select('*')
    .eq('project_id', projectId)
    .order('stage_number', { ascending: true });
    
  if (error) throw error;
  
  return data.map((s: any) => ({
    id: s.id,
    projectId: s.project_id,
    stageNumber: s.stage_number,
    stageName: s.stage_name,
    status: s.status,
    completedAt: s.completed_at
  })) as DesignStage[];
}

export async function updateStageStatus(stageId: string, status: StageStatus): Promise<void> {
  await supabase.from('design_stages').update({ status, completed_at: status === 'APPROVED' ? now() : null }).eq('id', stageId);
}

export async function approveStage(stageId: string): Promise<void> {
  await updateStageStatus(stageId, 'APPROVED');
  // Unlock next stage logic
  const { data: current } = await supabase.from('design_stages').select('*').eq('id', stageId).single();
  if (current) {
    const { data: nextStage } = await supabase
      .from('design_stages')
      .select('*')
      .eq('project_id', current.project_id)
      .eq('stage_number', current.stage_number + 1)
      .single();
      
    if (nextStage && nextStage.status === 'LOCKED') {
      await updateStageStatus(nextStage.id, 'IN_PROGRESS');
    }
  }
}

export async function rejectStage(stageId: string): Promise<void> { await updateStageStatus(stageId, 'IN_PROGRESS'); }
export async function submitStageForApproval(stageId: string): Promise<void> { await updateStageStatus(stageId, 'PENDING_APPROVAL'); }

// ==================== DELIVERABLES ====================
export async function addDeliverable(data: { stageId: string; file: File; notes?: string; uploadedBy: string }): Promise<StageDeliverable> {
  const formData = new FormData();
  formData.append('file', data.file);
  
  // Upload to Cloudinary via backend
  const res = await fetch(`${BACKEND_URL}/upload`, {
    method: 'POST',
    body: formData
  });
  
  const uploadResult = await res.json();
  if (!res.ok) throw new Error(uploadResult.error || 'Upload failed');
  
  const { data: deliverable, error } = await supabase.from('deliverables').insert([{
    stage_id: data.stageId,
    file_name: data.file.name,
    file_url: uploadResult.url,
    file_type: uploadResult.format === 'zip' ? 'application/zip' : data.file.type,
    uploaded_by: data.uploadedBy,
    notes: data.notes || null
  }]).select().single();
  
  if (error) throw error;
  
  return {
    id: deliverable.id,
    stageId: deliverable.stage_id,
    fileName: deliverable.file_name,
    fileUrl: deliverable.file_url,
    fileType: deliverable.file_type,
    uploadedBy: deliverable.uploaded_by,
    notes: deliverable.notes,
    uploadedAt: deliverable.uploaded_at
  } as StageDeliverable;
}

export async function getDeliverables(stageId: string): Promise<StageDeliverable[]> {
  const { data, error } = await supabase.from('deliverables').select('*').eq('stage_id', stageId);
  if (error) throw error;
  return data.map((d: any) => ({
    id: d.id, stageId: d.stage_id, fileName: d.file_name, fileUrl: d.file_url,
    fileType: d.file_type, uploadedBy: d.uploaded_by, notes: d.notes, uploadedAt: d.uploaded_at
  })) as StageDeliverable[];
}

export async function getDeliverablesByProject(projectId: string): Promise<StageDeliverable[]> {
  // First, get all stages for this project
  const { data: stages, error: stError } = await supabase.from('design_stages').select('id').eq('project_id', projectId);
  if (stError || !stages) return [];
  
  const stageIds = stages.map(s => s.id);
  if (stageIds.length === 0) return [];

  // Then fetch deliverables for those stages
  const { data, error } = await supabase.from('deliverables').select('*').in('stage_id', stageIds);
  if (error) throw error;
  
  return data.map((d: any) => ({
    id: d.id, stageId: d.stage_id, fileName: d.file_name, fileUrl: d.file_url,
    fileType: d.file_type, uploadedBy: d.uploaded_by, notes: d.notes, uploadedAt: d.uploaded_at
  })) as StageDeliverable[];
}

// ==================== COMMENTS ====================
export async function addComment(data: Omit<Comment, 'id' | 'createdAt'>): Promise<Comment> {
  const { data: newComment, error } = await supabase.from('comments').insert([{
    stage_id: data.stageId, user_id: data.userId, user_name: data.userName, content: data.content
  }]).select().single();
  
  if (error) throw error;
  return {
    id: newComment.id, stageId: newComment.stage_id, userId: newComment.user_id,
    userName: newComment.user_name, content: newComment.content, createdAt: newComment.created_at
  } as Comment;
}

export async function getComments(stageId: string): Promise<Comment[]> {
  const { data, error } = await supabase.from('comments').select('*').eq('stage_id', stageId).order('created_at', { ascending: false });
  if (error) throw error;
  return data.map((c: any) => ({
    id: c.id, stageId: c.stage_id, userId: c.user_id, userName: c.user_name,
    content: c.content, createdAt: c.created_at
  })) as Comment[];
}

// ==================== OPS TASKS ====================
export async function getTasks(projectId: string): Promise<OpsTask[]> {
  const { data, error } = await supabase.from('ops_tasks').select('*').eq('project_id', projectId);
  if (error) throw error;
  return data.map((t: any) => ({
    id: t.id, projectId: t.project_id, title: t.title, description: t.description,
    category: t.category, assignedTo: t.assigned_to, priority: t.priority,
    status: t.status, dueDate: t.due_date, attachments: t.attachments, createdAt: t.created_at
  })) as OpsTask[];
}

export async function createTask(data: Omit<OpsTask, 'id' | 'createdAt'>): Promise<OpsTask> {
  const { data: newT, error } = await supabase.from('ops_tasks').insert([{
    project_id: data.projectId, title: data.title, description: data.description,
    category: data.category, assigned_to: data.assignedTo, priority: data.priority,
    due_date: data.dueDate, attachments: data.attachments || []
  }]).select().single();
  
  if (error) throw error;
  return {
    ...newT, projectId: newT.project_id, assignedTo: newT.assigned_to, dueDate: newT.due_date, createdAt: newT.created_at
  } as OpsTask;
}

export async function updateTask(taskId: string, data: Partial<OpsTask>): Promise<OpsTask | null> {
  const updatePayload: any = { ...data };
  if (data.assignedTo) updatePayload.assigned_to = data.assignedTo;
  if (data.dueDate !== undefined) updatePayload.due_date = data.dueDate;

  const { data: updated, error } = await supabase.from('ops_tasks').update(updatePayload).eq('id', taskId).select().single();
  if (error || !updated) return null;
  return updated as OpsTask;
}

export async function deleteTask(taskId: string): Promise<boolean> {
  const { error } = await supabase.from('ops_tasks').delete().eq('id', taskId);
  return !error;
}

// ==================== AUDIT LOGS ====================
export async function addAuditLog(userId: string, userName: string, projectId: string | null, action: string, entity: string, details: string | null = null) {
  await supabase.from('audit_logs').insert([{
    user_id: userId, user_name: userName, project_id: projectId, action, entity, details
  }]);
}

export async function getAuditLogs(): Promise<AuditLog[]> {
  const { data, error } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false });
  if (error) return [];
  return data.map((l: any) => ({
    id: l.id, userId: l.user_id, userName: l.user_name, projectId: l.project_id,
    action: l.action, entity: l.entity, details: l.details, createdAt: l.created_at
  })) as AuditLog[];
}

// ==================== NOTIFICATIONS ====================
export async function getNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) return [];
  return data.map((n: any) => ({ ...n, userId: n.user_id, createdAt: n.created_at })) as Notification[];
}

export async function getUnreadCount(userId: string): Promise<number> {
  const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('read', false);
  return count || 0;
}

export async function markNotificationRead(notificationId: string) {
  await supabase.from('notifications').update({ read: true }).eq('id', notificationId);
}

export async function markAllNotificationsRead(userId: string) {
  await supabase.from('notifications').update({ read: true }).eq('user_id', userId);
}

export async function addNotification(userId: string, title: string, message: string, link: string | null = null) {
  await supabase.from('notifications').insert([{ user_id: userId, title, message, link }]);
}

// ==================== P2P HANDOFF ====================
export async function initiateHandoff(projectId: string, userId: string, userName: string): Promise<boolean> {
  await supabase.from('projects').update({ status: 'OPERATIONS' }).eq('id', projectId);
  const p = await getProject(projectId);
  if (p) {
    await addNotification(p.assignedOpsId, 'Project Handoff', `Project "${p.title}" handed off to Operations.`, `/operations/projects/${projectId}`);
    await addAuditLog(userId, userName, projectId, 'Initiated P2P handoff', 'Project', p.title);
  }
  return true;
}

export async function acknowledgeHandoff(projectId: string, userId: string, userName: string): Promise<boolean> {
  await supabase.from('projects').update({ handoff_acknowledged: true }).eq('id', projectId);
  return true;
}

export async function markProjectComplete(projectId: string, userId: string, userName: string) {
  await supabase.from('projects').update({ status: 'COMPLETED' }).eq('id', projectId);
  await addAuditLog(userId, userName, projectId, 'Marked project as completed', 'Project', '');
}
