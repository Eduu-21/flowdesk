import { Bell, CalendarCheck, CalendarPlus, CalendarX, Clock, Lightbulb, Wallet } from 'lucide-react';
import { cn } from '@/lib/cn';
import { timeAgo } from '@/lib/dates';
import type { NotificationItem } from '@/types';

const TYPE_STYLE: Record<NotificationItem['type'], { icon: typeof Bell; tone: string }> = {
  booking: { icon: CalendarPlus, tone: 'bg-lavender text-plum-700' },
  confirmation: { icon: CalendarCheck, tone: 'bg-sage-100 text-sage' },
  cancellation: { icon: CalendarX, tone: 'bg-rose-100 text-berry' },
  reminder: { icon: Clock, tone: 'bg-champagne-100 text-champagne-600' },
  payment: { icon: Wallet, tone: 'bg-sage-100 text-sage' },
  insight: { icon: Lightbulb, tone: 'bg-champagne-100 text-champagne-600' },
  system: { icon: Bell, tone: 'bg-mauve-100 text-plum-700' },
};

export function NotificationRow({ item, onOpen, compact }: { item: NotificationItem; onOpen: (item: NotificationItem) => void; compact?: boolean }) {
  const { icon: Icon, tone } = TYPE_STYLE[item.type] ?? TYPE_STYLE.system;
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={cn(
        'flex w-full items-start gap-3 text-left transition-colors hover:bg-lavender-50/80',
        compact ? 'rounded-xl px-3 py-2.5' : 'px-5 py-4',
        !item.isRead && 'bg-champagne-100/35',
      )}
    >
      <span className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full', tone)}>
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-sm text-plum-900', !item.isRead && 'font-semibold')}>
          {item.title}
          {!item.isRead && <span className="sr-only"> (unread)</span>}
        </span>
        {item.message && <span className="mt-0.5 block text-[13px] leading-snug text-ink-mute">{item.message}</span>}
        <span className="mt-1 block text-xs text-ink-mute">{timeAgo(item.createdAt)}</span>
      </span>
      {!item.isRead && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-berry" aria-hidden />}
    </button>
  );
}
