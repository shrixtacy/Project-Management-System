import { useAuth } from '@/contexts/AuthContext';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '@/services/api';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { X, CheckCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface NotificationsPanelProps {
  onClose: () => void;
}

const NotificationsPanel = ({ onClose }: NotificationsPanelProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const { data: notifications = [] } = useQuery({ queryKey: ['notifications', user.id], queryFn: () => getNotifications(user.id) });

  const handleClick = (id: string, link: string | null) => {
    markNotificationRead(id);
    if (link) {
      navigate(link);
      onClose();
    }
  };

  return (
    <div className="absolute right-0 top-12 w-80 bg-card border rounded-lg shadow-lg z-50 max-h-96 flex flex-col">
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="font-display font-semibold text-sm">Notifications</h3>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => markAllNotificationsRead(user.id)}>
            <CheckCheck className="w-3 h-3 mr-1" /> Mark all
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>
      <div className="overflow-y-auto flex-1">
        {notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground p-4 text-center">No notifications</p>
        ) : (
          notifications.map(n => (
            <button
              key={n.id}
              onClick={() => handleClick(n.id, n.link)}
              className={`w-full text-left p-3 border-b last:border-0 hover:bg-muted/50 transition-colors ${!n.read ? 'bg-muted/30' : ''}`}
            >
              <p className="text-sm font-medium text-foreground">{n.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationsPanel;
