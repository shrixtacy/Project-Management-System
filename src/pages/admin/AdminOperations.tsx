import { getProjects, getUsers, getTasks } from '@/services/api';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { ProjectStatusBadge, TaskStatusBadge, PriorityBadge } from '@/components/StatusBadges';

const AdminOperations = () => {
  const navigate = useNavigate();
  const { data: allProjects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => getProjects() });
  const projects = allProjects.filter(p => p.status === 'OPERATIONS' || p.status === 'COMPLETED');
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: () => getUsers() });

  // Currently we skip fetching all tasks here to prevent fetching too many.
  // Real implementation should fetch from an endpoint.
  const allTasks: any[] = [];

  const getUserName = (id: string) => users.find(u => u.id === id)?.name || 'Unknown';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold text-foreground">Operations Overview</h1>
        <p className="text-sm text-muted-foreground">{projects.length} projects in operations</p>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="font-display text-base">Projects in Operations</CardTitle></CardHeader>
        <CardContent className="p-0">
          {projects.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No projects in operations phase</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Ops Lead</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map(p => (
                  <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/admin/projects/${p.id}`)}>
                    <TableCell className="font-medium">{p.title}</TableCell>
                    <TableCell>{p.clientName}</TableCell>
                    <TableCell>{getUserName(p.assignedOpsId)}</TableCell>
                    <TableCell><ProjectStatusBadge status={p.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {allTasks.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="font-display text-base">All Tasks</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allTasks.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.title}</TableCell>
                    <TableCell className="text-muted-foreground">{t.projectTitle}</TableCell>
                    <TableCell><PriorityBadge priority={t.priority} /></TableCell>
                    <TableCell><TaskStatusBadge status={t.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminOperations;
