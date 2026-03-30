import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const user = await login(email, password);
      if (user) {
        toast.success(`Welcome back, ${user.name}`);
        switch (user.role) {
          case 'ADMIN': navigate('/admin/dashboard'); break;
          case 'DESIGNER': navigate('/designer/dashboard'); break;
          case 'OPERATIONS': navigate('/operations/dashboard'); break;
        }
      } else {
        toast.error('Invalid email or password');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-primary-foreground font-display font-bold text-xl">V</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">Vedaraa PMS</h1>
          <p className="text-muted-foreground mt-1 font-body text-sm">Interior Design Project Management</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Sign In</CardTitle>
            <CardDescription>Enter your credentials to access your workspace</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@designco.com" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
              </div>
              <Button type="submit" className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>

            <div className="mt-6 border-t pt-4">
              <p className="text-xs text-muted-foreground mb-2">Demo accounts:</p>
              <div className="space-y-1 text-xs text-muted-foreground font-body">
                <p><span className="font-medium text-foreground">Admin:</span> admin@designco.com / admin123</p>
                <p><span className="font-medium text-foreground">Designer:</span> sarah@designco.com / designer123</p>
                <p><span className="font-medium text-foreground">Operations:</span> mike@designco.com / ops123</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;
