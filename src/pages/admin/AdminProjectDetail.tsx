import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  getProject, getStages, getDeliverables, getComments,
  approveStage, rejectStage, addComment, addAuditLog, addNotification, getUsers,
} from '@/services/api';
import StageStepper from '@/components/StageStepper';
import { StageStatusBadge } from '@/components/StatusBadges';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Check, X, FileText, MessageSquare, Download } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { DesignStage } from '@/types';
import { downloadDeliverable } from '@/utils/download';

const AdminProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [activeStageId, setActiveStageId] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [, setRefresh] = useState(0);

  const { data: project } = useQuery({ queryKey: ['project', id], queryFn: () => getProject(id!) });
  
  const { data: stages = [] } = useQuery({ 
    queryKey: ['stages', id], 
    queryFn: () => getStages(id!),
    enabled: !!id
  });
  
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: () => getUsers() });
  
  const activeStage = activeStageId ? stages.find(s => s.id === activeStageId) : stages.find(s => s.status === 'IN_PROGRESS' || s.status === 'PENDING_APPROVAL') || stages[0];

  if (!activeStageId && activeStage) {
    setTimeout(() => setActiveStageId(activeStage.id), 0);
  }

  const { data: deliverables = [] } = useQuery({ 
    queryKey: ['deliverables', activeStage?.id], 
    queryFn: () => getDeliverables(activeStage!.id),
    enabled: !!activeStage
  });

  const { data: comments = [] } = useQuery({ 
    queryKey: ['comments', activeStage?.id], 
    queryFn: () => getComments(activeStage!.id),
    enabled: !!activeStage
  });

  if (!user || !id) return null;
  if (!project) return <div className="text-center py-12 text-muted-foreground">Loading or Project not found</div>;

  const handleApprove = (stage: DesignStage) => {
    approveStage(stage.id);
    addAuditLog(user.id, user.name, id, `Approved Stage ${stage.stageNumber}`, 'Stage', stage.stageName);
    addNotification(project.assignedDesignerId, 'Stage Approved', `Stage ${stage.stageNumber}: ${stage.stageName} has been approved.`, `/designer/projects/${id}`);
    toast.success(`Stage ${stage.stageNumber} approved`);
    setRefresh(r => r + 1);
  };

  const handleReject = (stage: DesignStage) => {
    if (!comment.trim()) {
      toast.error('Please add a comment explaining the rejection');
      return;
    }
    rejectStage(stage.id);
    addComment({ stageId: stage.id, userId: user.id, userName: user.name, content: `[REJECTED] ${comment}` });
    addAuditLog(user.id, user.name, id, `Rejected Stage ${stage.stageNumber}`, 'Stage', stage.stageName);
    addNotification(project.assignedDesignerId, 'Stage Rejected', `Stage ${stage.stageNumber}: ${stage.stageName} needs revision. Check comments.`, `/designer/projects/${id}`);
    setComment('');
    toast.info(`Stage ${stage.stageNumber} sent back for revision`);
    setRefresh(r => r + 1);
  };

  const handleAddComment = () => {
    if (!comment.trim() || !activeStage) return;
    addComment({ stageId: activeStage.id, userId: user.id, userName: user.name, content: comment });
    setComment('');
    setRefresh(r => r + 1);
  };

  const designerName = users.find(u => u.id === project.assignedDesignerId)?.name || 'Unknown';
  const opsName = users.find(u => u.id === project.assignedOpsId)?.name || 'Unknown';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-xl font-bold text-foreground">{project.title}</h1>
        <p className="text-sm text-muted-foreground">{project.clientName} · {project.location}</p>
        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
          <span>Designer: <span className="text-foreground font-medium">{designerName}</span></span>
          <span>Ops: <span className="text-foreground font-medium">{opsName}</span></span>
        </div>
      </div>

      {/* Stage Stepper */}
      <Card>
        <CardContent className="p-5">
          <StageStepper stages={stages} onStageClick={s => setActiveStageId(s.id)} activeStageId={activeStage?.id} />
        </CardContent>
      </Card>

      {/* Active Stage Detail */}
      {activeStage && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-display text-base">
                    Stage {activeStage.stageNumber}: {activeStage.stageName}
                  </CardTitle>
                  <StageStatusBadge status={activeStage.status} />
                </div>
              </CardHeader>
              <CardContent>
                {/* Deliverables */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Deliverables ({deliverables.length})
                  </h4>
                  {deliverables.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center bg-muted/30 rounded">No files uploaded yet</p>
                  ) : (
                    <div className="space-y-2">
                      {deliverables.map(d => (
                        <div key={d.id} className="flex items-center justify-between p-3 bg-muted/30 rounded">
                          <div className="flex items-center gap-3">
                            <FileText className="w-4 h-4 text-secondary" />
                            <div>
                              <p className="text-sm font-medium">{d.fileName}</p>
                              <p className="text-xs text-muted-foreground">{d.fileType} · {formatDistanceToNow(new Date(d.uploadedAt), { addSuffix: true })}</p>
                              {d.notes && <p className="text-xs text-muted-foreground mt-1 italic">{d.notes}</p>}
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => downloadDeliverable(d.fileUrl, d.fileName, d.fileType)}><Download className="w-4 h-4" /></Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Approval actions */}
                {activeStage.status === 'PENDING_APPROVAL' && (
                  <div className="mt-6 pt-4 border-t space-y-3">
                    <p className="text-sm font-medium text-foreground">Review & Decision</p>
                    <div className="flex gap-2">
                      <Button onClick={() => handleApprove(activeStage)} className="bg-status-approved text-status-approved-fg hover:bg-status-approved/90">
                        <Check className="w-4 h-4 mr-1" /> Approve
                      </Button>
                      <Button variant="outline" onClick={() => handleReject(activeStage)} className="border-destructive text-destructive hover:bg-destructive/10">
                        <X className="w-4 h-4 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Comments */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-base flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> Comments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-64 overflow-y-auto mb-4">
                {comments.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No comments yet</p>
                ) : (
                  comments.map(c => (
                    <div key={c.id} className="border-l-2 border-border pl-3 py-1">
                      <p className="text-sm">{c.content}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{c.userName} · {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="space-y-2">
                <Textarea placeholder="Add a comment..." value={comment} onChange={e => setComment(e.target.value)} rows={2} />
                <Button size="sm" onClick={handleAddComment} disabled={!comment.trim()} className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
                  Post Comment
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminProjectDetail;
