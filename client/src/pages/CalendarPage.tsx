import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useModals } from '@/components/modals/ModalsContext';
import { Button, IconButton } from '@/components/ui/Button';
import { ErrorState, Skeleton } from '@/components/ui/Feedback';
import { Checkbox, Select } from '@/components/ui/Form';
import { PageHeader, Panel, Tabs } from '@/components/ui/Misc';
import { useAuth } from '@/context/AuthContext';
import { useAppointments, useStaffList } from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDebounce';
import { layoutDay } from '@/lib/calendarLayout';
import { cn } from '@/lib/cn';
import {
  addDays,
  addMonths,
  formatDate,
  formatTime,
  fromMinutes,
  nowMinutes,
  startOfMonth,
  startOfWeek,
  toMinutes,
  todayIn,
} from '@/lib/dates';
import { STATUS_LABELS } from '@/lib/format';
import type { Appointment, Staff } from '@/types';

type View = 'day' | 'week' | 'month';

const HOUR_HEIGHT = 60;
const FIRST_HOUR = 8;
const LAST_HOUR = 20;

interface Column {
  key: string;
  title: string;
  subtitle?: string;
  date: string;
  staffId?: string;
  isToday: boolean;
}

function EventBlock({ appointment, onOpen, top, height, lane, lanes }: { appointment: Appointment; onOpen: () => void; top: number; height: number; lane: number; lanes: number }) {
  const muted = appointment.status === 'cancelled' || appointment.status === 'no_show';
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      aria-label={`${formatTime(appointment.startTime)} ${appointment.customerName}, ${appointment.serviceName}, ${STATUS_LABELS[appointment.status]}`}
      className={cn(
        'absolute overflow-hidden rounded-lg border-l-[3px] px-1.5 py-1 text-left text-[12px] leading-tight shadow-sm transition-[filter] hover:brightness-95',
        muted && 'opacity-55',
      )}
      style={{
        top,
        height: Math.max(height - 2, 22),
        left: `calc(${(lane / lanes) * 100}% + 2px)`,
        width: `calc(${100 / lanes}% - 4px)`,
        borderLeftColor: appointment.staffColor,
        backgroundColor: `${appointment.staffColor}22`,
      }}
    >
      <span className={cn('block truncate font-medium text-plum-900', muted && 'line-through')}>{appointment.customerName}</span>
      <span className="block truncate text-ink-soft">{appointment.serviceName}</span>
      {height > 52 && <span className="font-numeric block truncate text-ink-mute">{formatTime(appointment.startTime)}</span>}
    </button>
  );
}

function TimeGrid({
  columns,
  events,
  canBook,
  onBook,
  onOpen,
  timezone,
  minWidth,
}: {
  columns: Column[];
  events: Appointment[];
  canBook: boolean;
  onBook: (column: Column, time: string) => void;
  onOpen: (a: Appointment) => void;
  timezone: string;
  minWidth: number;
}) {
  const hours = Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, i) => FIRST_HOUR + i);
  const total = (LAST_HOUR - FIRST_HOUR) * HOUR_HEIGHT;
  const now = nowMinutes(timezone);
  const byColumn = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const c of columns) {
      map.set(
        c.key,
        events.filter((e) => e.date === c.date && (!c.staffId || e.staffId === c.staffId)),
      );
    }
    return map;
  }, [columns, events]);

  return (
    <div className="scroll-thin overflow-x-auto">
      <div style={{ minWidth }}>
        <div className="grid border-b border-sand/80" style={{ gridTemplateColumns: `3.5rem repeat(${columns.length}, minmax(0, 1fr))` }}>
          <div />
          {columns.map((c) => (
            <div key={c.key} className={cn('border-l border-sand/60 px-2 py-2.5 text-center', c.isToday && 'bg-champagne-100/50')}>
              <p className={cn('text-sm font-medium', c.isToday ? 'text-plum-800' : 'text-plum-900')}>{c.title}</p>
              {c.subtitle && <p className="text-xs text-ink-mute">{c.subtitle}</p>}
            </div>
          ))}
        </div>
        <div className="grid" style={{ gridTemplateColumns: `3.5rem repeat(${columns.length}, minmax(0, 1fr))` }}>
          <div className="relative" style={{ height: total }}>
            {hours.map((h, i) => (
              <span key={h} className="font-numeric absolute right-2 -translate-y-1/2 text-[11px] text-ink-mute" style={{ top: i * HOUR_HEIGHT, display: i === 0 ? 'none' : undefined }}>
                {formatTime(fromMinutes(h * 60)).replace(':00', '')}
              </span>
            ))}
          </div>
          {columns.map((c) => {
            const placed = layoutDay(byColumn.get(c.key) ?? []);
            return (
              <div
                key={c.key}
                className={cn('relative border-l border-sand/60', c.isToday && 'bg-champagne-100/25', canBook && 'cursor-cell')}
                style={{ height: total }}
                onClick={(e) => {
                  if (!canBook) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const minutes = FIRST_HOUR * 60 + Math.floor(((e.clientY - rect.top) / HOUR_HEIGHT) * 2) * 30;
                  onBook(c, fromMinutes(Math.min(minutes, LAST_HOUR * 60 - 30)));
                }}
              >
                {hours.map((h, i) => (
                  <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-sand/50" style={{ top: i * HOUR_HEIGHT }} />
                ))}
                {c.isToday && now >= FIRST_HOUR * 60 && now <= LAST_HOUR * 60 && (
                  <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: ((now - FIRST_HOUR * 60) / 60) * HOUR_HEIGHT }}>
                    <span className="-ml-1 h-2 w-2 rounded-full bg-berry" />
                    <span className="h-px flex-1 bg-berry" />
                  </div>
                )}
                {placed.map(({ item, lane, lanes }) => (
                  <EventBlock
                    key={item.id}
                    appointment={item}
                    onOpen={() => onOpen(item)}
                    top={((toMinutes(item.startTime) - FIRST_HOUR * 60) / 60) * HOUR_HEIGHT}
                    height={(item.durationMinutes / 60) * HOUR_HEIGHT}
                    lane={lane}
                    lanes={lanes}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MonthGrid({
  anchor,
  today,
  events,
  onOpenDay,
  onOpen,
}: {
  anchor: string;
  today: string;
  events: Appointment[];
  onOpenDay: (date: string) => void;
  onOpen: (a: Appointment) => void;
}) {
  const first = startOfWeek(startOfMonth(anchor));
  const days = Array.from({ length: 42 }, (_, i) => addDays(first, i));
  const byDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const e of events) map.set(e.date, [...(map.get(e.date) ?? []), e]);
    return map;
  }, [events]);

  return (
    <div>
      <div className="grid grid-cols-7 border-b border-sand/80 text-center text-xs text-ink-mute">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="py-2.5">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((date) => {
          const items = byDate.get(date) ?? [];
          const inMonth = date.slice(0, 7) === anchor.slice(0, 7);
          return (
            <div
              key={date}
              className={cn('relative min-h-[4.5rem] border-b border-l border-sand/60 p-1.5 sm:min-h-[7.5rem] sm:p-2', !inMonth && 'bg-cream/50', date === today && 'bg-champagne-100/40')}
            >
              <button
                type="button"
                onClick={() => onOpenDay(date)}
                aria-label={`${formatDate(date, { weekday: 'long', month: 'long', day: 'numeric' })}, ${items.length} appointments`}
                className="absolute inset-0 z-0 rounded-sm"
              />
              <span className={cn('relative z-[1] pointer-events-none inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs', date === today ? 'bg-plum-700 font-medium text-ivory' : inMonth ? 'text-plum-900' : 'text-ink-mute')}>
                {Number(date.slice(8))}
              </span>
              <div className="pointer-events-none relative z-[1] mt-1 hidden space-y-1 sm:block">
                {items.slice(0, 3).map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onOpen(a)}
                    className={cn(
                      'pointer-events-auto flex w-full items-center gap-1.5 truncate rounded-md px-1.5 py-0.5 text-left text-[11px] hover:brightness-95',
                      (a.status === 'cancelled' || a.status === 'no_show') && 'opacity-55 line-through',
                    )}
                    style={{ backgroundColor: `${a.staffColor}22` }}
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: a.staffColor }} />
                    <span className="font-numeric text-ink-mute">{formatTime(a.startTime).replace(' ', '').toLowerCase()}</span>
                    <span className="truncate text-plum-900">{a.customerName.split(' ')[0]}</span>
                  </button>
                ))}
                {items.length > 3 && (
                  <button type="button" onClick={() => onOpenDay(date)} className="pointer-events-auto px-1.5 text-[11px] font-medium text-plum-600 hover:underline">
                    +{items.length - 3} more
                  </button>
                )}
              </div>
              {items.length > 0 && (
                <span className="pointer-events-none relative z-[1] mt-1 block text-[11px] font-medium text-plum-600 sm:hidden">{items.length}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CalendarPage() {
  useDocumentTitle('Calendar');
  const { user, isAdmin } = useAuth();
  const modals = useModals();
  const [params, setParams] = useSearchParams();
  const today = todayIn(user?.timezone);
  const [showCancelled, setShowCancelled] = useState(false);
  const [staffFilter, setStaffFilter] = useState('');

  const defaultView: View = typeof window !== 'undefined' && window.innerWidth < 640 ? 'day' : 'week';
  const view = (['day', 'week', 'month'].includes(params.get('view') ?? '') ? params.get('view') : defaultView) as View;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') ?? '') ? params.get('date')! : today;

  const setView = (v: View, d = date) => setParams({ view: v, date: d }, { replace: true });
  const go = (direction: -1 | 1) => {
    const next = view === 'day' ? addDays(date, direction) : view === 'week' ? addDays(date, 7 * direction) : addMonths(date, direction);
    setView(view, next);
  };

  const range = useMemo(() => {
    if (view === 'day') return { from: date, to: date };
    if (view === 'week') return { from: startOfWeek(date), to: addDays(startOfWeek(date), 6) };
    const from = startOfWeek(startOfMonth(date));
    return { from, to: addDays(from, 41) };
  }, [view, date]);

  const staffQuery = useStaffList({ status: 'active' });
  const staffList: Staff[] = useMemo(() => {
    const all = staffQuery.data?.data ?? [];
    if (!isAdmin) return all.filter((s) => s.id === user?.staffId);
    return staffFilter ? all.filter((s) => s.id === staffFilter) : all;
  }, [staffQuery.data, staffFilter, isAdmin, user?.staffId]);

  const appointments = useAppointments({
    from: range.from,
    to: range.to,
    pageSize: 500,
    sort: 'date',
    order: 'asc',
    staffId: isAdmin ? staffFilter : undefined,
  });
  const events = useMemo(
    () => (appointments.data?.data ?? []).filter((a) => showCancelled || (a.status !== 'cancelled' && a.status !== 'no_show')),
    [appointments.data, showCancelled],
  );

  const columns: Column[] = useMemo(() => {
    if (view === 'day') {
      return staffList.map((s) => ({ key: s.id, title: s.name.split(' ')[0], subtitle: s.roleTitle, date, staffId: s.id, isToday: date === today }));
    }
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(range.from, i);
      return { key: d, title: formatDate(d, { weekday: 'short' }), subtitle: formatDate(d, { month: 'short', day: 'numeric' }), date: d, isToday: d === today };
    });
  }, [view, staffList, date, today, range.from]);

  const title =
    view === 'day'
      ? formatDate(date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
      : view === 'week'
        ? `${formatDate(range.from, { month: 'short', day: 'numeric' })} – ${formatDate(range.to, { month: 'short', day: 'numeric', year: 'numeric' })}`
        : formatDate(date, { month: 'long', year: 'numeric' });

  const openBooking = (column: Column, time: string) => {
    if (column.date < today) return;
    modals.openBooking({ date: column.date, startTime: time, staffId: column.staffId });
  };

  return (
    <>
      <PageHeader
        title="Calendar"
        description="See the whole studio at a glance. Click an appointment to manage it, or an empty slot to book."
        actions={
          isAdmin && (
            <Button onClick={() => modals.openBooking({ date: view === 'day' ? date : undefined })} icon={<Plus className="h-4 w-4" />}>
              New appointment
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-3">
        <div className="flex items-center gap-1">
          <IconButton label={`Previous ${view}`} onClick={() => go(-1)}>
            <ChevronLeft className="h-5 w-5" />
          </IconButton>
          <IconButton label={`Next ${view}`} onClick={() => go(1)}>
            <ChevronRight className="h-5 w-5" />
          </IconButton>
          <Button variant="secondary" size="sm" onClick={() => setView(view, today)}>
            Today
          </Button>
        </div>
        <h2 className="font-display text-2xl text-plum-900" aria-live="polite">
          {title}
        </h2>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          {isAdmin && (
            <>
              <label htmlFor="calendar-staff" className="sr-only">
                Filter by staff member
              </label>
              <Select id="calendar-staff" value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)} className="w-44">
                <option value="">All staff</option>
                {staffQuery.data?.data.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </>
          )}
          <Checkbox label="Show cancelled" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} />
          <Tabs
            label="Calendar view"
            value={view}
            onChange={(v) => setView(v)}
            tabs={[
              { value: 'day', label: 'Day' },
              { value: 'week', label: 'Week' },
              { value: 'month', label: 'Month' },
            ]}
          />
        </div>
      </div>

      {appointments.error && !appointments.data ? (
        <ErrorState error={appointments.error} onRetry={() => appointments.refetch()} />
      ) : (
        <Panel className="overflow-hidden">
          {appointments.isLoading || staffQuery.isLoading ? (
            <div className="space-y-2 p-5" role="status" aria-label="Loading calendar">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : view === 'month' ? (
            <MonthGrid
              anchor={date}
              today={today}
              events={events}
              onOpenDay={(d) => setView('day', d)}
              onOpen={(a) => modals.openAppointment(a.id)}
            />
          ) : columns.length === 0 ? (
            <p className="px-6 py-14 text-center text-sm text-ink-mute">There are no active staff members to show. Add a team member to start scheduling.</p>
          ) : (
            <TimeGrid
              columns={columns}
              events={events}
              canBook={isAdmin}
              onBook={openBooking}
              onOpen={(a) => modals.openAppointment(a.id)}
              timezone={user?.timezone ?? 'UTC'}
              minWidth={view === 'week' ? 760 : Math.max(520, columns.length * 150 + 56)}
            />
          )}
        </Panel>
      )}

      {!appointments.isLoading && events.length === 0 && !appointments.error && (
        <p className="mt-3 text-center text-sm text-ink-mute">No appointments in this {view}.</p>
      )}

      {(view === 'week' || view === 'month') && staffQuery.data && staffQuery.data.data.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-ink-soft" aria-label="Staff colours">
          {staffQuery.data.data.map((s) => (
            <li key={s.id} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.avatarColor }} aria-hidden />
              {s.name}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
