import { useState } from 'react';
import { getProjects, getStages } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProjectStatusBadge } from '@/components/StatusBadges';
import { FileText, Download, CheckCircle, Clock } from 'lucide-react';
import { Project, DesignStage } from '@/types';
import { format } from 'date-fns';

const AdminReports = () => {
  const projects = getProjects();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectStages, setProjectStages] = useState<DesignStage[]>([]);

  const handleSelectProject = (project: Project) => {
    setSelectedProject(project);
    setProjectStages(getStages(project.id));
  };

  const handleGenerateReport = (stage: DesignStage) => {
    // Mock report generation
    alert(`Generating Report for: ${selectedProject?.title} - ${stage.stageName}\nStatus: ${stage.status}\nCompleted At: ${stage.completedAt ? format(new Date(stage.completedAt), 'PPP') : 'N/A'}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold text-foreground">Project Reports</h1>
        <p className="text-sm text-muted-foreground">Generate phase-wise reports for any project</p>
      </div>

      {!selectedProject ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map(p => (
            <Card key={p.id} className="cursor-pointer hover:shadow-lg transition-all glass-panel" onClick={() => handleSelectProject(p)}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="space-y-1">
                    <h3 className="font-display font-semibold text-lg">{p.title}</h3>
                    <p className="text-sm text-muted-foreground">{p.clientName}</p>
                  </div>
                  <ProjectStatusBadge status={p.status} />
                </div>
                <div className="flex items-center text-sm text-primary">
                  <FileText className="w-4 h-4 mr-2" />
                  View Stages
                </div>
              </CardContent>
            </Card>
          ))}
          {projects.length === 0 && (
            <p className="text-muted-foreground col-span-3">No projects available for reporting.</p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <button onClick={() => setSelectedProject(null)} className="text-sm text-primary hover:underline mb-4">
            &larr; Back to all projects
          </button>
          
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{selectedProject.title} - Reports</span>
                <ProjectStatusBadge status={selectedProject.status} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {projectStages.map((stage) => (
                  <div key={stage.id} className="flex items-center justify-between p-4 rounded-lg bg-card/60 border">
                    <div className="flex items-center space-x-4">
                      <div className={`p-2 rounded-full ${stage.status === 'APPROVED' ? 'bg-status-approved/20 text-status-approved' : 'bg-muted text-muted-foreground'}`}>
                        {stage.status === 'APPROVED' ? <CheckCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                      </div>
                      <div>
                        <h4 className="font-semibold">{stage.stageNumber}. {stage.stageName}</h4>
                        <p className="text-sm text-muted-foreground">
                          Status: {stage.status} {stage.completedAt ? `· Completed on ${format(new Date(stage.completedAt), 'MMM d, yyyy')}` : ''}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleGenerateReport(stage)}
                      className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded text-sm flex items-center hover:bg-primary/90 transition-colors"
                      disabled={stage.status === 'LOCKED'}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Generate Report
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminReports;
