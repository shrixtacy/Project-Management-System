import { Badge } from '@/components/ui/badge';
import { StageStatus, TaskStatus, Priority, ProjectStatus } from '@/types';
import { cn } from '@/lib/utils';

const stageStatusStyles: Record<StageStatus, string> = {
  APPROVED: 'bg-status-approved text-status-approved-fg',
  IN_PROGRESS: 'bg-status-active text-status-active-fg',
  PENDING_APPROVAL: 'bg-status-pending text-status-pending-fg',
  LOCKED: 'bg-status-locked text-status-locked-fg',
};

const taskStatusStyles: Record<TaskStatus, string> = {
  TODO: 'bg-muted text-muted-foreground',
  IN_PROGRESS: 'bg-status-active text-status-active-fg',
  COMPLETED: 'bg-status-approved text-status-approved-fg',
  BLOCKED: 'bg-status-blocked text-status-blocked-fg',
};

const priorityStyles: Record<Priority, string> = {
  HIGH: 'bg-priority-high/15 text-priority-high border-priority-high/30',
  MEDIUM: 'bg-priority-medium/15 text-priority-medium border-priority-medium/30',
  LOW: 'bg-priority-low/15 text-priority-low border-priority-low/30',
};

const projectStatusStyles: Record<ProjectStatus, string> = {
  DESIGN: 'bg-status-active text-status-active-fg',
  OPERATIONS: 'bg-status-pending text-status-pending-fg',
  COMPLETED: 'bg-status-approved text-status-approved-fg',
};

export const StageStatusBadge = ({ status }: { status: StageStatus }) => (
  <Badge className={cn('text-[11px] border-0 font-body', stageStatusStyles[status])}>
    {status.replace('_', ' ')}
  </Badge>
);

export const TaskStatusBadge = ({ status }: { status: TaskStatus }) => (
  <Badge className={cn('text-[11px] border-0 font-body', taskStatusStyles[status])}>
    {status.replace('_', ' ')}
  </Badge>
);

export const PriorityBadge = ({ priority }: { priority: Priority }) => (
  <Badge variant="outline" className={cn('text-[11px] font-body', priorityStyles[priority])}>
    {priority}
  </Badge>
);

export const ProjectStatusBadge = ({ status }: { status: ProjectStatus }) => (
  <Badge className={cn('text-[11px] border-0 font-body', projectStatusStyles[status])}>
    {status}
  </Badge>
);
