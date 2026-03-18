// ==================== ENUMS ====================
export type Role = 'ADMIN' | 'DESIGNER' | 'OPERATIONS';
export type ProjectStatus = 'DESIGN' | 'OPERATIONS' | 'COMPLETED';
export type StageStatus = 'LOCKED' | 'IN_PROGRESS' | 'PENDING_APPROVAL' | 'APPROVED';
export type TaskCategory = 'PROCUREMENT' | 'INSTALLATION' | 'INSPECTION' | 'SNAG' | 'OTHER';
export type Priority = 'HIGH' | 'MEDIUM' | 'LOW';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';

// ==================== MODELS ====================
export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

export interface Project {
  id: string;
  title: string;
  clientName: string;
  clientContact: string;
  location: string;
  status: ProjectStatus;
  assignedDesignerId: string;
  assignedOpsId: string;
  handoffAcknowledged: boolean;
  createdAt: string;
}

export interface DesignStage {
  id: string;
  projectId: string;
  stageNumber: number;
  stageName: string;
  status: StageStatus;
  completedAt: string | null;
}

export interface StageDeliverable {
  id: string;
  stageId: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  uploadedBy: string;
  notes: string | null;
  uploadedAt: string;
}

export interface Comment {
  id: string;
  stageId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
}

export interface OpsTask {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  category: TaskCategory;
  assignedTo: string;
  priority: Priority;
  status: TaskStatus;
  dueDate: string | null;
  attachments: string[];
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  projectId: string | null;
  action: string;
  entity: string;
  details: string | null;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  link: string | null;
  createdAt: string;
}

// ==================== STAGE NAMES ====================
export const STAGE_NAMES: Record<number, string> = {
  1: 'Site Survey Report',
  2: 'Theme ideas',
  3: 'Furniture Layout',
  4: '2D',
  5: '3D visualization',
  6: 'P2P',
};
