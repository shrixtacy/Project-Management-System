import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const AdminSettings = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">System configuration</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">General Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">System settings will be available when connected to a backend.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSettings;
