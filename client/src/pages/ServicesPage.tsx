import { Clock, MoreHorizontal, Pencil, Plus, Scissors, Search, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useModals } from '@/components/modals/ModalsContext';
import { Button } from '@/components/ui/Button';
import { Dropdown } from '@/components/ui/Dropdown';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { Input, Select } from '@/components/ui/Form';
import { ConfirmDialog } from '@/components/ui/Modal';
import { Badge, PageHeader, Panel } from '@/components/ui/Misc';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useCategories, useDeleteService, useServices, useToggleService } from '@/hooks/queries';
import { useDebounce, useDocumentTitle } from '@/hooks/useDebounce';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDuration, formatMoney, plural } from '@/lib/format';
import type { Service } from '@/types';

export default function ServicesPage() {
  useDocumentTitle('Services');
  const { user, isAdmin } = useAuth();
  const modals = useModals();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const toggle = useToggleService();
  const remove = useDeleteService();
  const [toDelete, setToDelete] = useState<Service | null>(null);

  const get = (key: string) => params.get(key) ?? '';
  const [searchText, setSearchText] = useState(get('search'));
  const debounced = useDebounce(searchText, 250);

  const update = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if (debounced !== get('search')) update({ search: debounced || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const category = get('category');
  const active = get('active');
  const hasFilters = !!(get('search') || category || active);

  const services = useServices({ search: get('search'), category, active });
  const categories = useCategories();

  const groups = useMemo(() => {
    const map = new Map<string, Service[]>();
    for (const service of services.data?.data ?? []) {
      map.set(service.category, [...(map.get(service.category) ?? []), service]);
    }
    return Array.from(map.entries());
  }, [services.data]);

  const clear = () => {
    setSearchText('');
    setParams({}, { replace: true });
  };

  const setActive = (service: Service, isActive: boolean) =>
    toggle.mutate(
      { id: service.id, isActive },
      {
        onSuccess: () => toast.success(`${service.name} is now ${isActive ? 'active' : 'inactive'}`),
        onError: (error) => toast.error(errorMessage(error)),
      },
    );

  const confirmDelete = () => {
    if (!toDelete) return;
    remove.mutate(toDelete.id, {
      onSuccess: () => toast.success(`${toDelete.name} was deleted`),
      onError: (error) => toast.error(errorMessage(error)),
      onSettled: () => setToDelete(null),
    });
  };

  return (
    <>
      <PageHeader
        title="Services"
        description={isAdmin ? 'Your menu of treatments, with durations and prices.' : 'What the studio offers.'}
        actions={
          isAdmin && (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => modals.openService()}>
              Add service
            </Button>
          )
        }
      />

      <Panel className="mb-6">
        <div className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_13rem_11rem_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" aria-hidden />
            <Input aria-label="Search services" placeholder="Search services" className="pl-9" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
          </div>
          <Select aria-label="Filter by category" value={category} onChange={(e) => update({ category: e.target.value || undefined })}>
            <option value="">All categories</option>
            {categories.data?.data.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select aria-label="Filter by availability" value={active} onChange={(e) => update({ active: e.target.value || undefined })}>
            <option value="">Active and inactive</option>
            <option value="true">Active only</option>
            <option value="false">Inactive only</option>
          </Select>
          {hasFilters && (
            <Button variant="ghost" size="sm" className="self-center" icon={<X className="h-4 w-4" />} onClick={clear}>
              Clear
            </Button>
          )}
        </div>
      </Panel>

      {services.error && !services.data ? (
        <ErrorState error={services.error} onRetry={() => services.refetch()} />
      ) : services.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Loading services">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-panel" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<Scissors className="h-6 w-6" />}
            title={hasFilters ? 'No services match' : 'No services yet'}
            description={hasFilters ? 'Try a different search, or clear the filters.' : 'Add your first service so it can be booked.'}
            action={
              hasFilters ? (
                <Button variant="secondary" onClick={clear}>
                  Clear filters
                </Button>
              ) : isAdmin ? (
                <Button onClick={() => modals.openService()}>Add service</Button>
              ) : undefined
            }
          />
        </Panel>
      ) : (
        <div className="space-y-8">
          {groups.map(([name, items]) => (
            <section key={name} aria-labelledby={`cat-${name}`}>
              <h2 id={`cat-${name}`} className="mb-3 flex items-baseline gap-2 font-display text-2xl text-plum-900">
                {name}
                <span className="font-sans text-sm text-ink-mute">{plural(items.length, 'service')}</span>
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((service) => (
                  <li key={service.id}>
                    <Panel as="article" className={cn('flex h-full flex-col p-5', !service.isActive && 'bg-cream/60')}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className={cn('font-medium text-plum-900', !service.isActive && 'text-ink-soft')}>{service.name}</h3>
                          {!service.isActive && <Badge className="mt-1.5 bg-sand/70 text-ink-soft">Inactive</Badge>}
                        </div>
                        {isAdmin && (
                          <Dropdown
                            label={`Actions for ${service.name}`}
                            triggerClassName="-mr-2 -mt-1 h-9 w-9 justify-center text-ink-soft hover:bg-lavender-50"
                            trigger={<MoreHorizontal className="h-5 w-5" aria-hidden />}
                            items={[
                              { label: 'Edit service', icon: <Pencil className="h-4 w-4" />, onSelect: () => modals.openService(service) },
                              {
                                label: service.isActive ? 'Mark inactive' : 'Mark active',
                                onSelect: () => setActive(service, !service.isActive),
                              },
                              { label: 'Delete service', icon: <Trash2 className="h-4 w-4" />, danger: true, separated: true, onSelect: () => setToDelete(service) },
                            ]}
                          />
                        )}
                      </div>
                      {service.description && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-mute">{service.description}</p>}
                      <div className="mt-auto flex items-end justify-between gap-3 pt-5">
                        <span className="inline-flex items-center gap-1.5 text-sm text-ink-soft">
                          <Clock className="h-4 w-4 text-ink-mute" aria-hidden />
                          {formatDuration(service.durationMinutes)}
                        </span>
                        <span className="font-display text-2xl leading-none text-plum-900">
                          <span className="font-numeric">{formatMoney(service.price, user?.currency)}</span>
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-ink-mute">Booked {plural(service.bookingCount, 'time')}</p>
                    </Panel>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Delete this service?"
        message={
          <>
            <strong className="font-medium text-plum-900">{toDelete?.name}</strong> will be removed from your menu. Services that have been booked can’t be deleted; mark them inactive instead.
          </>
        }
        confirmLabel="Delete service"
        loading={remove.isPending}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </>
  );
}
