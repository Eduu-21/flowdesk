import { Bell } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { NotificationRow } from '@/components/NotificationRow';
import { Skeleton } from '@/components/ui/Feedback';
import { useToast } from '@/context/ToastContext';
import { useDismiss } from '@/hooks/useClickOutside';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '@/hooks/queries';
import { errorMessage } from '@/lib/api';
import type { NotificationItem } from '@/types';

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const toast = useToast();
  const { data, isLoading, error } = useNotifications(6);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, close, open);

  const unread = data?.unreadCount ?? 0;

  const openItem = (item: NotificationItem) => {
    setOpen(false);
    if (!item.isRead) markRead.mutate(item.id);
    navigate(item.link ?? '/notifications');
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-ink-soft hover:bg-lavender-50 hover:text-plum-800"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-berry px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div role="dialog" aria-label="Recent notifications" className="absolute right-[-3.5rem] z-40 mt-2 w-[min(24rem,calc(100vw-1.5rem))] animate-pop-in rounded-2xl border border-sand bg-[#fffdfb] shadow-pop sm:right-0">
          <div className="flex items-center justify-between border-b border-sand/70 px-4 py-3">
            <h2 className="font-display text-xl text-plum-900">Notifications</h2>
            <button
              type="button"
              disabled={!unread || markAll.isPending}
              onClick={() => markAll.mutate(undefined, { onError: (e) => toast.error(errorMessage(e)) })}
              className="rounded-md text-[13px] font-medium text-plum-600 hover:text-plum-800 disabled:text-ink-mute disabled:opacity-60"
            >
              Mark all as read
            </button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-1.5">
            {isLoading && (
              <div className="space-y-2 p-2">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            )}
            {error && <p className="px-3 py-6 text-center text-sm text-berry">{errorMessage(error)}</p>}
            {data && data.data.length === 0 && <p className="px-3 py-8 text-center text-sm text-ink-mute">No notifications yet.</p>}
            {data?.data.map((n) => <NotificationRow key={n.id} item={n} onOpen={openItem} compact />)}
          </div>
          <div className="border-t border-sand/70 p-2 text-center">
            <Link to="/notifications" onClick={() => setOpen(false)} className="inline-block rounded-lg px-3 py-1.5 text-sm font-medium text-plum-700 hover:bg-lavender-50">
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
