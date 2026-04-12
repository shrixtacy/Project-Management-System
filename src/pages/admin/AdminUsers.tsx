import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getUsers, createUser, updateUser, addAuditLog, deleteUser } from '@/services/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Role } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, UserCheck, UserX, Trash2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

// Passwords are not stored in Supabase — we keep them in session memory only
// They persist until page refresh, giving the admin a chance to note them down
const sessionPasswords: Record<string, string> = {};

const AdminUsers = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: '' as Role | '' });
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

  if (!user) return null;

  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: () => getUsers() });

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.password || !form.role) {
      toast.error('All fields are required');
      return;
    }
    if (users.some(u => u.email === form.email)) {
      toast.error('Email already exists');
      return;
    }
    setCreating(true);
    try {
      const created = await createUser({ name: form.name, email: form.email, password: form.password, role: form.role as Role });
      // Store password in session memory keyed by user id
      if (created?.id) sessionPasswords[created.id] = form.password;
      await addAuditLog(user.id, user.name, null, 'Created user', 'User', form.name);
      toast.success(`User ${form.name} created successfully`);
      setOpen(false);
      setForm({ name: '', email: '', password: '', role: '' });
      setShowFormPassword(false);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = (u: typeof users[0]) => {
    updateUser(u.id, { isActive: !u.isActive });
    addAuditLog(user.id, user.name, null, u.isActive ? 'Deactivated user' : 'Activated user', 'User', u.name);
    toast.success(`User ${u.isActive ? 'deactivated' : 'activated'}`);
    queryClient.invalidateQueries({ queryKey: ['users'] });
  };

  const handleDelete = async (u: typeof users[0]) => {
    if (!window.confirm(`Delete ${u.name}? This cannot be undone.`)) return;
    try {
      await deleteUser(u.id);
      delete sessionPasswords[u.id];
      await addAuditLog(user.id, user.name, null, 'Deleted user', 'User', u.name);
      toast.success(`${u.name} deleted`);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete user');
    }
  };

  const toggleReveal = (id: string) => {
    setRevealedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const roleBadgeColor: Record<Role, string> = {
    ADMIN: 'bg-primary text-primary-foreground',
    DESIGNER: 'bg-secondary text-secondary-foreground',
    OPERATIONS: 'bg-status-pending text-status-pending-fg',
  };

  // Only show non-admin users in the table (admins can't be deleted)
  const displayUsers = users.filter(u => u.role !== 'ADMIN');
  const adminUsers = users.filter(u => u.role === 'ADMIN');

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
              <div>
                <Label>Password</Label>
                <div className="relative">
                  <Input
                    type={showFormPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowFormPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showFormPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <Label>Role</Label>
                <Select value={form.role} onValueChange={v => setForm({ ...form, role: v as Role })}>
                  <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DESIGNER">Designer</SelectItem>
                    <SelectItem value="OPERATIONS">Operations</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate} disabled={creating} className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90">
                {creating ? 'Creating...' : 'Create User'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Team members table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Password</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Admin rows — no delete, no password */}
              {adminUsers.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">—</TableCell>
                  <TableCell><Badge className={`text-[11px] border-0 ${roleBadgeColor[u.role]}`}>{u.role}</Badge></TableCell>
                  <TableCell><Badge variant="default" className="text-[11px]">Active</Badge></TableCell>
                  <TableCell />
                </TableRow>
              ))}
              {/* Designer / Operations rows */}
              {displayUsers.map(u => {
                const pwd = sessionPasswords[u.id];
                const revealed = revealedIds.has(u.id);
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      {pwd ? (
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-mono">{revealed ? pwd : '••••••••'}</span>
                          <button
                            type="button"
                            onClick={() => toggleReveal(u.id)}
                            className="text-muted-foreground hover:text-foreground transition-colors ml-1"
                          >
                            {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Set at creation</span>
                      )}
                    </TableCell>
                    <TableCell><Badge className={`text-[11px] border-0 ${roleBadgeColor[u.role]}`}>{u.role}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={u.isActive ? 'default' : 'secondary'} className="text-[11px]">
                        {u.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => toggleActive(u)} title={u.isActive ? 'Deactivate' : 'Activate'}>
                          {u.isActive
                            ? <UserX className="w-4 h-4 text-destructive" />
                            : <UserCheck className="w-4 h-4 text-green-500" />}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(u)} title="Delete User">
                          <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive transition-colors" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminUsers;
