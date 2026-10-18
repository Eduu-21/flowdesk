import { Check, Plus, Search, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/context/ToastContext';
import { useUser } from '@/context/AuthContext';
import { useDebounce } from '@/hooks/useDebounce';
import { useAvailability, useCreateAppointment, useCustomer, useCustomers, useServices, useStaffList } from '@/hooks/queries';
import { ApiError, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { addDays, formatDate, formatDateLong, formatTime, formatTimeRange, todayIn } from '@/lib/dates';
import { formatDuration, formatMoney, plural } from '@/lib/format';
import type { Appointment, Customer } from '@/types';
import { Button } from '../ui/Button';
import { Skeleton } from '../ui/Feedback';
import { Input, SelectField, TextareaField } from '../ui/Form';
import { Modal } from '../ui/Modal';
import { Avatar } from '../ui/Misc';
import { useModals, type BookingInitial } from './ModalsContext';

const STEPS = ['Customer', 'Service', 'Staff', 'Date', 'Time', 'Review', 'Confirm'] as const;

interface Props {
  open: boolean;
  initial?: BookingInitial;
  onClose: () => void;
}

function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors',
        selected ? 'border-champagne bg-champagne-100/60 shadow-[inset_0_0_0_1px_#c4a265]' : 'border-sand bg-white hover:border-mauve-300 hover:bg-lavender-50',
      )}
    >
      {children}
      <span
        className={cn(
          'ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
          selected ? 'border-champagne bg-champagne text-white' : 'border-sand',
        )}
        aria-hidden
      >
        {selected && <Check className="h-3 w-3" />}
      </span>
    </button>
  );
}

export function BookingModal({ open, initial, onClose }: Props) {
  const user = useUser();
  const toast = useToast();
  const navigate = useNavigate();
  const modals = useModals();
  const create = useCreateAppointment();
  const today = todayIn(user.timezone);

  const [customer, setCustomer] = useState<Pick<Customer, 'id' | 'name' | 'phone'> | null>(null);
  const [serviceId, setServiceId] = useState(initial?.serviceId ?? '');
  const [staffId, setStaffId] = useState(initial?.staffId ?? '');
  const [date, setDate] = useState(initial?.date ?? '');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'confirmed' | 'pending'>('confirmed');
  const [search, setSearch] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [created, setCreated] = useState<Appointment | null>(null);
  const [step, setStep] = useState(() =>
    !initial?.customerId ? 0 : !initial.serviceId ? 1 : !initial.staffId ? 2 : !initial.date ? 3 : 4,
  );

  const debouncedSearch = useDebounce(search, 250);
  const customers = useCustomers({ search: debouncedSearch, status: 'active', sort: 'name', order: 'asc', pageSize: 8 });
  const preselected = useCustomer(initial?.customerId);
  const services = useServices({ active: 'true' });
  const staffList = useStaffList({ status: 'active' });
  const availability = useAvailability({ staffId, serviceId, date });

  useEffect(() => {
    const c = preselected.data?.customer;
    if (c && !customer) setCustomer({ id: c.id, name: c.name, phone: c.phone });
  }, [preselected.data, customer]);

  // Preselect the requested time (from the dashboard's "Available" rows) once slots load
  useEffect(() => {
    if (!time && initial?.startTime && availability.data?.slots.some((s) => s.start === initial.startTime)) {
      setTime(initial.startTime);
    }
  }, [availability.data, initial?.startTime, time]);

  const service = services.data?.data.find((s) => s.id === serviceId);
  const staff = staffList.data?.data.find((s) => s.id === staffId);
  const slot = availability.data?.slots.find((s) => s.start === time);

  const serviceRows = services.data?.data;
  const grouped = useMemo(() => {
    const map = new Map<string, NonNullable<typeof serviceRows>>();
    for (const s of serviceRows ?? []) map.set(s.category, [...(map.get(s.category) ?? []), s]);
    return [...map.entries()];
  }, [serviceRows]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(today, i)), [today]);

  const canNext = [!!customer, !!serviceId, !!staffId, !!date && date >= today, !!time, true][step] ?? false;

  const submit = () => {
    if (!customer || !serviceId || !staffId || !date || !time) return;
    setSubmitError('');
    create.mutate(
      { customerId: customer.id, serviceId, staffId, date, startTime: time, notes, status },
      {
        onSuccess: (res) => {
          setCreated((res as { appointment: Appointment }).appointment);
          setStep(6);
          toast.success('Appointment booked');
        },
        onError: (error) => {
          setSubmitError(errorMessage(error));
          if (error instanceof ApiError && error.status === 409) {
            setTime('');
            setStep(4);
          }
        },
      },
    );
  };

  const reset = () => {
    setCustomer(null);
    setServiceId('');
    setStaffId('');
    setDate('');
    setTime('');
    setNotes('');
    setStatus('confirmed');
    setSearch('');
    setSubmitError('');
    setCreated(null);
    setStep(0);
  };

  const footer =
    step === 6 ? (
      <>
        <Button variant="ghost" onClick={reset}>
          Book another
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            onClose();
            if (created) navigate(`/appointments/${created.id}`);
          }}
        >
          View appointment
        </Button>
        <Button onClick={onClose}>Done</Button>
      </>
    ) : (
      <>
        <Button variant="secondary" onClick={onClose} disabled={create.isPending}>
          Cancel
        </Button>
        {step > 0 && (
          <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={create.isPending}>
            Back
          </Button>
        )}
        {step < 5 ? (
          <Button onClick={() => setStep(step + 1)} disabled={!canNext}>
            Next
          </Button>
        ) : (
          <Button onClick={submit} loading={create.isPending}>
            Confirm booking
          </Button>
        )}
      </>
    );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={step === 6 ? 'Booking confirmed' : 'New appointment'}
      size="lg"
      dismissible={!create.isPending}
      footer={footer}
    >
      {step < 6 && (
        <>
          <ol className="mb-6 hidden items-center sm:flex" aria-label="Booking steps">
            {STEPS.map((label, i) => (
              <li key={label} className="flex flex-1 items-center last:flex-none" aria-current={i === step ? 'step' : undefined}>
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                      i < step ? 'bg-plum-700 text-ivory' : i === step ? 'bg-champagne text-plum-950' : 'bg-cream text-ink-mute',
                    )}
                  >
                    {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span className={cn('text-[13px]', i === step ? 'font-medium text-plum-900' : 'text-ink-mute')}>{label}</span>
                </span>
                {i < STEPS.length - 1 && <span className={cn('mx-2 h-px flex-1', i < step ? 'bg-plum-700' : 'bg-sand')} />}
              </li>
            ))}
          </ol>
          <div className="mb-5 sm:hidden">
            <p className="text-sm font-medium text-plum-900">
              Step {step + 1} of {STEPS.length}: {STEPS[step]}
            </p>
            <div className="mt-2 h-1.5 rounded-full bg-cream">
              <div className="h-full rounded-full bg-champagne transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
            </div>
          </div>
        </>
      )}

      {submitError && step < 6 && (
        <p role="alert" className="mb-4 rounded-xl bg-berry-100 px-4 py-3 text-sm text-berry">
          {submitError}
        </p>
      )}

      {/* ---------------- 1. customer ---------------- */}
      {step === 0 && (
        <div>
          <div className="mb-3 flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" aria-hidden />
              <Input
                aria-label="Search customers"
                placeholder="Search by name, phone or email"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-autofocus
              />
            </div>
            <Button
              variant="soft"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => modals.openCustomer(null, (c) => setCustomer({ id: c.id, name: c.name, phone: c.phone }))}
            >
              New customer
            </Button>
          </div>
          <div role="radiogroup" aria-label="Customer" className="space-y-2">
            {customers.isLoading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-2xl" />)}
            {customer && !customers.data?.data.some((c) => c.id === customer.id) && (
              <Choice selected onClick={() => undefined}>
                <Avatar name={customer.name} size="sm" />
                <span>
                  <span className="block font-medium text-plum-900">{customer.name}</span>
                  <span className="text-[13px] text-ink-mute">{customer.phone}</span>
                </span>
              </Choice>
            )}
            {customers.data?.data.map((c) => (
              <Choice key={c.id} selected={customer?.id === c.id} onClick={() => setCustomer({ id: c.id, name: c.name, phone: c.phone })}>
                <Avatar name={c.name} size="sm" color="#8a5a83" />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-plum-900">{c.name}</span>
                  <span className="text-[13px] text-ink-mute">
                    {c.phone}
                    {c.lastVisit ? ` · last visit ${formatDate(c.lastVisit, { month: 'short', day: 'numeric' })}` : ' · new customer'}
                  </span>
                </span>
              </Choice>
            ))}
            {customers.data && customers.data.data.length === 0 && (
              <p className="rounded-2xl border border-dashed border-sand px-4 py-8 text-center text-sm text-ink-mute">
                <UserRound className="mx-auto mb-2 h-5 w-5" aria-hidden />
                No customers match “{debouncedSearch}”. Use New customer to add them.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ---------------- 2. service ---------------- */}
      {step === 1 && (
        <div role="radiogroup" aria-label="Service" className="space-y-5">
          {services.isLoading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-2xl" />)}
          {grouped.map(([category, items]) => (
            <div key={category}>
              <h3 className="mb-2 font-display text-lg text-plum-800">{category}</h3>
              <div className="space-y-2">
                {items.map((s) => (
                  <Choice
                    key={s.id}
                    selected={serviceId === s.id}
                    onClick={() => {
                      setServiceId(s.id);
                      setTime('');
                    }}
                  >
                    <span className="min-w-0">
                      <span className="block font-medium text-plum-900">{s.name}</span>
                      <span className="text-[13px] text-ink-mute">
                        {formatDuration(s.durationMinutes)} · {formatMoney(s.price, user.currency)}
                      </span>
                    </span>
                  </Choice>
                ))}
              </div>
            </div>
          ))}
          {services.data && grouped.length === 0 && (
            <p className="rounded-2xl border border-dashed border-sand px-4 py-8 text-center text-sm text-ink-mute">
              There are no active services yet. Add a service first, then come back to book.
            </p>
          )}
        </div>
      )}

      {/* ---------------- 3. staff ---------------- */}
      {step === 2 && (
        <div role="radiogroup" aria-label="Staff member" className="grid gap-2 sm:grid-cols-2">
          {staffList.isLoading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
          {staffList.data?.data.map((s) => (
            <Choice
              key={s.id}
              selected={staffId === s.id}
              onClick={() => {
                setStaffId(s.id);
                setTime('');
              }}
            >
              <Avatar name={s.name} src={s.avatarUrl} color={s.avatarColor} />
              <span className="min-w-0">
                <span className="block truncate font-medium text-plum-900">{s.name}</span>
                <span className="block truncate text-[13px] text-ink-mute">{s.specialties.slice(0, 3).join(', ') || s.roleTitle}</span>
              </span>
            </Choice>
          ))}
        </div>
      )}

      {/* ---------------- 4. date ---------------- */}
      {step === 3 && (
        <div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7" role="radiogroup" aria-label="Quick dates">
            {days.map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={date === d}
                onClick={() => {
                  setDate(d);
                  setTime('');
                }}
                className={cn(
                  'rounded-2xl border px-2 py-3 text-center transition-colors',
                  date === d ? 'border-champagne bg-champagne-100/60 shadow-[inset_0_0_0_1px_#c4a265]' : 'border-sand bg-white hover:border-mauve-300 hover:bg-lavender-50',
                )}
              >
                <span className="block text-xs text-ink-mute">{d === today ? 'Today' : formatDate(d, { weekday: 'short' })}</span>
                <span className="font-display text-2xl text-plum-900">{Number(d.slice(8))}</span>
                <span className="block text-xs text-ink-mute">{formatDate(d, { month: 'short' })}</span>
              </button>
            ))}
          </div>
          <div className="mt-5 max-w-xs">
            <label htmlFor="booking-date" className="mb-1.5 block text-sm font-medium text-plum-900">
              Or pick another date
            </label>
            <Input
              id="booking-date"
              type="date"
              min={today}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setTime('');
              }}
            />
            {date && date < today && <p className="mt-1.5 text-[13px] text-berry">Choose today or a later date.</p>}
          </div>
        </div>
      )}

      {/* ---------------- 5. time ---------------- */}
      {step === 4 && (
        <div>
          <p className="mb-3 text-sm text-ink-mute">
            {staff?.name} · {service?.name} ({service && formatDuration(service.durationMinutes)}) · {date && formatDateLong(date)}
          </p>
          {availability.isLoading && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-10 rounded-xl" />
              ))}
            </div>
          )}
          {availability.error && <p className="text-sm text-berry">{errorMessage(availability.error)}</p>}
          {availability.data && availability.data.slots.length === 0 && (
            <p className="rounded-2xl border border-dashed border-sand px-4 py-8 text-center text-sm text-ink-mute">
              {availability.data.reason ?? 'No times are open.'} Go back to choose another date or staff member.
            </p>
          )}
          {availability.data && availability.data.slots.length > 0 && (
            <div role="radiogroup" aria-label="Available times" className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {availability.data.slots.map((s) => (
                <button
                  key={s.start}
                  type="button"
                  role="radio"
                  aria-checked={time === s.start}
                  onClick={() => setTime(s.start)}
                  className={cn(
                    'font-numeric h-10 rounded-xl border text-sm transition-colors',
                    time === s.start
                      ? 'border-plum-700 bg-plum-700 text-ivory'
                      : 'border-sand bg-white text-ink hover:border-mauve-300 hover:bg-lavender-50',
                  )}
                >
                  {formatTime(s.start)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---------------- 6. review ---------------- */}
      {step === 5 && (
        <div className="space-y-5">
          <dl className="divide-y divide-sand/60 rounded-2xl border border-sand bg-white text-sm">
            {[
              ['Customer', customer ? `${customer.name} · ${customer.phone}` : ''],
              ['Service', service ? `${service.name} · ${formatDuration(service.durationMinutes)}` : ''],
              ['With', staff?.name ?? ''],
              ['Date', date ? formatDateLong(date) : ''],
              ['Time', slot ? formatTimeRange(slot.start, slot.end) : time ? formatTime(time) : ''],
              ['Price', service ? formatMoney(service.price, user.currency) : ''],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 px-4 py-3">
                <dt className="text-ink-mute">{label}</dt>
                <dd className="text-right font-medium text-plum-900">{value}</dd>
              </div>
            ))}
          </dl>
          <SelectField label="Booking status" value={status} onChange={(e) => setStatus(e.target.value as 'confirmed' | 'pending')} hint="Confirmed bookings send the customer a confirmation email when they have an email address.">
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending (waiting for the customer)</option>
          </SelectField>
          <TextareaField label="Notes" rows={2} placeholder="Optional: anything the team should know" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
        </div>
      )}

      {/* ---------------- 7. confirmation ---------------- */}
      {step === 6 && created && (
        <div className="flex flex-col items-center px-2 py-4 text-center">
          <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-sage-100 text-sage">
            <Check className="h-8 w-8" aria-hidden />
          </span>
          <h3 className="font-display text-3xl text-plum-900">{created.customerName} is booked in</h3>
          <p className="mt-2 text-[15px] text-ink-soft">
            {created.serviceName} with {created.staffName}
          </p>
          <p className="font-numeric mt-1 text-[15px] text-ink-soft">
            {formatDateLong(created.date)}, {formatTimeRange(created.startTime, created.endTime)}
          </p>
          <p className="mt-4 text-sm text-ink-mute">
            {created.status === 'confirmed' ? 'Confirmed' : 'Pending'} · {formatMoney(created.price, user.currency)} ·{' '}
            {plural(created.durationMinutes, 'minute')}
          </p>
        </div>
      )}
    </Modal>
  );
}
