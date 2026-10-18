import { Bell, CheckCheck } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NotificationRow } from '@/components/NotificationRow';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { PageHeader, Panel, Tabs } from '@/components/ui/Misc';
import { useToast } from '@/context/ToastContext';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDebounce';
import { errorMessage } from '@/lib/api';
import type { NotificationItem } from '@/types';

type Filter = 'all' | 'unread';

export default function NotificationsPage() {
  useDocumentTitle('Notifications');
  const navigate = useNavigate();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>('all');
  const query = useNotifications(100);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const items = query.data?.data ?? [];
  const unread = query.data?.unreadCount ?? 0;
  const shown = filter === 'unread' ? items.filter((n) => !n.isRead) : items;

  const open = (item: NotificationItem) => {
    if (!item.isRead) markRead.mutate(item.id, { onError: (error) => toast.error(errorMessage(error)) });
    if (item.link) navigate(item.link);
  };

  const readAll = () =>
    markAll.mutate(undefined as never, {
      onSuccess: () => toast.success('All caught up'),
      onError: (error) => toast.error(errorMessage(error)),
    });

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Bookings, cancellations, reminders and gentle nudges."
        actions={
          <Button variant="secondary" icon={<CheckCheck className="h-4 w-4" />} onClick={readAll} loading={markAll.isPending} disabled={unread === 0}>
            Mark all as read
          </Button>
        }
      />

      <div className="mb-4">
        <Tabs
          label="Filter notifications"
          value={filter}
          onChange={setFilter}
          tabs={[
            { value: 'all', label: 'All', count: items.length },
            { value: 'unread', label: 'Unread', count: unread },
          ]}
        />
      </div>

      <Panel>
        {query.error && !query.data ? (
          <div className="p-5">
            <ErrorState error={query.error} onRetry={() => query.refetch()} />
          </div>
        ) : query.isLoading ? (
          <div className="space-y-3 p-5" role="status" aria-label="Loading notifications">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <EmptyState
            icon={<Bell className="h-6 w-6" />}
            title={filter === 'unread' ? 'You’re all caught up' : 'No notifications yet'}
            description={filter === 'unread' ? 'Nothing unread right now.' : 'New bookings and reminders will appear here.'}
            action={
              filter === 'unread' ? (
                <Button variant="secondary" onClick={() => setFilter('all')}>
                  Show all
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-sand/60">
            {shown.map((item) => (
              <li key={item.id}>
                <NotificationRow item={item} onOpen={open} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
