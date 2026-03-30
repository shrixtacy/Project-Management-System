import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getProjects, getUsers, createProject, addAuditLog, deleteProject } from '@/services/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ProjectStatusBadge } from '@/components/StatusBadges';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const AdminProjects = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', clientName: '', clientContact: '', location: '', assignedDesignerId: '', assignedOpsId: '' });

  if (!user) return null;

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => getProjects() });
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: () => getUsers() });
  const designers = users.filter(u => u.role === 'DESIGNER' && u.isActive);
  const opsUsers = users.filter(u => u.role === 'OPERATIONS' && u.isActive);

  const filtered = projects.filter(p => {
    const matchSearch = p.title.toLowerCase().includes(search.toLowerCase()) || p.clientName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleCreate = async () => {
    if (!form.title || !form.clientName || !form.assignedDesignerId || !form.assignedOpsId) {
      toast.error('Please fill in all required fields');
      return;
    }
    const project = await createProject(form);
    if (!project) {
        toast.error('Failed to create project');
        return;
    }
    addAuditLog(user.id, user.name, project.id, 'Created project', 'Project', project.title);
    toast.success('Project created successfully');
    setOpen(false);
    setForm({ title: '', clientName: '', clientContact: '', location: '', assignedDesignerId: '', assignedOpsId: '' });
    queryClient.invalidateQueries({ queryKey: ['projects'] });
  };

  const handleDelete = async (e: React.MouseEvent, p: typeof projects[0]) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to completely delete "${p.title}"? This cannot be undone and will delete all stages and deliverables.`)) return;
    const loadingToast = toast.loading('Deleting project...');
    try {
      await deleteProject(p.id);
      await addAuditLog(user.id, user.name, null, 'Deleted project', 'Project', p.title);
      toast.dismiss(loadingToast);
      toast.success('Project deleted');
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    } catch (err: any) {
      console.error('Delete project error:', err);
      toast.dismiss(loadingToast);
      toast.error(`Delete failed: ${err?.message || 'Unknown error'}`);
    }
  };

  const getUserName = (id: string) => users.find(u => u.id === id)?.name || 'Unassigned';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Projects</h1>
          <p className="text-sm text-muted-foreground">{projects.length} total projects</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
              <Plus className="w-4 h-4 mr-2" /> New Project
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">Create New Project</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div><Label>Project Title *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g., Modern Office Renovation" /></div>
              <div><Label>Client Name *</Label><Input value={form.clientName} onChange={e => setForm({ ...form, clientName: e.target.value })} placeholder="Client or company name" /></div>
              <div><Label>Client Contact</Label><Input value={form.clientContact} onChange={e => setForm({ ...form, clientContact: e.target.value })} placeholder="Email or phone" /></div>
              <div><Label>Location</Label><Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="City, State" /></div>
              <div>
                <Label>Assigned Designer *</Label>
                <Select value={form.assignedDesignerId} onValueChange={v => setForm({ ...form, assignedDesignerId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select designer" /></SelectTrigger>
                  <SelectContent>
                    {designers.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Assigned Ops *</Label>
                <Select value={form.assignedOpsId} onValueChange={v => setForm({ ...form, assignedOpsId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select ops user" /></SelectTrigger>
                  <SelectContent>
                    {opsUsers.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate} className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90">Create Project</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search projects..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="DESIGN">Design</SelectItem>
                <SelectItem value="OPERATIONS">Operations</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No projects found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Designer</TableHead>
                  <TableHead>Ops</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(p => (
                  <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/admin/projects/${p.id}`)}>
                    <TableCell className="font-medium">{p.title}</TableCell>
                    <TableCell>{p.clientName}</TableCell>
                    <TableCell className="text-muted-foreground">{p.location}</TableCell>
                    <TableCell>{getUserName(p.assignedDesignerId)}</TableCell>
                    <TableCell>{getUserName(p.assignedOpsId)}</TableCell>
                    <TableCell><ProjectStatusBadge status={p.status} /></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={(e) => handleDelete(e, p)} title="Delete Project">
                        <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive transition-colors" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminProjects;
