import { useAuth } from '@/contexts/AuthContext';
import { getProjects, getStages } from '@/services/api';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { ProjectStatusBadge } from '@/components/StatusBadges';
import { Badge } from '@/components/ui/badge';

const OpsDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const { data: projects = [] } = useQuery({ queryKey: ['projects', 'OPERATIONS', user.id], queryFn: () => getProjects('OPERATIONS', user.id) });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold text-foreground">Operations Dashboard</h1>
        <p className="text-sm text-muted-foreground">{projects.length} projects assigned</p>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No projects have been handed off to you yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map(p => (
            <Card key={p.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/operations/projects/${p.id}`)}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-display font-semibold text-foreground">{p.title}</h3>
                    <p className="text-sm text-muted-foreground">{p.clientName} · {p.location}</p>
                  </div>
                  <ProjectStatusBadge status={p.status} />
                </div>
                {!p.handoffAcknowledged && (
                  <Badge className="mt-2 bg-status-pending text-status-pending-fg border-0 text-xs">
                    Action Required: Acknowledge Handoff
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default OpsDashboard;
