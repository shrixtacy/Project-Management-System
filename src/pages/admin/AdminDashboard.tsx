import { useAuth } from '@/contexts/AuthContext';
import { getProjects, getUsers, getAuditLogs } from '@/services/api';
import { useNavigate } from 'react-router-dom';
import KPICard from '@/components/KPICard';
import { ProjectStatusBadge } from '@/components/StatusBadges';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { FolderKanban, Paintbrush, Hammer, CheckCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const projects = getProjects();
  const users = getUsers();
  const auditLogs = getAuditLogs().slice(0, 10);

  const designCount = projects.filter(p => p.status === 'DESIGN').length;
  const opsCount = projects.filter(p => p.status === 'OPERATIONS').length;
  const completedCount = projects.filter(p => p.status === 'COMPLETED').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of all projects and activity</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Projects" value={projects.length} subtitle={`${users.length} team members`} icon={<FolderKanban className="w-5 h-5" />} />
        <KPICard title="In Design" value={designCount} subtitle="Active design phase" icon={<Paintbrush className="w-5 h-5" />} />
        <KPICard title="In Operations" value={opsCount} subtitle="Execution phase" icon={<Hammer className="w-5 h-5" />} />
        <KPICard title="Completed" value={completedCount} subtitle="This month" icon={<CheckCircle className="w-5 h-5" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Projects Table */}
        <Card className="lg:col-span-2 glass-panel border-white/5">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-base">Recent Projects</CardTitle>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No projects yet. Create your first project.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.slice(0, 8).map(p => (
                    <TableRow key={p.id} className="cursor-pointer hover:bg-muted/10 transition-colors" onClick={() => navigate(`/admin/projects/${p.id}`)}>
                      <TableCell className="font-medium">{p.title}</TableCell>
                      <TableCell className="text-muted-foreground">{p.clientName}</TableCell>
                      <TableCell><ProjectStatusBadge status={p.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Audit Log */}
        <Card className="glass-panel border-white/5">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {auditLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No activity yet</p>
            ) : (
              <div className="space-y-3">
                {auditLogs.map(log => (
                  <div key={log.id} className="border-l-2 border-secondary pl-3 py-1">
                    <p className="text-sm text-foreground">{log.action}</p>
                    <p className="text-xs text-muted-foreground">{log.userName} · {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
