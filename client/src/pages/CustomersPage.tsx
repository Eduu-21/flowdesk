import { MoreHorizontal, Pencil, Search, Trash2, UserPlus, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useModals } from '@/components/modals/ModalsContext';
import { Badge, PageHeader, Pagination, Panel } from '@/components/ui/Misc';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Dropdown } from '@/components/ui/Dropdown';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { Input, Select } from '@/components/ui/Form';
import { ConfirmDialog } from '@/components/ui/Modal';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useCustomers, useDeleteCustomer } from '@/hooks/queries';
import { useDebounce, useDocumentTitle } from '@/hooks/useDebounce';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/format';
import type { Customer } from '@/types';

const PAGE_SIZE = 12;

export default function CustomersPage() {
  useDocumentTitle('Customers');
  const { user, isAdmin } = useAuth();
  const modals = useModals();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const remove = useDeleteCustomer();
  const [toDelete, setToDelete] = useState<Customer | null>(null);

  const get = (key: string) => params.get(key) ?? '';
  const page = Math.max(1, Number(get('page')) || 1);
  const sort = get('sort') || 'name';
  const order = (get('order') || 'asc') as 'asc' | 'desc';
  const lapsed = get('lapsed') === '1';

  const [searchText, setSearchText] = useState(get('search'));
  const debounced = useDebounce(searchText, 300);

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
    if (debounced !== get('search')) update({ search: debounced || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const status = get('status');
  const hasFilters = !!(get('search') || status || lapsed);
  const clear = () => {
    setSearchText('');
    setParams({}, { replace: true });
  };

  const query = useCustomers({
    search: get('search'),
    status,
    lapsed: lapsed ? '1' : undefined,
    sort,
    order,
    page,
    pageSize: PAGE_SIZE,
  });

  const columns: Column<Customer>[] = [
    {
      key: 'name',
      header: 'Customer',
      sortKey: 'name',
      cell: (c) => (
        <div>
          <p className="font-medium text-plum-900">{c.name}</p>
          <p className="text-[13px] text-ink-mute">{c.email || 'No email'}</p>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', cell: (c) => <span className="font-numeric">{c.phone}</span> },
    {
      key: 'appointmentCount',
      header: 'Appointments',
      sortKey: 'appointmentCount',
      cell: (c) => <span className="font-numeric">{c.appointmentCount}</span>,
    },
    {
      key: 'lastVisit',
      header: 'Last visit',
      sortKey: 'lastVisit',
      cell: (c) => (c.lastVisit ? formatDate(c.lastVisit) : <span className="text-ink-mute">Not yet</span>),
    },
    ...(isAdmin
      ? [
          {
            key: 'totalSpent',
            header: 'Total spent',
            sortKey: 'totalSpent',
            align: 'right' as const,
            cell: (c: Customer) => <span className="font-numeric">{formatMoney(c.totalSpent, user?.currency)}</span>,
          },
        ]
      : []),
    {
      key: 'status',
      header: 'Status',
      cell: (c) => (
        <Badge className={c.status === 'active' ? 'bg-sage-100 text-sage' : 'bg-cream text-ink-mute'}>
          {c.status === 'active' ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    ...(isAdmin
      ? [
          {
            key: 'actions',
            header: '',
            align: 'right' as const,
            mobileHide: true,
            cell: (c: Customer) => (
              <div onClick={(event) => event.stopPropagation()}>
                <Dropdown
                  label={`Actions for ${c.name}`}
                  triggerClassName="h-9 w-9 justify-center text-ink-soft hover:bg-lavender-50"
                  trigger={<MoreHorizontal className="h-5 w-5" aria-hidden />}
                  items={[
                    { label: 'Edit customer', icon: <Pencil className="h-4 w-4" />, onSelect: () => modals.openCustomer(c) },
                    { label: 'Delete customer', icon: <Trash2 className="h-4 w-4" />, danger: true, separated: true, onSelect: () => setToDelete(c) },
                  ]}
                />
              </div>
            ),
          },
        ]
      : []),
  ];

  const confirmDelete = () => {
    if (!toDelete) return;
    remove.mutate(toDelete.id, {
      onSuccess: () => {
        toast.success(`${toDelete.name} was deleted`);
        setToDelete(null);
      },
      onError: (error) => {
        toast.error(errorMessage(error));
        setToDelete(null);
      },
    });
  };

  return (
    <>
      <PageHeader
        title="Customers"
        description={isAdmin ? 'Everyone who books with you, with their visit history and spend.' : 'Customers you have looked after.'}
        actions={
          isAdmin && (
            <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => modals.openCustomer()}>
              Add customer
            </Button>
          )
        }
      />

      <Panel>
        <div className="grid gap-3 border-b border-sand/60 p-4 sm:grid-cols-[minmax(0,1fr)_12rem_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" aria-hidden />
            <Input aria-label="Search customers" placeholder="Search by name, phone or email" className="pl-9" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
          </div>
          <Select aria-label="Filter by status" value={status} onChange={(e) => update({ status: e.target.value || undefined })}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-pressed={lapsed}
              onClick={() => update({ lapsed: lapsed ? undefined : '1' })}
              className={cn(
                'h-10 rounded-xl border px-3.5 text-sm font-medium transition-colors',
                lapsed ? 'border-plum-700 bg-plum-700 text-ivory' : 'border-sand bg-white text-plum-800 hover:border-mauve-300 hover:bg-lavender-50',
              )}
            >
              Not seen in 30 days
            </button>
            {hasFilters && (
              <Button variant="ghost" size="sm" icon={<X className="h-4 w-4" />} onClick={clear}>
                Clear
              </Button>
            )}
          </div>
        </div>

        {query.error && !query.data ? (
          <div className="p-5">
            <ErrorState error={query.error} onRetry={() => query.refetch()} />
          </div>
        ) : query.isLoading ? (
          <div className="space-y-2 p-4" role="status" aria-label="Loading customers">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : query.data && query.data.data.length === 0 ? (
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title={hasFilters ? 'No customers match' : 'No customers yet'}
            description={hasFilters ? 'Try a different search, or clear the filters.' : 'Add your first customer to start building their history.'}
            action={
              hasFilters ? (
                <Button variant="secondary" onClick={clear}>
                  Clear filters
                </Button>
              ) : isAdmin ? (
                <Button onClick={() => modals.openCustomer()}>Add customer</Button>
              ) : undefined
            }
          />
        ) : (
          query.data && (
            <>
              <DataTable
                columns={columns}
                rows={query.data.data}
                rowKey={(c) => c.id}
                rowLabel={(c) => c.name}
                onRowClick={(c) => navigate(`/customers/${c.id}`)}
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

      <ConfirmDialog
        open={!!toDelete}
        title="Delete this customer?"
        message={
          <>
            <strong className="font-medium text-plum-900">{toDelete?.name}</strong> and their notes will be removed for good. Customers who already have appointments can’t be deleted; mark them inactive instead.
          </>
        }
        confirmLabel="Delete customer"
        loading={remove.isPending}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </>
  );
}
