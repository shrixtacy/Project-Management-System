import { DesignStage } from '@/types';
import { Check, Lock, Loader2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StageStepperProps {
  stages: DesignStage[];
  onStageClick?: (stage: DesignStage) => void;
  activeStageId?: string;
}

const StageStatusIcon = ({ status }: { status: DesignStage['status'] }) => {
  switch (status) {
    case 'APPROVED': return <Check className="w-4 h-4" />;
    case 'IN_PROGRESS': return <Loader2 className="w-4 h-4" />;
    case 'PENDING_APPROVAL': return <Clock className="w-4 h-4" />;
    case 'LOCKED': return <Lock className="w-4 h-4" />;
  }
};

const statusColors: Record<string, string> = {
  APPROVED: 'bg-status-approved text-status-approved-fg',
  IN_PROGRESS: 'bg-status-active text-status-active-fg',
  PENDING_APPROVAL: 'bg-status-pending text-status-pending-fg',
  LOCKED: 'bg-status-locked text-status-locked-fg',
};

const lineColors: Record<string, string> = {
  APPROVED: 'bg-status-approved',
  IN_PROGRESS: 'bg-status-active',
  PENDING_APPROVAL: 'bg-status-pending',
  LOCKED: 'bg-border',
};

const StageStepper = ({ stages, onStageClick, activeStageId }: StageStepperProps) => {
  return (
    <div className="flex items-center w-full overflow-x-auto pb-2">
      {stages.map((stage, i) => (
        <div key={stage.id} className="flex items-center flex-1 min-w-0">
          <button
            onClick={() => onStageClick?.(stage)}
            disabled={stage.status === 'LOCKED'}
            className={cn(
              "flex flex-col items-center gap-1.5 min-w-0 group",
              stage.status !== 'LOCKED' && 'cursor-pointer',
              activeStageId === stage.id && 'scale-105'
            )}
          >
            <div className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-150 shrink-0",
              statusColors[stage.status],
              activeStageId === stage.id && 'ring-2 ring-offset-2 ring-secondary'
            )}>
              <StageStatusIcon status={stage.status} />
            </div>
            <span className="text-[11px] text-muted-foreground font-body text-center leading-tight truncate max-w-[80px]">
              Stage {stage.stageNumber}
            </span>
          </button>
          {i < stages.length - 1 && (
            <div className={cn("flex-1 h-0.5 mx-1", lineColors[stage.status])} />
          )}
        </div>
      ))}
    </div>
  );
};

export default StageStepper;
