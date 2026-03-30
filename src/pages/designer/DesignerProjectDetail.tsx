import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  getProject, getStages, getDeliverables, getComments,
  addDeliverable, submitStageForApproval, addComment,
  initiateHandoff, addAuditLog, addNotification,
} from '@/services/api';
import StageStepper from '@/components/StageStepper';
import { StageStatusBadge } from '@/components/StatusBadges';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Upload, FileText, Send, ArrowRight, MessageSquare, Download } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { downloadDeliverable } from '@/utils/download';

const DesignerProjectDetail = () => {

  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [activeStageId, setActiveStageId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [comment, setComment] = useState('');
  const [showHandoff, setShowHandoff] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [, setRefresh] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: project } = useQuery({ queryKey: ['project', id], queryFn: () => getProject(id!) });
  
  const { data: stages = [] } = useQuery({ 
    queryKey: ['stages', id], 
    queryFn: () => getStages(id!),
    enabled: !!id
  });

  const activeStage = activeStageId ? stages.find(s => s.id === activeStageId) : stages.find(s => s.status === 'IN_PROGRESS') || stages[0];
  if (!activeStageId && activeStage) setTimeout(() => setActiveStageId(activeStage.id), 0);

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

  const allApproved = stages.every(s => s.status === 'APPROVED');
  const canHandoff = allApproved && project.status === 'DESIGN';

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !activeStage) return;

    setIsUploading(true);
    const toastId = toast.loading(`Uploading ${files.length} file(s)...`);

    try {
      const uploadPromises = Array.from(files).map(async file => {
        await addDeliverable({
          stageId: activeStage.id,
          file: file,
          uploadedBy: user.id,
          notes: notes || undefined,
        });
        await addAuditLog(user.id, user.name, id, `Uploaded ${file.name}`, 'Deliverable', activeStage.stageName);
      });

      await Promise.all(uploadPromises);
      
      setNotes('');
      toast.success(`${files.length} file(s) uploaded successfully`, { id: toastId });
      
      // Invalidate queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ['deliverables', activeStage.id] });
      queryClient.invalidateQueries({ queryKey: ['deliverablesByProject', id] });
      
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(`Upload failed: ${error.message}`, { id: toastId });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = () => {
    if (!activeStage || deliverables.length === 0) {
      toast.error('Upload at least one file before submitting');
      return;
    }
    submitStageForApproval(activeStage.id);
    addAuditLog(user.id, user.name, id, `Submitted Stage ${activeStage.stageNumber} for approval`, 'Stage', activeStage.stageName);
    // Notify all admins — for now just log
    addNotification(user.id, 'Stage Submitted', `You submitted Stage ${activeStage.stageNumber} for review.`, `/designer/projects/${id}`);
    toast.success('Stage submitted for approval');
    setRefresh(r => r + 1);
  };

  const handleHandoff = () => {
    const success = initiateHandoff(id, user.id, user.name);
    if (success) {
      toast.success('Project handed off to Operations');
      setShowHandoff(false);
      setRefresh(r => r + 1);
    } else {
      toast.error('All stages must be approved before handoff');
    }
  };

  const handleAddComment = () => {
    if (!comment.trim() || !activeStage) return;
    addComment({ stageId: activeStage.id, userId: user.id, userName: user.name, content: comment });
    setComment('');
    setRefresh(r => r + 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">{project.title}</h1>
          <p className="text-sm text-muted-foreground">{project.clientName} · {project.location}</p>
        </div>
        {canHandoff && (
          <Button onClick={() => setShowHandoff(true)} className="bg-status-approved text-status-approved-fg hover:bg-status-approved/90">
            <ArrowRight className="w-4 h-4 mr-2" /> Initiate P2P Handoff
          </Button>
        )}
      </div>

      {/* Stage Stepper */}
      <Card>
        <CardContent className="p-5">
          <StageStepper stages={stages} onStageClick={s => s.status !== 'LOCKED' && setActiveStageId(s.id)} activeStageId={activeStage?.id} />
        </CardContent>
      </Card>

      {activeStage && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-display text-base">Stage {activeStage.stageNumber}: {activeStage.stageName}</CardTitle>
                  <StageStatusBadge status={activeStage.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Upload zone (only for IN_PROGRESS) */}
                {activeStage.status === 'IN_PROGRESS' && (
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-secondary/50 transition-colors">
                    <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground mb-1">Drag & drop files or click to upload</p>
                    <p className="text-xs text-muted-foreground mb-3">PDF, JPG, PNG, DWG — Max 50MB</p>
                    <Input 
                      ref={fileInputRef} 
                      type="file" 
                      multiple 
                      accept=".pdf,.jpg,.jpeg,.png,.dwg" 
                      onChange={handleFileUpload} 
                      className="max-w-xs mx-auto" 
                      disabled={isUploading}
                    />
                    <div className="mt-3">
                      <Textarea 
                        placeholder="Optional notes for this upload..." 
                        value={notes} 
                        onChange={e => setNotes(e.target.value)} 
                        rows={2} 
                        className="max-w-sm mx-auto" 
                        disabled={isUploading}
                      />
                    </div>
                  </div>
                )}

                {/* Deliverables list */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2"><FileText className="w-4 h-4" /> Files ({deliverables.length})</h4>
                  {deliverables.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4 bg-muted/30 rounded">No files uploaded yet</p>
                  ) : (
                    deliverables.map(d => (
                      <div key={d.id} className="flex items-center justify-between p-3 bg-muted/30 rounded">
                        <div className="flex items-center gap-3">
                          <FileText className="w-4 h-4 text-secondary shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{d.fileName}</p>
                            <p className="text-xs text-muted-foreground">{d.fileType} · {formatDistanceToNow(new Date(d.uploadedAt), { addSuffix: true })}</p>
                            {d.notes && <p className="text-xs text-muted-foreground italic mt-0.5">{d.notes}</p>}
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => downloadDeliverable(d.fileUrl, d.fileName, d.fileType)}><Download className="w-4 h-4 text-muted-foreground" /></Button>
                      </div>
                    ))
                  )}
                </div>

                {/* Submit button */}
                {activeStage.status === 'IN_PROGRESS' && deliverables.length > 0 && (
                  <Button onClick={handleSubmit} className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
                    <Send className="w-4 h-4 mr-2" /> Submit for Approval
                  </Button>
                )}

                {activeStage.status === 'PENDING_APPROVAL' && (
                  <div className="bg-status-pending/10 border border-status-pending/30 rounded-lg p-4 text-center">
                    <p className="text-sm font-medium text-foreground">Awaiting admin review</p>
                    <p className="text-xs text-muted-foreground">You'll be notified when this stage is approved or needs revision.</p>
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
                  <p className="text-xs text-muted-foreground text-center py-4">No comments</p>
                ) : (
                  comments.map(c => (
                    <div key={c.id} className={`border-l-2 pl-3 py-1 ${c.content.startsWith('[REJECTED]') ? 'border-destructive' : 'border-border'}`}>
                      <p className="text-sm">{c.content}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{c.userName} · {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="space-y-2">
                <Textarea placeholder="Add a comment..." value={comment} onChange={e => setComment(e.target.value)} rows={2} />
                <Button size="sm" onClick={handleAddComment} disabled={!comment.trim()} className="bg-secondary text-secondary-foreground hover:bg-secondary/90">Post</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Handoff dialog */}
      <Dialog open={showHandoff} onOpenChange={setShowHandoff}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Confirm P2P Handoff</DialogTitle>
            <DialogDescription>All 6 design stages are approved. This will transfer the project to the Operations team.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {stages.map(s => (
              <div key={s.id} className="flex items-center gap-3 text-sm">
                <StageStatusBadge status={s.status} />
                <span>Stage {s.stageNumber}: {s.stageName}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowHandoff(false)}>Cancel</Button>
            <Button onClick={handleHandoff} className="bg-status-approved text-status-approved-fg hover:bg-status-approved/90">Confirm Handoff</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DesignerProjectDetail;
