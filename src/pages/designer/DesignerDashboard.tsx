import { useAuth } from '@/contexts/AuthContext';
import { getProjects, getStages } from '@/services/api';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { StageStatusBadge, ProjectStatusBadge } from '@/components/StatusBadges';
import StageStepper from '@/components/StageStepper';

const DesignerDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const projects = getProjects('DESIGNER', user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold text-foreground">My Projects</h1>
        <p className="text-sm text-muted-foreground">{projects.length} assigned projects</p>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No projects assigned to you yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {projects.map(p => {
            const stages = getStages(p.id);
            return (
              <Card key={p.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/designer/projects/${p.id}`)}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-display font-semibold text-foreground">{p.title}</h3>
                      <p className="text-sm text-muted-foreground">{p.clientName} · {p.location}</p>
                    </div>
                    <ProjectStatusBadge status={p.status} />
                  </div>
                  <StageStepper stages={stages} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DesignerDashboard;
