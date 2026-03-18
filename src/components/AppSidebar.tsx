import { useAuth } from '@/contexts/AuthContext';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FolderKanban, Users, Settings, Hammer,
  ChevronLeft, ChevronRight, FileText
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const AppSidebar = () => {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  if (!user) return null;

  const adminLinks = [
    { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/admin/projects', icon: FolderKanban, label: 'Projects' },
    { to: '/admin/operations', icon: Hammer, label: 'Operations' },
    { to: '/admin/users', icon: Users, label: 'Users' },
    { to: '/admin/reports', icon: FileText, label: 'Reports' },
    { to: '/admin/settings', icon: Settings, label: 'Settings' },
  ];

  const designerLinks = [
    { to: '/designer/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  ];

  const opsLinks = [
    { to: '/operations/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  ];

  const links = user.role === 'ADMIN' ? adminLinks : user.role === 'DESIGNER' ? designerLinks : opsLinks;

  return (
    <aside className={cn(
      "h-screen bg-sidebar text-sidebar-foreground flex flex-col transition-all duration-150 sticky top-0 rounded-r-3xl border-r border-white/5",
      collapsed ? "w-16" : "w-60"
    )}>
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-sidebar-border">
        <div className="w-8 h-8 bg-sidebar-primary rounded flex items-center justify-center shrink-0">
          <span className="text-sidebar-primary-foreground font-display font-bold text-sm">D</span>
        </div>
        {!collapsed && <span className="ml-3 font-display font-semibold text-sm truncate">DesignFlow</span>}
      </div>

      {/* Nav links */}
      <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
        {links.map(link => {
          const isActive = location.pathname.startsWith(link.to);
          return (
            <NavLink
              key={link.to}
              to={link.to}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-colors duration-150",
                "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
              activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
            >
              <link.icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span className="truncate">{link.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="h-10 flex items-center justify-center border-t border-sidebar-border text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  );
};

export default AppSidebar;
