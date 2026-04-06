import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const KPICard = ({ title, value, subtitle, icon, iconBg }: { title: string; value: string | number; subtitle?: string; icon: React.ReactNode; iconBg?: string }) => (
  <Card className="glass-panel border-white/5">
    <CardContent className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground font-body">{title}</p>
          <p className="text-2xl font-display font-bold text-foreground mt-1">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg || 'bg-muted text-secondary'}`}>
          {icon}
        </div>
      </div>
    </CardContent>
  </Card>
);

export const KPICardSkeleton = () => (
  <Card>
    <CardContent className="p-5">
      <Skeleton className="h-4 w-24 mb-2" />
      <Skeleton className="h-8 w-16 mb-1" />
      <Skeleton className="h-3 w-32" />
    </CardContent>
  </Card>
);

export default KPICard;
