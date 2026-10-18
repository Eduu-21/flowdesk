import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarOff, Mail, Pencil, Phone, Plus, Trash2, UserX } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useModals } from '@/components/modals/ModalsContext';
import { StatusBadge } from '@/components/StatusBadge';
import { Button, IconButton } from '@/components/ui/Button';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui/Feedback';
import { Input, TextField } from '@/components/ui/Form';
import { Avatar, Badge, PageHeader, Panel, PanelHeader } from '@/components/ui/Misc';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { Toggle } from '@/components/ui/Form';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useAddTimeOff, useRemoveTimeOff, useSaveAvailability, useStaffMember } from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDebounce';
import { ApiError, errorMessage } from '@/lib/api';
import { formatDate, formatTimeRange, toISODate, WEEKDAYS } from '@/lib/dates';
import { applyServerErrors } from '@/lib/forms';
import { timeOffSchema, type TimeOffValues } from '@/schemas';
import type { AvailabilityDay, TimeOff } from '@/types';

/** Monday first, Sunday last. Values are JS weekday numbers (0 = Sunday). */
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function normalise(days: AvailabilityDay[]): AvailabilityDay[] {
  return DAY_ORDER.map(
    (dayOfWeek) =>
      days.find((d) => d.dayOfWeek === dayOfWeek) ?? {
        dayOfWeek,
        isWorking: dayOfWeek !== 0,
        startTime: '09:00',
        endTime: '17:00',
      },
  );
}

function AvailabilityEditor({ staffId, initial, canEdit }: { staffId: string; initial: AvailabilityDay[]; canEdit: boolean }) {
  const toast = useToast();
  const save = useSaveAvailability();
  const [days, setDays] = useState(() => normalise(initial));
  const [dirty, setDirty] = useState(false);

  const problems = useMemo(
    () => Object.fromEntries(days.filter((d) => d.isWorking && d.endTime <= d.startTime).map((d) => [d.dayOfWeek, 'End time must be after start time'])),
    [days],
  );
  const hasProblems = Object.keys(problems).length > 0;

  const change = (dayOfWeek: number, patch: Partial<AvailabilityDay>) => {
    setDays((all) => all.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, ...patch } : d)));
    setDirty(true);
  };

  const submit = () => {
    save.mutate(
      { id: staffId, days },
      {
        onSuccess: () => {
          setDirty(false);
          toast.success('Working hours saved');
        },
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  };

  const reset = () => {
    setDays(normalise(initial));
    setDirty(false);
  };

  return (
    <Panel>
      <PanelHeader
        title="Weekly availability"
        description={canEdit ? 'Appointments can only be booked inside these hours.' : 'Regular working hours.'}
        action={
          canEdit && (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={reset} disabled={!dirty || save.isPending}>
                Reset
              </Button>
              <Button size="sm" onClick={submit} loading={save.isPending} disabled={!dirty || hasProblems}>
                Save hours
              </Button>
            </div>
          )
        }
      />
      <ul className="divide-y divide-sand/60">
        {days.map((day) => {
          const label = WEEKDAYS[day.dayOfWeek];
          const problem = problems[day.dayOfWeek];
          return (
            <li key={day.dayOfWeek} className="grid items-center gap-3 px-5 py-3.5 sm:grid-cols-[9rem_minmax(0,1fr)]">
              <div className="w-36">
                {canEdit ? (
                  <Toggle label={label} checked={day.isWorking} onChange={(v) => change(day.dayOfWeek, { isWorking: v })} />
                ) : (
                  <p className="text-sm font-medium text-plum-900">{label}</p>
                )}
              </div>
              {day.isWorking ? (
                canEdit ? (
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        type="time"
                        aria-label={`${label} start time`}
                        value={day.startTime}
                        onChange={(e) => change(day.dayOfWeek, { startTime: e.target.value })}
                        className="w-32"
                      />
                      <span className="text-sm text-ink-mute">to</span>
                      <Input
                        type="time"
                        aria-label={`${label} end time`}
                        value={day.endTime}
                        onChange={(e) => change(day.dayOfWeek, { endTime: e.target.value })}
                        className="w-32"
                      />
                    </div>
                    {problem && (
                      <p role="alert" className="mt-1 text-[13px] text-berry">
                        {problem}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="font-numeric text-sm text-ink">{formatTimeRange(day.startTime, day.endTime)}</p>
                )
              ) : (
                <p className="text-sm text-ink-mute">Day off</p>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function TimeOffModal({ open, staffId, onClose }: { open: boolean; staffId: string; onClose: () => void }) {
  const toast = useToast();
  const add = useAddTimeOff();
  const today = toISODate(new Date());
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<TimeOffValues>({
    resolver: zodResolver(timeOffSchema),
    defaultValues: { startDate: today, endDate: today, reason: '' },
  });

  const onSubmit = handleSubmit((values) =>
    add.mutate(
      { id: staffId, values },
      {
        onSuccess: () => {
          toast.success('Time off added');
          onClose();
        },
        onError: (error) => {
          if (!applyServerErrors(error, setError)) toast.error(errorMessage(error));
        },
      },
    ),
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add time off"
      description="No appointments can be booked on these days."
      size="sm"
      dismissible={!add.isPending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={add.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="time-off-form" loading={add.isPending}>
            Add time off
          </Button>
        </>
      }
    >
      <form id="time-off-form" onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        <TextField label="From" type="date" required error={errors.startDate?.message} {...register('startDate')} />
        <TextField label="To" type="date" required error={errors.endDate?.message} {...register('endDate')} />
        <TextField label="Reason (optional)" placeholder="Holiday, training…" error={errors.reason?.message} {...register('reason')} wrapperClassName="sm:col-span-2" />
      </form>
    </Modal>
  );
}

export default function StaffDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const modals = useModals();
  const toast = useToast();
  const query = useStaffMember(id);
  const removeTimeOff = useRemoveTimeOff();
  const [addingTimeOff, setAddingTimeOff] = useState(false);
  const [timeOffToRemove, setTimeOffToRemove] = useState<TimeOff | null>(null);

  useDocumentTitle(query.data?.staff.name ?? 'Staff member');

  if (query.isLoading) return <PageSkeleton />;
  if (query.error || !query.data) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <>
        <PageHeader title="Staff member" backTo={{ to: '/staff', label: 'All staff' }} />
        {notFound ? (
          <EmptyState
            icon={<UserX className="h-6 w-6" />}
            title="Staff member not found"
            action={<Button onClick={() => navigate('/staff')}>Back to staff</Button>}
          />
        ) : (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        )}
      </>
    );
  }

  const { staff, timeOff, stats, upcoming } = query.data;
  const canEdit = isAdmin || user?.staffId === staff.id;
  const today = toISODate(new Date());
  const availabilityKey = JSON.stringify(staff.availability);

  const confirmRemoval = () => {
    if (!timeOffToRemove) return;
    removeTimeOff.mutate(
      { id: staff.id, timeOffId: timeOffToRemove.id },
      {
        onSuccess: () => toast.success('Time off removed'),
        onError: (error) => toast.error(errorMessage(error)),
        onSettled: () => setTimeOffToRemove(null),
      },
    );
  };

  return (
    <>
      <PageHeader
        title={staff.name}
        description={staff.roleTitle}
        backTo={{ to: isAdmin ? '/staff' : '/dashboard', label: isAdmin ? 'All staff' : 'Dashboard' }}
        actions={
          isAdmin && (
            <Button variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={() => modals.openStaff(staff)}>
              Edit details
            </Button>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Panel>
            <div className="flex flex-wrap items-center gap-4 px-5 py-5">
              <Avatar name={staff.name} src={staff.avatarUrl} color={staff.avatarColor} size="xl" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap gap-1.5">
                  <Badge className={staff.status === 'active' ? 'bg-sage-100 text-sage' : 'bg-sand/70 text-ink-soft'}>
                    {staff.status === 'active' ? 'Active' : 'Inactive'}
                  </Badge>
                  {staff.hasLogin && <Badge className="bg-lavender text-plum-700">Has login</Badge>}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft">
                  <a href={`mailto:${staff.email}`} className="inline-flex items-center gap-1.5 hover:text-plum-700">
                    <Mail className="h-4 w-4" aria-hidden />
                    {staff.email}
                  </a>
                  {staff.phone && (
                    <a href={`tel:${staff.phone}`} className="inline-flex items-center gap-1.5 hover:text-plum-700">
                      <Phone className="h-4 w-4" aria-hidden />
                      <span className="font-numeric">{staff.phone}</span>
                    </a>
                  )}
                </div>
                {staff.specialties.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Specialties">
                    {staff.specialties.map((s) => (
                      <li key={s} className="rounded-full border border-sand bg-white px-2.5 py-0.5 text-xs text-ink-soft">
                        {s}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <dl className="grid grid-cols-3 gap-px border-t border-sand/60 bg-sand/70">
              {[
                { label: 'Appointments', value: stats.total },
                { label: 'Completed', value: stats.completed },
                { label: 'Upcoming', value: stats.upcoming },
              ].map((s) => (
                <div key={s.label} className="bg-[#fffdfb] px-5 py-4">
                  <dd className="font-display text-4xl leading-none text-plum-900">
                    <span className="font-numeric">{s.value}</span>
                  </dd>
                  <dt className="mt-1.5 text-sm text-ink-mute">{s.label}</dt>
                </div>
              ))}
            </dl>
          </Panel>

          <AvailabilityEditor key={availabilityKey} staffId={staff.id} initial={staff.availability} canEdit={canEdit} />
        </div>

        <div className="space-y-6">
          <Panel>
            <PanelHeader
              title="Time off"
              action={
                canEdit && (
                  <Button variant="secondary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setAddingTimeOff(true)}>
                    Add
                  </Button>
                )
              }
            />
            {timeOff.length === 0 ? (
              <div className="flex items-center gap-3 px-5 py-5 text-sm text-ink-mute">
                <CalendarOff className="h-5 w-5" aria-hidden />
                No time off planned.
              </div>
            ) : (
              <ul className="divide-y divide-sand/60">
                {timeOff.map((t) => {
                  const past = t.endDate < today;
                  return (
                    <li key={t.id} className="flex items-center gap-2 px-5 py-3.5">
                      <div className="min-w-0 flex-1">
                        <p className={past ? 'text-sm text-ink-mute' : 'text-sm font-medium text-plum-900'}>
                          {t.startDate === t.endDate ? formatDate(t.startDate) : `${formatDate(t.startDate)} – ${formatDate(t.endDate)}`}
                        </p>
                        {t.reason && <p className="text-[13px] text-ink-mute">{t.reason}</p>}
                      </div>
                      {canEdit && (
                        <IconButton label="Remove time off" onClick={() => setTimeOffToRemove(t)}>
                          <Trash2 className="h-4 w-4" />
                        </IconButton>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Upcoming appointments" />
            {upcoming.length === 0 ? (
              <p className="px-5 py-5 text-sm text-ink-mute">Nothing coming up.</p>
            ) : (
              <ul className="divide-y divide-sand/60">
                {upcoming.map((a) => (
                  <li key={a.id}>
                    <Link to={`/appointments/${a.id}`} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-lavender-50/70">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-plum-900">{a.customerName}</p>
                        <p className="truncate text-[13px] text-ink-mute">
                          {a.serviceName} · {formatDate(a.date, { weekday: 'short', month: 'short', day: 'numeric' })},{' '}
                          <span className="font-numeric">{formatTimeRange(a.startTime, a.endTime)}</span>
                        </p>
                      </div>
                      <StatusBadge status={a.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      {addingTimeOff && <TimeOffModal open staffId={staff.id} onClose={() => setAddingTimeOff(false)} />}
      <ConfirmDialog
        open={!!timeOffToRemove}
        title="Remove this time off?"
        message="The days will open up for booking again."
        confirmLabel="Remove"
        cancelLabel="Cancel"
        loading={removeTimeOff.isPending}
        onConfirm={confirmRemoval}
        onClose={() => setTimeOffToRemove(null)}
      />
    </>
  );
}
