import { AlertCircle, CalendarPlus, CalendarRange, Clock, Lightbulb, Scissors, Sparkles, UserPlus, UserRound, Users } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useModals } from '@/components/modals/ModalsContext';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { Panel, PanelHeader } from '@/components/ui/Misc';
import { useAuth } from '@/context/AuthContext';
import { useDashboard } from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDebounce';
import { cn } from '@/lib/cn';
import { formatDateLong, formatTime, greeting } from '@/lib/dates';
import { formatDuration, formatMoney, STATUS_STYLES } from '@/lib/format';
import type { Appointment, Dashboard, Insight } from '@/types';

type FlowItem = { kind: 'appointment'; time: string; appointment: Appointment } | { kind: 'open'; time: string; freeStaff: number };

function buildFlow(data: Dashboard): FlowItem[] {
  const items: FlowItem[] = [
    ...data.flow.map((appointment) => ({ kind: 'appointment' as const, time: appointment.startTime, appointment })),
    ...data.availableSlots.map((slot) => ({ kind: 'open' as const, time: slot.time, freeStaff: slot.freeStaff })),
  ];
  return items.sort((a, b) => a.time.localeCompare(b.time));
}

function SummaryBand({ data }: { data?: Dashboard }) {
  const { user, isAdmin } = useAuth();
  const s = data?.summary;
  const figures = [
    { label: 'Appointments today', value: s?.total },
    { label: 'Completed', value: s?.completed },
    { label: 'Pending confirmation', value: s?.pending },
    isAdmin
      ? { label: 'Revenue today', value: s?.revenue != null ? formatMoney(s.revenue, user?.currency) : undefined, small: true }
      : { label: 'Still to come', value: s?.remaining },
    { label: 'No-shows', value: s?.noShows },
  ];
  return (
    <Panel className="mb-6 overflow-hidden">
      {/* gap-px over a tinted background draws hairlines between the figures at any width */}
      <dl className="grid grid-cols-2 gap-px bg-sand/70 lg:grid-cols-5">
        {figures.map((f, i) => (
          <div key={f.label} className={cn('bg-[#fffdfb] px-5 py-5', i === figures.length - 1 && 'col-span-2 lg:col-span-1')}>
            <dd className={cn('font-display leading-none text-plum-900', f.small ? 'text-[2.2rem]' : 'text-5xl')}>
              {f.value === undefined ? <Skeleton className="h-9 w-16" /> : <span className="font-numeric">{f.value}</span>}
            </dd>
            <dt className="mt-2 text-sm text-ink-mute">{f.label}</dt>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

function TodaysFlow({ data }: { data: Dashboard }) {
  const modals = useModals();
  const { isAdmin } = useAuth();
  const items = useMemo(() => buildFlow(data), [data]);

  if (!items.length) {
    return (
      <EmptyState
        icon={<CalendarRange className="h-6 w-6" />}
        title="No appointments today"
        description="The day is wide open. Book someone in, or enjoy the quiet."
        action={isAdmin ? <Button onClick={() => modals.openBooking({ date: data.date })}>Create appointment</Button> : undefined}
      />
    );
  }

  return (
    <ol className="px-5 py-5">
      {items.map((item, index) => {
        const last = index === items.length - 1;
        return (
          <li key={`${item.kind}-${item.time}-${item.kind === 'appointment' ? item.appointment.id : 'open'}`} className="grid grid-cols-[3.6rem_1rem_minmax(0,1fr)] gap-x-3">
            <span className="font-numeric pt-2.5 text-right font-display text-xl leading-none text-plum-800">{formatTime(item.time).replace(' ', ' ')}</span>
            <span className="relative flex justify-center" aria-hidden>
              {!last && <span className="absolute bottom-[-0.5rem] top-5 w-px bg-champagne/60" />}
              {item.kind === 'appointment' ? (
                <span
                  className={cn(
                    'relative mt-3 h-3 w-3 rounded-full ring-4 ring-[#fffdfb]',
                    STATUS_STYLES[item.appointment.status].dot,
                    item.appointment.status === 'in_progress' && 'ring-berry-100',
                  )}
                />
              ) : (
                <span className="relative mt-3 h-3 w-3 rounded-full border-2 border-dashed border-champagne bg-[#fffdfb]" />
              )}
            </span>
            <div className="pb-3">
              {item.kind === 'appointment' ? (
                <button
                  type="button"
                  onClick={() => modals.openAppointment(item.appointment.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-2xl border border-sand/80 bg-white px-4 py-3 text-left transition-colors hover:border-mauve-300 hover:bg-lavender-50/60',
                    item.appointment.status === 'completed' && 'bg-cream/50',
                    item.appointment.status === 'no_show' && 'opacity-75',
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-plum-900">{item.appointment.customerName}</span>
                    <span className="block truncate text-[13px] text-ink-mute">
                      {item.appointment.serviceName} · {item.appointment.staffName} · {formatDuration(item.appointment.durationMinutes)}
                    </span>
                  </span>
                  <StatusBadge status={item.appointment.status} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => modals.openBooking({ date: data.date, startTime: item.time })}
                  disabled={!isAdmin}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-dashed border-champagne/80 px-4 py-3 text-left transition-colors hover:bg-champagne-100/50 disabled:cursor-default disabled:hover:bg-transparent"
                >
                  <span>
                    <span className="block font-medium text-champagne-600">Available</span>
                    <span className="block text-[13px] text-ink-mute">
                      {item.freeStaff} {item.freeStaff === 1 ? 'team member is' : 'team members are'} free
                    </span>
                  </span>
                  {isAdmin && <span className="text-sm font-medium text-plum-700">Book appointment</span>}
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const INSIGHT_ICON: Record<Insight['tone'], typeof Lightbulb> = { attention: AlertCircle, info: Users, positive: Sparkles };
const INSIGHT_TONE: Record<Insight['tone'], string> = {
  attention: 'bg-champagne-100 text-champagne-600',
  info: 'bg-lavender text-plum-700',
  positive: 'bg-sage-100 text-sage',
};

function Insights({ insights }: { insights: Insight[] }) {
  return (
    <ul className="divide-y divide-sand/60">
      {insights.map((insight) => {
        const Icon = INSIGHT_ICON[insight.tone];
        const body = (
          <>
            <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', INSIGHT_TONE[insight.tone])}>
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <span className="text-sm leading-snug text-ink">{insight.text}</span>
          </>
        );
        return (
          <li key={insight.id}>
            {insight.link ? (
              <Link to={insight.link} className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-lavender-50/70">
                {body}
              </Link>
            ) : (
              <div className="flex items-start gap-3 px-5 py-3.5">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default function DashboardPage() {
  useDocumentTitle('Dashboard');
  const { user, isAdmin } = useAuth();
  const modals = useModals();
  const query = useDashboard();
  const firstName = user?.name.split(' ')[0] ?? '';

  return (
    <>
      <header className="mb-7">
        <h1 className="font-display text-5xl leading-[1.05] text-plum-900 sm:text-6xl">
          {greeting()}, {firstName}.
        </h1>
        <p className="mt-2 text-[15px] text-ink-mute">{query.data ? formatDateLong(query.data.date) : ' '}</p>
      </header>

      {query.error && !query.data ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <>
          <SummaryBand data={query.data} />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <Panel>
              <PanelHeader
                title="Today’s flow"
                description="Tap an appointment for details, or an open hour to book it."
                action={
                  <Link to="/calendar" className="rounded-md text-sm font-medium text-plum-700 underline-offset-4 hover:underline">
                    Open calendar
                  </Link>
                }
              />
              {query.data ? (
                <TodaysFlow data={query.data} />
              ) : (
                <div className="space-y-3 p-5" role="status" aria-label="Loading today’s flow">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 rounded-2xl" />
                  ))}
                </div>
              )}
            </Panel>

            <div className="space-y-6">
              <Panel>
                <PanelHeader title="Quick actions" />
                <div className="grid grid-cols-2 gap-2.5 p-4">
                  {isAdmin ? (
                    <>
                      <Button className="h-auto flex-col gap-1.5 py-4" onClick={() => modals.openBooking()}>
                        <CalendarPlus className="h-5 w-5 text-champagne" aria-hidden />
                        New appointment
                      </Button>
                      <Button variant="soft" className="h-auto flex-col gap-1.5 py-4" onClick={() => modals.openCustomer()}>
                        <UserPlus className="h-5 w-5" aria-hidden />
                        Add customer
                      </Button>
                      <Button variant="soft" className="h-auto flex-col gap-1.5 py-4" onClick={() => modals.openService()}>
                        <Scissors className="h-5 w-5" aria-hidden />
                        Add service
                      </Button>
                      <Button variant="soft" className="h-auto flex-col gap-1.5 py-4" onClick={() => modals.openStaff()}>
                        <UserRound className="h-5 w-5" aria-hidden />
                        Add staff member
                      </Button>
                    </>
                  ) : (
                    <>
                      <Link to="/calendar" className="col-span-2">
                        <Button className="h-auto w-full flex-col gap-1.5 py-4">
                          <CalendarRange className="h-5 w-5 text-champagne" aria-hidden />
                          View my calendar
                        </Button>
                      </Link>
                      {user?.staffId && (
                        <Link to={`/staff/${user.staffId}`} className="col-span-2">
                          <Button variant="soft" className="h-auto w-full flex-col gap-1.5 py-4">
                            <Clock className="h-5 w-5" aria-hidden />
                            Set my availability
                          </Button>
                        </Link>
                      )}
                    </>
                  )}
                </div>
              </Panel>

              <Panel>
                <PanelHeader title="Smart insights" />
                {query.data ? (
                  <Insights insights={query.data.insights} />
                ) : (
                  <div className="space-y-3 p-5">
                    <Skeleton className="h-10" />
                    <Skeleton className="h-10" />
                  </div>
                )}
              </Panel>
            </div>
          </div>
        </>
      )}
    </>
  );
}
