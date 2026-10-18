import { BarChart3 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Avatar, PageHeader, Panel, PanelHeader, Tabs } from '@/components/ui/Misc';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { useAuth } from '@/context/AuthContext';
import { useAnalytics } from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDebounce';
import { formatDate, formatDateTime } from '@/lib/dates';
import { formatMoney, METHOD_LABELS, PAYMENT_LABELS, STATUS_LABELS } from '@/lib/format';
import type { Analytics, AppointmentStatus } from '@/types';

const COLORS = {
  plum: '#5b2a50',
  rose: '#c98f97',
  mauve: '#a67c9c',
  lavender: '#d3c5e2',
  champagne: '#c4a265',
  sage: '#587a5f',
  berry: '#8c3b62',
  grid: '#e6dacd',
  axis: '#6f6475',
};

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  pending: COLORS.champagne,
  confirmed: '#8a4f7c',
  checked_in: COLORS.mauve,
  in_progress: COLORS.berry,
  completed: COLORS.sage,
  cancelled: '#c9bcae',
  no_show: COLORS.rose,
};

type RangeKey = '7' | '30' | '90';
type Granularity = 'daily' | 'weekly' | 'monthly';

function ChartTooltip({ active, payload, label, currency, unit }: { active?: boolean; payload?: { value: number; name?: string }[]; label?: string; currency?: string; unit?: string }) {
  if (!active || !payload?.length) return null;
  const value = payload[0].value;
  return (
    <div className="rounded-xl border border-sand bg-[#fffdfb] px-3 py-2 text-sm shadow-pop">
      {label && <p className="text-[13px] text-ink-mute">{label}</p>}
      <p className="font-numeric font-medium text-plum-900">{currency ? formatMoney(value, currency) : `${value}${unit ? ` ${unit}` : ''}`}</p>
    </div>
  );
}

function Figure({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="bg-[#fffdfb] px-5 py-5">
      <dd className="font-display text-4xl leading-none text-plum-900">
        <span className="font-numeric">{value}</span>
      </dd>
      <dt className="mt-2 text-sm text-ink-mute">{label}</dt>
      {hint && <p className="mt-0.5 text-xs text-ink-mute">{hint}</p>}
    </div>
  );
}

function Bars({ rows }: { rows: { label: string; value: number; display: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3 px-5 py-5">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-ink">{row.label}</span>
            <span className="font-numeric shrink-0 text-ink-soft">{row.display}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-cream" role="presentation">
            <div className="h-full rounded-full bg-plum-600" style={{ width: `${Math.max(3, (row.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Content({ data, currency }: { data: Analytics; currency: string }) {
  const [granularity, setGranularity] = useState<Granularity>('daily');
  const { totals } = data;

  const revenueSeries = data.revenue[granularity].map((p) => ({ label: p.label, revenue: p.revenue }));
  const statusRows = data.appointmentsByStatus.filter((s) => s.count > 0);
  const statusTotal = statusRows.reduce((sum, s) => sum + s.count, 0);
  const customerTotal = data.customers.new + data.customers.returning + data.customers.inactive;

  return (
    <div className="space-y-6">
      <Panel className="overflow-hidden">
        <dl className="grid grid-cols-2 gap-px bg-sand/70 lg:grid-cols-4">
          <Figure label="Revenue" value={formatMoney(totals.revenue, currency)} hint="From paid appointments" />
          <Figure label="Appointments" value={totals.appointments} hint={`${totals.upcoming} still to come`} />
          <Figure label="Completed" value={totals.completed} hint={`${totals.cancelled} cancelled · ${totals.noShow} no-shows`} />
          <Figure label="Average ticket" value={formatMoney(totals.averageTicket, currency)} hint="Per completed visit" />
        </dl>
      </Panel>

      <Panel>
        <PanelHeader
          title="Revenue"
          description={`${formatDate(data.range.from)} – ${formatDate(data.range.to)}`}
          action={
            <Tabs
              label="Revenue grouping"
              value={granularity}
              onChange={setGranularity}
              tabs={[
                { value: 'daily', label: 'Daily' },
                { value: 'weekly', label: 'Weekly' },
                { value: 'monthly', label: 'Monthly' },
              ]}
            />
          }
        />
        <div className="h-72 px-3 py-5 sm:px-5" role="img" aria-label={`${granularity} revenue chart`}>
          {revenueSeries.length === 0 ? (
            <p className="py-20 text-center text-sm text-ink-mute">No revenue in this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueSeries} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS.plum} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={COLORS.plum} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 4" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: COLORS.axis, fontSize: 12 }} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis
                  tick={{ fill: COLORS.axis, fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={52}
                  tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                />
                <Tooltip content={<ChartTooltip currency={currency} />} cursor={{ stroke: COLORS.mauve, strokeDasharray: '3 3' }} />
                <Area type="monotone" dataKey="revenue" stroke={COLORS.plum} strokeWidth={2.5} fill="url(#revFill)" activeDot={{ r: 5, fill: COLORS.champagne, stroke: '#fff', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Appointments by status" />
          {statusTotal === 0 ? (
            <p className="px-5 py-8 text-sm text-ink-mute">No appointments in this period.</p>
          ) : (
            <div className="grid items-center gap-2 px-5 py-5 sm:grid-cols-[11rem_minmax(0,1fr)]">
              <div className="mx-auto h-44 w-44" role="img" aria-label="Appointment status breakdown">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie isAnimationActive={false} data={statusRows} dataKey="count" nameKey="status" innerRadius={52} outerRadius={80} paddingAngle={2} stroke="none">
                      {statusRows.map((s) => (
                        <Cell key={s.status} fill={STATUS_COLORS[s.status]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip unit="appointments" />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-2">
                {statusRows.map((s) => (
                  <li key={s.status} className="flex items-center justify-between gap-3 text-sm">
                    <span className="inline-flex items-center gap-2 text-ink">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[s.status] }} aria-hidden />
                      {STATUS_LABELS[s.status]}
                    </span>
                    <span className="font-numeric text-ink-soft">
                      {s.count} <span className="text-ink-mute">· {Math.round((s.count / statusTotal) * 100)}%</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="Popular services" description="By number of appointments" />
          {data.popularServices.length === 0 ? (
            <p className="px-5 py-8 text-sm text-ink-mute">No bookings in this period.</p>
          ) : (
            <Bars rows={data.popularServices.map((s) => ({ label: s.name, value: s.count, display: `${s.count} · ${formatMoney(s.revenue, currency)}` }))} />
          )}
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="Staff performance" />
        {data.staffPerformance.length === 0 ? (
          <p className="px-5 py-8 text-sm text-ink-mute">No staff activity in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-sand/80 text-[13px] text-ink-mute">
                  <th scope="col" className="px-5 py-3 font-medium">Team member</th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">Appointments</th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">Completed</th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">No-shows</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.staffPerformance.map((s) => (
                  <tr key={s.id} className="border-b border-sand/50 last:border-0">
                    <td className="px-5 py-3">
                      <Link to={`/staff/${s.id}`} className="inline-flex items-center gap-3 rounded-md font-medium text-plum-900 hover:text-plum-600">
                        <Avatar name={s.name} color={s.color} size="sm" />
                        {s.name}
                      </Link>
                    </td>
                    <td className="font-numeric px-3 py-3 text-right">{s.total}</td>
                    <td className="font-numeric px-3 py-3 text-right">{s.completed}</td>
                    <td className="font-numeric px-3 py-3 text-right">{s.noShows}</td>
                    <td className="font-numeric px-5 py-3 text-right">{formatMoney(s.revenue, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Customers" description="New, returning and gone quiet" />
          {customerTotal === 0 ? (
            <p className="px-5 py-8 text-sm text-ink-mute">No customer activity yet.</p>
          ) : (
            <div className="px-5 py-5">
              <div className="h-44" role="img" aria-label="Customer segments">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { label: 'New', value: data.customers.new },
                      { label: 'Returning', value: data.customers.returning },
                      { label: 'Inactive', value: data.customers.inactive },
                    ]}
                    margin={{ top: 4, right: 8, bottom: 0, left: -20 }}
                  >
                    <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 4" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: COLORS.axis, fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: COLORS.axis, fontSize: 12 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip unit="customers" />} cursor={{ fill: 'rgba(166,124,156,0.12)' }} />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={56}>
                      <Cell fill={COLORS.champagne} />
                      <Cell fill={COLORS.plum} />
                      <Cell fill={COLORS.lavender} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-3 text-[13px] text-ink-mute">
                <Link to="/customers?lapsed=1" className="font-medium text-plum-700 underline-offset-4 hover:underline">
                  See customers not seen in 30 days
                </Link>
              </p>
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="Payments" description="Collected in this period" />
          <div className="px-5 py-5">
            <div className="mb-4 flex items-baseline justify-between rounded-2xl bg-champagne-100/60 px-4 py-3">
              <span className="text-sm text-champagne-600">Outstanding balance</span>
              <span className="font-display text-2xl text-plum-900">
                <span className="font-numeric">{formatMoney(data.payments.outstanding, currency)}</span>
              </span>
            </div>
            {data.payments.byMethod.length === 0 ? (
              <p className="text-sm text-ink-mute">No payments recorded in this period.</p>
            ) : (
              <Bars rows={data.payments.byMethod.map((m) => ({ label: METHOD_LABELS[m.method], value: m.amount, display: `${formatMoney(m.amount, currency)} · ${m.count}` }))} />
            )}
            {data.payments.byStatus.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 px-5 text-[13px] text-ink-mute">
                {data.payments.byStatus.map((s) => (
                  <li key={s.status}>
                    {PAYMENT_LABELS[s.status]} <span className="font-numeric text-ink-soft">{s.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="Recent payments" />
        {data.payments.recent.length === 0 ? (
          <p className="px-5 py-8 text-sm text-ink-mute">Payments you record will show up here.</p>
        ) : (
          <ul className="divide-y divide-sand/60">
            {data.payments.recent.map((p) => (
              <li key={p.id}>
                <Link to={`/appointments/${p.appointmentId}`} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-lavender-50/70">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-plum-900">{p.customerName}</p>
                    <p className="truncate text-[13px] text-ink-mute">
                      {p.serviceName} · {METHOD_LABELS[p.method]} · {formatDateTime(p.paidAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-numeric text-sm font-medium text-plum-900">{formatMoney(p.amount, currency)}</p>
                    <p className="text-xs text-ink-mute">{PAYMENT_LABELS[p.status]}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

export default function AnalyticsPage() {
  useDocumentTitle('Analytics');
  const { user } = useAuth();
  const [range, setRange] = useState<RangeKey>('30');
  const query = useAnalytics(Number(range));

  return (
    <>
      <PageHeader
        title="Analytics"
        description="How the studio is doing: revenue, bookings, your team and your customers."
        actions={
          <Tabs
            label="Date range"
            value={range}
            onChange={setRange}
            tabs={[
              { value: '7', label: 'Last 7 days' },
              { value: '30', label: 'Last 30 days' },
              { value: '90', label: 'Last 90 days' },
            ]}
          />
        }
      />
      {query.error && !query.data ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : !query.data ? (
        <div className="space-y-6" role="status" aria-label="Loading analytics">
          <Skeleton className="h-28 rounded-panel" />
          <Skeleton className="h-80 rounded-panel" />
          <Skeleton className="h-56 rounded-panel" />
        </div>
      ) : query.data.totals.appointments === 0 && query.data.totals.revenue === 0 ? (
        <Panel>
          <EmptyState icon={<BarChart3 className="h-6 w-6" />} title="Nothing to chart yet" description="Try a longer range, or come back after a few bookings." />
        </Panel>
      ) : (
        <div className={query.isPlaceholderData ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          <Content data={query.data} currency={user?.currency ?? 'ETB'} />
        </div>
      )}
    </>
  );
}
