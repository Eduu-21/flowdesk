import {
  BarChart3,
  Bell,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  Menu,
  Plus,
  Scissors,
  Settings,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ModalProvider } from '@/components/modals/ModalHost';
import { useModals } from '@/components/modals/ModalsContext';
import { Button } from '@/components/ui/Button';
import { Wordmark } from '@/components/Wordmark';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/hooks/queries';
import { cn } from '@/lib/cn';
import { FlowAssistant } from './FlowAssistant';
import { GlobalSearch } from './GlobalSearch';
import { NotificationsBell } from './NotificationsBell';
import { ProfileMenu } from './ProfileMenu';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  badge?: boolean;
}

const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/appointments', label: 'Appointments', icon: ClipboardList },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/services', label: 'Services', icon: Scissors },
  { to: '/staff', label: 'Staff', icon: UserRound },
  { to: '/analytics', label: 'Analytics', icon: BarChart3, adminOnly: true },
  { to: '/notifications', label: 'Notifications', icon: Bell, badge: true },
  { to: '/settings', label: 'Settings', icon: Settings },
];

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { isAdmin, user } = useAuth();
  const notifications = useNotifications(6);
  const unread = notifications.data?.unreadCount ?? 0;

  return (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-1 px-3">
      {NAV.filter((item) => !item.adminOnly || isAdmin).map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[15px] transition-colors',
              isActive ? 'bg-plum-800 text-ivory' : 'text-mauve-300 hover:bg-plum-800/60 hover:text-ivory',
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && <span className="absolute -left-3 top-2 bottom-2 w-1 rounded-r-full bg-champagne" aria-hidden />}
              <item.icon className={cn('h-[18px] w-[18px]', isActive ? 'text-champagne' : '')} aria-hidden />
              <span className="flex-1">{item.label}</span>
              {item.badge && unread > 0 && (
                <span className="rounded-full bg-champagne px-1.5 text-[11px] font-semibold text-plum-950" aria-label={`${unread} unread`}>
                  {unread}
                </span>
              )}
            </>
          )}
        </NavLink>
      ))}
      <div className="mt-auto px-3.5 pb-1 pt-6">
        <p className="truncate text-sm font-medium text-ivory">{user?.studioName}</p>
        <p className="text-xs text-mauve-300/80">{isAdmin ? 'Owner view' : 'Staff view'}</p>
      </div>
    </nav>
  );
}

function NewAppointmentButton() {
  const modals = useModals();
  return (
    <Button onClick={() => modals.openBooking()} icon={<Plus className="h-4 w-4" />} className="px-3 sm:px-4">
      <span className="hidden sm:inline">New appointment</span>
      <span className="sr-only sm:hidden">New appointment</span>
    </Button>
  );
}

function Shell() {
  const [drawer, setDrawer] = useState(false);
  const { isAdmin } = useAuth();
  const location = useLocation();

  useEffect(() => setDrawer(false), [location.pathname]);
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawer]);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      <a href="#main" className="sr-only z-[70] rounded-lg bg-white px-4 py-2 text-plum-800 focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to content
      </a>

      <aside className="sticky top-0 hidden h-screen flex-col bg-plum-900 py-7 lg:flex">
        <div className="mb-9 px-6">
          <Wordmark tone="light" />
        </div>
        <SidebarNav />
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-plum-950/55" onClick={() => setDrawer(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] animate-fade-in flex-col bg-plum-900 py-6" aria-label="Navigation menu">
            <div className="mb-8 flex items-center justify-between px-5">
              <Wordmark tone="light" />
              <button type="button" onClick={() => setDrawer(false)} aria-label="Close menu" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-mauve-300 hover:bg-plum-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarNav onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-sand/70 bg-ivory px-3 py-2.5 sm:gap-3 sm:px-8 lg:px-10">
          <button
            type="button"
            onClick={() => setDrawer(true)}
            aria-label="Open menu"
            aria-expanded={drawer}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-plum-800 hover:bg-lavender-50 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="shrink-0 lg:hidden">
            <Wordmark size="sm" className="hidden min-[420px]:inline-flex" />
          </div>
          <div className="flex min-w-0 flex-1 justify-center lg:justify-start">
            <GlobalSearch />
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {isAdmin && <NewAppointmentButton />}
            <NotificationsBell />
            <ProfileMenu />
          </div>
        </header>

        <main id="main" tabIndex={-1} className="flex-1 px-4 py-7 sm:px-8 lg:px-10">
          <div className="mx-auto max-w-[1240px]">
            <ErrorBoundary key={location.pathname}>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>

      {isAdmin && <FlowAssistant />}
    </div>
  );
}

export function AppLayout() {
  return (
    <ModalProvider>
      <Shell />
    </ModalProvider>
  );
}
