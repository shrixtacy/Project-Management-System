/**
 * API Service Layer — localStorage-backed, structured for easy backend swap.
 * Replace localStorage calls with fetch('/api/...') when connecting to a real backend.
 */
import {
  User, Project, DesignStage, StageDeliverable, Comment,
  OpsTask, AuditLog, Notification, Role, ProjectStatus,
  StageStatus, TaskStatus, Priority, TaskCategory, STAGE_NAMES,
} from '@/types';

// ==================== HELPERS ====================
const generateId = () => crypto.randomUUID();
const now = () => new Date().toISOString();

function getStore<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}

function setStore<T>(key: string, data: T[]) {
  localStorage.setItem(key, JSON.stringify(data));
}

// ==================== SEED DATA ====================
export function seedIfEmpty() {
  const existingStages = getStore<DesignStage>('pms_stages');
  if (existingStages.length > 0 && existingStages[0].stageName !== STAGE_NAMES[1]) {
    localStorage.clear();
  }

  if (getStore<User>('pms_users').length > 0) return;

  const admin: User = {
    id: generateId(), name: 'Admin User', email: 'admin@designco.com',
    password: 'admin123', role: 'ADMIN', isActive: true, createdAt: now(),
  };
  const designer: User = {
    id: generateId(), name: 'Sarah Chen', email: 'sarah@designco.com',
    password: 'designer123', role: 'DESIGNER', isActive: true, createdAt: now(),
  };
  const ops: User = {
    id: generateId(), name: 'Mike Johnson', email: 'mike@designco.com',
    password: 'ops123', role: 'OPERATIONS', isActive: true, createdAt: now(),
  };

  setStore('pms_users', [admin, designer, ops]);

  // Seed a sample project
  const project: Project = {
    id: generateId(), title: 'Modern Loft Renovation', clientName: 'Acme Corp',
    clientContact: 'john@acme.com', location: 'New York, NY', status: 'DESIGN',
    assignedDesignerId: designer.id, assignedOpsId: ops.id,
    handoffAcknowledged: false, createdAt: now(),
  };
  setStore('pms_projects', [project]);

  // Seed 6 stages for the project
  const stages: DesignStage[] = Array.from({ length: 6 }, (_, i) => ({
    id: generateId(),
    projectId: project.id,
    stageNumber: i + 1,
    stageName: STAGE_NAMES[i + 1],
    status: i === 0 ? 'IN_PROGRESS' as StageStatus : 'LOCKED' as StageStatus,
    completedAt: null,
  }));
  setStore('pms_stages', stages);

  addAuditLog(admin.id, admin.name, project.id, 'Created project', 'Project', project.title);
}

// ==================== AUTH ====================
// POST /api/auth/login
export function login(email: string, password: string): User | null {
  const users = getStore<User>('pms_users');
  return users.find(u => u.email === email && u.password === password && u.isActive) || null;
}

// POST /api/auth/logout
export function logout() {
  localStorage.removeItem('pms_current_user');
}

export function setCurrentUser(user: User) {
  localStorage.setItem('pms_current_user', JSON.stringify(user));
}

export function getCurrentUser(): User | null {
  try {
    return JSON.parse(localStorage.getItem('pms_current_user') || 'null');
  } catch {
    return null;
  }
}

// ==================== USERS ====================
// GET /api/users
export function getUsers(): User[] {
  return getStore<User>('pms_users');
}

// POST /api/users
export function createUser(data: Omit<User, 'id' | 'createdAt' | 'isActive'>): User {
  const users = getStore<User>('pms_users');
  const user: User = { ...data, id: generateId(), isActive: true, createdAt: now() };
  users.push(user);
  setStore('pms_users', users);
  return user;
}

// PATCH /api/users/:id
export function updateUser(id: string, data: Partial<User>): User | null {
  const users = getStore<User>('pms_users');
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return null;
  users[idx] = { ...users[idx], ...data };
  setStore('pms_users', users);
  return users[idx];
}

// ==================== PROJECTS ====================
// GET /api/projects
export function getProjects(role?: Role, userId?: string): Project[] {
  const projects = getStore<Project>('pms_projects');
  if (role === 'DESIGNER' && userId) return projects.filter(p => p.assignedDesignerId === userId);
  if (role === 'OPERATIONS' && userId) return projects.filter(p => p.assignedOpsId === userId && (p.status === 'OPERATIONS' || p.status === 'COMPLETED'));
  return projects;
}

// POST /api/projects
export function createProject(data: Omit<Project, 'id' | 'createdAt' | 'status' | 'handoffAcknowledged'>): Project {
  const projects = getStore<Project>('pms_projects');
  const project: Project = { ...data, id: generateId(), status: 'DESIGN', handoffAcknowledged: false, createdAt: now() };
  projects.push(project);
  setStore('pms_projects', projects);

  // Auto-create 6 stages
  const stages = getStore<DesignStage>('pms_stages');
  for (let i = 1; i <= 6; i++) {
    stages.push({
      id: generateId(), projectId: project.id, stageNumber: i,
      stageName: STAGE_NAMES[i], status: i === 1 ? 'IN_PROGRESS' : 'LOCKED', completedAt: null,
    });
  }
  setStore('pms_stages', stages);
  return project;
}

// GET /api/projects/:id
export function getProject(id: string): Project | null {
  return getStore<Project>('pms_projects').find(p => p.id === id) || null;
}

// PATCH /api/projects/:id
export function updateProject(id: string, data: Partial<Project>): Project | null {
  const projects = getStore<Project>('pms_projects');
  const idx = projects.findIndex(p => p.id === id);
  if (idx === -1) return null;
  projects[idx] = { ...projects[idx], ...data };
  setStore('pms_projects', projects);
  return projects[idx];
}

// ==================== STAGES ====================
// GET /api/projects/:id/stages
export function getStages(projectId: string): DesignStage[] {
  return getStore<DesignStage>('pms_stages')
    .filter(s => s.projectId === projectId)
    .sort((a, b) => a.stageNumber - b.stageNumber);
}

// PATCH /api/projects/:id/stages/:stageId (approve/reject)
export function approveStage(stageId: string): DesignStage | null {
  const stages = getStore<DesignStage>('pms_stages');
  const idx = stages.findIndex(s => s.id === stageId);
  if (idx === -1) return null;

  stages[idx].status = 'APPROVED';
  stages[idx].completedAt = now();

  // Unlock next stage
  const nextIdx = stages.findIndex(s => s.projectId === stages[idx].projectId && s.stageNumber === stages[idx].stageNumber + 1);
  if (nextIdx !== -1 && stages[nextIdx].status === 'LOCKED') {
    stages[nextIdx].status = 'IN_PROGRESS';
  }

  setStore('pms_stages', stages);
  return stages[idx];
}

export function rejectStage(stageId: string): DesignStage | null {
  const stages = getStore<DesignStage>('pms_stages');
  const idx = stages.findIndex(s => s.id === stageId);
  if (idx === -1) return null;
  stages[idx].status = 'IN_PROGRESS';
  setStore('pms_stages', stages);
  return stages[idx];
}

export function submitStageForApproval(stageId: string): DesignStage | null {
  const stages = getStore<DesignStage>('pms_stages');
  const idx = stages.findIndex(s => s.id === stageId);
  if (idx === -1) return null;
  stages[idx].status = 'PENDING_APPROVAL';
  setStore('pms_stages', stages);
  return stages[idx];
}

// ==================== DELIVERABLES ====================
// POST /api/projects/:id/stages/:stageId/deliverables
export function addDeliverable(data: Omit<StageDeliverable, 'id' | 'uploadedAt'>): StageDeliverable {
  const deliverables = getStore<StageDeliverable>('pms_deliverables');
  const d: StageDeliverable = { ...data, id: generateId(), uploadedAt: now() };
  deliverables.push(d);
  setStore('pms_deliverables', deliverables);
  return d;
}

export function getDeliverables(stageId: string): StageDeliverable[] {
  return getStore<StageDeliverable>('pms_deliverables').filter(d => d.stageId === stageId);
}

export function getDeliverablesByProject(projectId: string): StageDeliverable[] {
  const stages = getStages(projectId);
  const stageIds = new Set(stages.map(s => s.id));
  return getStore<StageDeliverable>('pms_deliverables').filter(d => stageIds.has(d.stageId));
}

// ==================== COMMENTS ====================
export function addComment(data: Omit<Comment, 'id' | 'createdAt'>): Comment {
  const comments = getStore<Comment>('pms_comments');
  const c: Comment = { ...data, id: generateId(), createdAt: now() };
  comments.push(c);
  setStore('pms_comments', comments);
  return c;
}

export function getComments(stageId: string): Comment[] {
  return getStore<Comment>('pms_comments').filter(c => c.stageId === stageId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// ==================== OPS TASKS ====================
// GET /api/projects/:id/tasks
export function getTasks(projectId: string): OpsTask[] {
  return getStore<OpsTask>('pms_tasks').filter(t => t.projectId === projectId);
}

// POST /api/projects/:id/tasks
export function createTask(data: Omit<OpsTask, 'id' | 'createdAt'>): OpsTask {
  const tasks = getStore<OpsTask>('pms_tasks');
  const task: OpsTask = { ...data, id: generateId(), createdAt: now() };
  tasks.push(task);
  setStore('pms_tasks', tasks);
  return task;
}

// PATCH /api/projects/:id/tasks/:taskId
export function updateTask(taskId: string, data: Partial<OpsTask>): OpsTask | null {
  const tasks = getStore<OpsTask>('pms_tasks');
  const idx = tasks.findIndex(t => t.id === taskId);
  if (idx === -1) return null;
  tasks[idx] = { ...tasks[idx], ...data };
  setStore('pms_tasks', tasks);
  return tasks[idx];
}

// DELETE /api/projects/:id/tasks/:taskId
export function deleteTask(taskId: string): boolean {
  const tasks = getStore<OpsTask>('pms_tasks');
  const filtered = tasks.filter(t => t.id !== taskId);
  if (filtered.length === tasks.length) return false;
  setStore('pms_tasks', filtered);
  return true;
}

// ==================== P2P HANDOFF ====================
// POST /api/projects/:id/handoff
export function initiateHandoff(projectId: string, userId: string, userName: string): boolean {
  const stages = getStages(projectId);
  const allApproved = stages.every(s => s.status === 'APPROVED');
  if (!allApproved) return false;

  updateProject(projectId, { status: 'OPERATIONS' });

  const project = getProject(projectId);
  if (project) {
    addNotification(project.assignedOpsId, 'Project Handoff', `Project "${project.title}" has been handed off to Operations.`, `/operations/projects/${projectId}`);
    addAuditLog(userId, userName, projectId, 'Initiated P2P handoff', 'Project', project.title);
  }
  return true;
}

// PATCH /api/projects/:id/handoff/acknowledge
export function acknowledgeHandoff(projectId: string, userId: string, userName: string): boolean {
  updateProject(projectId, { handoffAcknowledged: true });
  const project = getProject(projectId);
  if (project) {
    addAuditLog(userId, userName, projectId, 'Acknowledged handoff', 'Project', project.title);
  }
  return true;
}

// ==================== NOTIFICATIONS ====================
// GET /api/notifications
export function getNotifications(userId: string): Notification[] {
  return getStore<Notification>('pms_notifications')
    .filter(n => n.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getUnreadCount(userId: string): number {
  return getStore<Notification>('pms_notifications').filter(n => n.userId === userId && !n.read).length;
}

// PATCH /api/notifications/:id/read
export function markNotificationRead(notificationId: string) {
  const notifications = getStore<Notification>('pms_notifications');
  const idx = notifications.findIndex(n => n.id === notificationId);
  if (idx !== -1) {
    notifications[idx].read = true;
    setStore('pms_notifications', notifications);
  }
}

export function markAllNotificationsRead(userId: string) {
  const notifications = getStore<Notification>('pms_notifications');
  notifications.forEach(n => { if (n.userId === userId) n.read = true; });
  setStore('pms_notifications', notifications);
}

export function addNotification(userId: string, title: string, message: string, link: string | null = null) {
  const notifications = getStore<Notification>('pms_notifications');
  notifications.push({ id: generateId(), userId, title, message, read: false, link, createdAt: now() });
  setStore('pms_notifications', notifications);
}

// ==================== AUDIT LOG ====================
// GET /api/audit-logs
export function getAuditLogs(): AuditLog[] {
  return getStore<AuditLog>('pms_audit_logs').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function addAuditLog(userId: string, userName: string, projectId: string | null, action: string, entity: string, details: string | null = null) {
  const logs = getStore<AuditLog>('pms_audit_logs');
  logs.push({ id: generateId(), userId, userName, projectId, action, entity, details, createdAt: now() });
  setStore('pms_audit_logs', logs);
}

// ==================== MARK PROJECT COMPLETE ====================
export function markProjectComplete(projectId: string, userId: string, userName: string) {
  updateProject(projectId, { status: 'COMPLETED' });
  addAuditLog(userId, userName, projectId, 'Marked project as completed', 'Project', '');
}
