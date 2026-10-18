import { Bell, LogOut, Settings, ShieldCheck, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Dropdown } from '@/components/ui/Dropdown';
import { Avatar } from '@/components/ui/Misc';
import { useAuth, useUser } from '@/context/AuthContext';

export function ProfileMenu() {
  const user = useUser();
  const { logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  return (
    <Dropdown
      label="Profile menu"
      triggerClassName="gap-2 rounded-full p-0.5 pr-0.5 hover:ring-2 hover:ring-lavender-200 sm:rounded-xl sm:py-1 sm:pl-1 sm:pr-2.5 sm:hover:bg-lavender-50 sm:hover:ring-0"
      trigger={
        <>
          <Avatar name={user.name} src={user.avatarUrl} size="sm" color="#703a63" />
          <span className="hidden text-left sm:block">
            <span className="block max-w-[9rem] truncate text-sm font-medium leading-tight text-plum-900">{user.name}</span>
            <span className="block text-xs capitalize leading-tight text-ink-mute">{user.role === 'admin' ? 'Owner / admin' : 'Staff'}</span>
          </span>
        </>
      }
      header={
        <div className="mb-1 border-b border-sand/70 px-3 pb-2.5 pt-2">
          <p className="truncate text-sm font-medium text-plum-900">{user.name}</p>
          <p className="truncate text-xs text-ink-mute">{user.email}</p>
        </div>
      }
      items={[
        { label: 'My profile', icon: <UserRound className="h-4 w-4" />, to: '/settings/profile' },
        { label: 'Account settings', icon: <Settings className="h-4 w-4" />, to: isAdmin ? '/settings/studio' : '/settings/notifications' },
        { label: 'Notifications', icon: <Bell className="h-4 w-4" />, to: '/notifications' },
        { label: 'Security', icon: <ShieldCheck className="h-4 w-4" />, to: '/settings/security' },
        {
          label: 'Log out',
          icon: <LogOut className="h-4 w-4" />,
          separated: true,
          danger: true,
          onSelect: () => {
            void logout().then(() => navigate('/login', { replace: true }));
          },
        },
      ]}
    />
  );
}
