import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  getProject, getStages, getDeliverablesByProject, getTasks,
  createTask, updateTask, deleteTask, acknowledgeHandoff,
  markProjectComplete, addAuditLog,
} from '@/services/api';
import { TaskCategory, Priority, TaskStatus, OpsTask } from '@/types';
import { StageStatusBadge, TaskStatusBadge, PriorityBadge } from '@/components/StatusBadges';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, FileText, CheckCircle, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

const TASK_COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'TODO', label: 'To Do', color: 'border-t-muted-foreground' },
  { status: 'IN_PROGRESS', label: 'In Progress', color: 'border-t-status-active' },
  { status: 'COMPLETED', label: 'Done', color: 'border-t-status-approved' },
  { status: 'BLOCKED', label: 'Blocked', color: 'border-t-status-blocked' },
];

const OpsProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', category: '' as TaskCategory | '', priority: '' as Priority | '', dueDate: '' });
  const [, setRefresh] = useState(0);

  if (!user || !id) return null;

  const project = getProject(id);
  if (!project) return <div className="text-center py-12 text-muted-foreground">Project not found</div>;

  const stages = getStages(id);
  const deliverables = getDeliverablesByProject(id);
  const tasks = getTasks(id);

  const handleAcknowledge = () => {
    acknowledgeHandoff(id, user.id, user.name);
    toast.success('Handoff acknowledged');
    setRefresh(r => r + 1);
  };

  const handleCreateTask = () => {
    if (!taskForm.title || !taskForm.category || !taskForm.priority) {
      toast.error('Title, category, and priority are required');
      return;
    }
    createTask({
      projectId: id,
      title: taskForm.title,
      description: taskForm.description || null,
      category: taskForm.category as TaskCategory,
      assignedTo: user.id,
      priority: taskForm.priority as Priority,
      status: 'TODO',
      dueDate: taskForm.dueDate || null,
      attachments: [],
    });
    addAuditLog(user.id, user.name, id, 'Created task', 'Task', taskForm.title);
    toast.success('Task created');
    setTaskOpen(false);
    setTaskForm({ title: '', description: '', category: '', priority: '', dueDate: '' });
    setRefresh(r => r + 1);
  };

  const handleTaskStatusChange = (taskId: string, newStatus: TaskStatus) => {
    updateTask(taskId, { status: newStatus });
    setRefresh(r => r + 1);
  };

  const handleDeleteTask = (taskId: string) => {
    deleteTask(taskId);
    toast.success('Task deleted');
    setRefresh(r => r + 1);
  };

  const handleComplete = () => {
    markProjectComplete(id, user.id, user.name);
    toast.success('Project marked as completed');
    setRefresh(r => r + 1);
  };

  if (!project.handoffAcknowledged) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-xl font-bold text-foreground">{project.title}</h1>
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <p className="text-foreground font-medium">This project has been handed off from the Design team.</p>
            <p className="text-sm text-muted-foreground">Please acknowledge the handoff to activate your task board.</p>
            <Button onClick={handleAcknowledge} className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
              Acknowledge Handoff
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">{project.title}</h1>
          <p className="text-sm text-muted-foreground">{project.clientName} · {project.location}</p>
        </div>
        {project.status === 'OPERATIONS' && (
          <Button onClick={handleComplete} className="bg-status-approved text-status-approved-fg hover:bg-status-approved/90">
            <CheckCircle className="w-4 h-4 mr-2" /> Mark Complete
          </Button>
        )}
      </div>

      <Tabs defaultValue="tasks">
        <TabsList>
          <TabsTrigger value="tasks">Task Board</TabsTrigger>
          <TabsTrigger value="deliverables">Design Deliverables</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">{tasks.length} tasks</p>
            <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
                  <Plus className="w-4 h-4 mr-1" /> Add Task
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle className="font-display">Add Task</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>Title *</Label><Input value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} /></div>
                  <div><Label>Description</Label><Textarea value={taskForm.description} onChange={e => setTaskForm({ ...taskForm, description: e.target.value })} rows={2} /></div>
                  <div>
                    <Label>Category *</Label>
                    <Select value={taskForm.category} onValueChange={v => setTaskForm({ ...taskForm, category: v as TaskCategory })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {(['PROCUREMENT', 'INSTALLATION', 'INSPECTION', 'SNAG', 'OTHER'] as TaskCategory[]).map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Priority *</Label>
                    <Select value={taskForm.priority} onValueChange={v => setTaskForm({ ...taskForm, priority: v as Priority })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {(['HIGH', 'MEDIUM', 'LOW'] as Priority[]).map(p => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Due Date</Label><Input type="date" value={taskForm.dueDate} onChange={e => setTaskForm({ ...taskForm, dueDate: e.target.value })} /></div>
                  <Button onClick={handleCreateTask} className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90">Create Task</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Kanban Board */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {TASK_COLUMNS.map(col => {
              const colTasks = tasks.filter(t => t.status === col.status);
              return (
                <div key={col.status} className={cn("bg-muted/30 rounded-lg border-t-4 p-3 min-h-[200px]", col.color)}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-display text-sm font-semibold">{col.label}</h4>
                    <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">{colTasks.length}</span>
                  </div>
                  <div className="space-y-2">
                    {colTasks.map(task => (
                      <Card key={task.id} className="shadow-sm">
                        <CardContent className="p-3 space-y-2">
                          <p className="text-sm font-medium">{task.title}</p>
                          {task.description && <p className="text-xs text-muted-foreground">{task.description}</p>}
                          <div className="flex items-center gap-2 flex-wrap">
                            <PriorityBadge priority={task.priority} />
                            <span className="text-[10px] text-muted-foreground">{task.category}</span>
                          </div>
                          {task.dueDate && <p className="text-[10px] text-muted-foreground">Due: {new Date(task.dueDate).toLocaleDateString()}</p>}
                          <div className="flex gap-1 pt-1 border-t flex-wrap">
                            {TASK_COLUMNS.filter(c => c.status !== task.status).map(c => (
                              <Button key={c.status} variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => handleTaskStatusChange(task.id, c.status)}>
                                {c.label}
                              </Button>
                            ))}
                            <Button variant="ghost" size="sm" className="h-6 px-2 text-destructive" onClick={() => handleDeleteTask(task.id)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {colTasks.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-8">No tasks</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="deliverables" className="mt-4">
          <div className="space-y-4">
            {stages.map(stage => {
              const stageDeliverables = deliverables.filter(d => d.stageId === stage.id);
              return (
                <Card key={stage.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="font-display text-sm">Stage {stage.stageNumber}: {stage.stageName}</CardTitle>
                      <StageStatusBadge status={stage.status} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    {stageDeliverables.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No deliverables</p>
                    ) : (
                      <div className="space-y-2">
                        {stageDeliverables.map(d => (
                          <div key={d.id} className="flex items-center gap-3 p-2 bg-muted/30 rounded text-sm">
                            <FileText className="w-4 h-4 text-secondary shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">{d.fileName}</p>
                              <p className="text-xs text-muted-foreground">{d.fileType}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OpsProjectDetail;
