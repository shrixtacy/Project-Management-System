import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getUsers, createUser, updateUser, addAuditLog } from '@/services/api';
import { Role } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, UserCheck, UserX } from 'lucide-react';
import { toast } from 'sonner';

const AdminUsers = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: '' as Role | '' });
  const [, setRefresh] = useState(0);

  if (!user) return null;

  const users = getUsers();

  const handleCreate = () => {
    if (!form.name || !form.email || !form.password || !form.role) {
      toast.error('All fields are required');
      return;
    }
    if (users.some(u => u.email === form.email)) {
      toast.error('Email already exists');
      return;
    }
    createUser({ name: form.name, email: form.email, password: form.password, role: form.role as Role });
    addAuditLog(user.id, user.name, null, 'Created user', 'User', form.name);
    toast.success('User created');
    setOpen(false);
    setForm({ name: '', email: '', password: '', role: '' });
    setRefresh(r => r + 1);
  };

  const toggleActive = (u: typeof users[0]) => {
    updateUser(u.id, { isActive: !u.isActive });
    addAuditLog(user.id, user.name, null, u.isActive ? 'Deactivated user' : 'Activated user', 'User', u.name);
    toast.success(`User ${u.isActive ? 'deactivated' : 'activated'}`);
    setRefresh(r => r + 1);
  };

  const roleBadgeColor: Record<Role, string> = {
    ADMIN: 'bg-primary text-primary-foreground',
    DESIGNER: 'bg-secondary text-secondary-foreground',
    OPERATIONS: 'bg-status-pending text-status-pending-fg',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Users</h1>
          <p className="text-sm text-muted-foreground">{users.length} team members</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
              <Plus className="w-4 h-4 mr-2" /> Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">Add New User</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Password</Label><Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>
              <div>
                <Label>Role</Label>
                <Select value={form.role} onValueChange={v => setForm({ ...form, role: v as Role })}>
                  <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="DESIGNER">Designer</SelectItem>
                    <SelectItem value="OPERATIONS">Operations</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate} className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90">Create User</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell><Badge className={`text-[11px] border-0 ${roleBadgeColor[u.role]}`}>{u.role}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={u.isActive ? 'default' : 'secondary'} className="text-[11px]">
                      {u.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(u)}>
                      {u.isActive ? <UserX className="w-4 h-4 text-destructive" /> : <UserCheck className="w-4 h-4 text-status-approved" />}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminUsers;
