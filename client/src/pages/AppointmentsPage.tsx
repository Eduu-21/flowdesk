import { CalendarX2, Plus, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useModals } from '@/components/modals/ModalsContext';
import { PaymentBadge, StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { Input, Select } from '@/components/ui/Form';
import { PageHeader, Pagination, Panel } from '@/components/ui/Misc';
import { useAuth } from '@/context/AuthContext';
import { useAppointments, useStaffList } from '@/hooks/queries';
import { useDebounce, useDocumentTitle } from '@/hooks/useDebounce';
import { formatDate, formatTimeRange } from '@/lib/dates';
import { formatMoney, PAYMENT_LABELS, STATUS_LABELS } from '@/lib/format';
import { APPOINTMENT_STATUSES, PAYMENT_STATUSES, type Appointment } from '@/types';

const PAGE_SIZE = 12;

export default function AppointmentsPage() {
  useDocumentTitle('Appointments');
  const { user, isAdmin } = useAuth();
  const modals = useModals();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const get = (key: string) => params.get(key) ?? '';
  const page = Math.max(1, Number(get('page')) || 1);
  const sort = get('sort') || 'date';
  const order = (get('order') || 'desc') as 'asc' | 'desc';

  const [searchText, setSearchText] = useState(get('search'));
  const debouncedSearch = useDebounce(searchText, 300);

  const update = (changes: Record<string, string | undefined>, resetPage = true) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (resetPage) next.delete('page');
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if (debouncedSearch !== get('search')) update({ search: debouncedSearch || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const filters = {
    status: get('status'),
    paymentStatus: get('paymentStatus'),
    staffId: get('staffId'),
    from: get('from'),
    to: get('to'),
    search: get('search'),
  };
  const hasFilters = Object.values(filters).some(Boolean);

  const query = useAppointments({ ...filters, sort, order, page, pageSize: PAGE_SIZE });
  const staff = useStaffList();

  const columns: Column<Appointment>[] = [
    {
      key: 'date',
      header: 'Date and time',
      sortKey: 'date',
      cell: (a) => (
        <div>
          <p className="font-medium text-plum-900">{formatDate(a.date, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
          <p className="font-numeric text-[13px] text-ink-mute">{formatTimeRange(a.startTime, a.endTime)}</p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      sortKey: 'customer',
      cell: (a) => (
        <div>
          <p className="font-medium text-plum-900">{a.customerName}</p>
          <p className="text-[13px] text-ink-mute">{a.customerPhone}</p>
        </div>
      ),
      mobileHide: true,
    },
    { key: 'service', header: 'Service', sortKey: 'service', cell: (a) => a.serviceName },
    { key: 'staff', header: 'Staff', sortKey: 'staff', cell: (a) => a.staffName },
    { key: 'status', header: 'Status', sortKey: 'status', cell: (a) => <StatusBadge status={a.status} /> },
    ...(isAdmin
      ? [
          {
            key: 'price',
            header: 'Price',
            sortKey: 'price',
            align: 'right' as const,
            cell: (a: Appointment) => (
              <div className="flex flex-col items-end gap-1">
                <span className="font-numeric">{formatMoney(a.price, user?.currency)}</span>
                <PaymentBadge status={a.paymentStatus} />
              </div>
            ),
          },
        ]
      : []),
  ];

  // On phones the first column is the card title, so lead with the customer.
  const mobileColumns = [columns.find((c) => c.key === 'customer')!, columns.find((c) => c.key === 'date')!, ...columns.filter((c) => !['customer', 'date'].includes(c.key))].map(
    (c) => (c.key === 'customer' ? { ...c, mobileHide: false } : c),
  );
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <>
      <PageHeader
        title="Appointments"
        description={isAdmin ? 'Every booking in one list. Filter, sort and open any appointment.' : 'Your appointments. Open one to update its status or notes.'}
        actions={
          isAdmin && (
            <Button onClick={() => modals.openBooking()} icon={<Plus className="h-4 w-4" />}>
              New appointment
            </Button>
          )
        }
      />

      <Panel>
        <div className="grid gap-3 border-b border-sand/60 p-4 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative sm:col-span-2 lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" aria-hidden />
            <Input aria-label="Search appointments" placeholder="Customer, service or staff" className="pl-9" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
          </div>
          <Select aria-label="Filter by status" value={filters.status} onChange={(e) => update({ status: e.target.value || undefined })}>
            <option value="">All statuses</option>
            {APPOINTMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
          {isAdmin && (
            <Select aria-label="Filter by payment" value={filters.paymentStatus} onChange={(e) => update({ paymentStatus: e.target.value || undefined })}>
              <option value="">Any payment</option>
              {PAYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PAYMENT_LABELS[s]}
                </option>
              ))}
            </Select>
          )}
          {isAdmin && (
            <Select aria-label="Filter by staff member" value={filters.staffId} onChange={(e) => update({ staffId: e.target.value || undefined })}>
              <option value="">All staff</option>
              {staff.data?.data.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}
          <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-3">
            <Input type="date" aria-label="From date" value={filters.from} max={filters.to || undefined} onChange={(e) => update({ from: e.target.value || undefined })} />
            <span className="text-sm text-ink-mute">to</span>
            <Input type="date" aria-label="To date" value={filters.to} min={filters.from || undefined} onChange={(e) => update({ to: e.target.value || undefined })} />
          </div>
          {hasFilters && (
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                icon={<X className="h-4 w-4" />}
                onClick={() => {
                  setSearchText('');
                  setParams({}, { replace: true });
                }}
              >
                Clear filters
              </Button>
            </div>
          )}
        </div>

        {query.error && !query.data ? (
          <div className="p-5">
            <ErrorState error={query.error} onRetry={() => query.refetch()} />
          </div>
        ) : query.isLoading ? (
          <div className="space-y-2 p-4" role="status" aria-label="Loading appointments">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : query.data && query.data.data.length === 0 ? (
          <EmptyState
            icon={<CalendarX2 className="h-6 w-6" />}
            title={hasFilters ? 'No appointments match' : 'No appointments yet'}
            description={hasFilters ? 'Try different filters, or clear them to see everything.' : 'Bookings you create will show up here.'}
            action={
              hasFilters ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearchText('');
                    setParams({}, { replace: true });
                  }}
                >
                  Clear filters
                </Button>
              ) : isAdmin ? (
                <Button onClick={() => modals.openBooking()}>Create appointment</Button>
              ) : undefined
            }
          />
        ) : (
          query.data && (
            <>
              <DataTable
                columns={isMobile ? mobileColumns : columns}
                rows={query.data.data}
                rowKey={(a) => a.id}
                rowLabel={(a) => `${a.customerName}, ${a.serviceName}`}
                onRowClick={(a) => navigate(`/appointments/${a.id}`)}
                sort={{ key: sort, order }}
                onSort={(key) => update({ sort: key, order: sort === key && order === 'asc' ? 'desc' : 'asc' })}
              />
              <div className="px-4 pb-4">
                <Pagination page={query.data.page} pageSize={PAGE_SIZE} total={query.data.total} onPage={(p) => update({ page: String(p) }, false)} />
              </div>
            </>
          )
        )}
      </Panel>
    </>
  );
}
