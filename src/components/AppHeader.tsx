import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Bell, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getUnreadCount } from '@/services/api';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import NotificationsPanel from '@/components/NotificationsPanel';

const AppHeader = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const { data: unread = 0 } = useQuery({ 
    queryKey: ['unread', user?.id], 
    queryFn: () => getUnreadCount(user!.id),
    enabled: !!user,
    refetchInterval: 2000 
  });

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const roleBadge = {
    ADMIN: 'Admin',
    DESIGNER: 'Designer',
    OPERATIONS: 'Operations',
  }[user.role];

  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <h2 className="font-display font-semibold text-foreground text-sm">
          {roleBadge} Panel
        </h2>
      </div>

      <div className="flex items-center gap-2">
        {/* Notification bell */}
        <div className="relative">
          <Button variant="ghost" size="icon" className="relative" onClick={() => setShowNotifications(!showNotifications)}>
            <Bell className="w-5 h-5 text-muted-foreground" />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-destructive text-destructive-foreground text-[10px] rounded-full flex items-center justify-center font-medium">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Button>
          {showNotifications && (
            <NotificationsPanel onClose={() => setShowNotifications(false)} />
          )}
        </div>

        {/* User info */}
        <div className="flex items-center gap-2 ml-2 pl-2 border-l">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-foreground leading-none">{user.name}</p>
            <p className="text-xs text-muted-foreground">{roleBadge}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout} title="Sign out">
            <LogOut className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
