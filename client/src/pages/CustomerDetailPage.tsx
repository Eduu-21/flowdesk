import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarPlus, Mail, NotebookPen, Pencil, Phone, Trash2, UserX } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useModals } from '@/components/modals/ModalsContext';
import { PaymentBadge, StatusBadge } from '@/components/StatusBadge';
import { Button, IconButton } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui/Feedback';
import { TextareaField } from '@/components/ui/Form';
import { ConfirmDialog } from '@/components/ui/Modal';
import { Avatar, Badge, PageHeader, Panel, PanelHeader } from '@/components/ui/Misc';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useAddNote, useCustomer, useDeleteCustomer, useDeleteNote } from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDebounce';
import { ApiError, errorMessage } from '@/lib/api';
import { formatDate, formatDateLong, formatDateTime, formatTime, formatTimeRange } from '@/lib/dates';
import { applyServerErrors } from '@/lib/forms';
import { formatMoney } from '@/lib/format';
import { noteSchema, type NoteValues } from '@/schemas';
import type { CustomerAppointment } from '@/types';

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[13px] text-ink-mute">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value || <span className="text-ink-mute">Not set</span>}</dd>
    </div>
  );
}

export default function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const modals = useModals();
  const toast = useToast();
  const query = useCustomer(id);
  const addNote = useAddNote();
  const deleteNote = useDeleteNote();
  const deleteCustomer = useDeleteCustomer();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

  useDocumentTitle(query.data?.customer.name ?? 'Customer');

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<NoteValues>({ resolver: zodResolver(noteSchema), defaultValues: { body: '' } });

  if (query.isLoading) return <PageSkeleton />;
  if (query.error || !query.data) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <>
        <PageHeader title="Customer" backTo={{ to: '/customers', label: 'All customers' }} />
        {notFound ? (
          <EmptyState
            icon={<UserX className="h-6 w-6" />}
            title="Customer not found"
            description="They may have been removed, or you may not have access to them."
            action={<Button onClick={() => navigate('/customers')}>Back to customers</Button>}
          />
        ) : (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        )}
      </>
    );
  }

  const { customer, appointments, notes, activity } = query.data;
  const next = customer.nextAppointment;

  const columns: Column<CustomerAppointment>[] = [
    {
      key: 'date',
      header: 'Date and time',
      cell: (a) => (
        <div>
          <p className="font-medium text-plum-900">{formatDate(a.date)}</p>
          <p className="font-numeric text-[13px] text-ink-mute">{formatTimeRange(a.startTime, a.endTime)}</p>
        </div>
      ),
    },
    { key: 'service', header: 'Service', cell: (a) => a.serviceName },
    { key: 'staff', header: 'Staff', cell: (a) => a.staffName },
    { key: 'status', header: 'Status', cell: (a) => <StatusBadge status={a.status} /> },
    ...(isAdmin
      ? [
          {
            key: 'price',
            header: 'Price',
            align: 'right' as const,
            cell: (a: CustomerAppointment) => (
              <div className="flex flex-col items-end gap-1">
                <span className="font-numeric">{formatMoney(a.price, user?.currency)}</span>
                <PaymentBadge status={a.paymentStatus} />
              </div>
            ),
          },
        ]
      : []),
  ];

  const submitNote = handleSubmit((values) => {
    addNote.mutate(
      { customerId: customer.id, body: values.body },
      {
        onSuccess: () => {
          reset({ body: '' });
          toast.success('Note added');
        },
        onError: (error) => {
          if (!applyServerErrors(error, setError)) toast.error(errorMessage(error));
        },
      },
    );
  });

  const removeNote = () => {
    if (!noteToDelete) return;
    deleteNote.mutate(
      { customerId: customer.id, noteId: noteToDelete },
      {
        onSuccess: () => toast.success('Note deleted'),
        onError: (error) => toast.error(errorMessage(error)),
        onSettled: () => setNoteToDelete(null),
      },
    );
  };

  const removeCustomer = () => {
    deleteCustomer.mutate(customer.id, {
      onSuccess: () => {
        toast.success(`${customer.name} was deleted`);
        navigate('/customers', { replace: true });
      },
      onError: (error) => {
        toast.error(errorMessage(error));
        setConfirmDelete(false);
      },
    });
  };

  return (
    <>
      <PageHeader
        title={customer.name}
        backTo={{ to: '/customers', label: 'All customers' }}
        actions={
          isAdmin && (
            <>
              <Button icon={<CalendarPlus className="h-4 w-4" />} onClick={() => modals.openBooking({ customerId: customer.id })}>
                Book appointment
              </Button>
              <Button variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={() => modals.openCustomer(customer)}>
                Edit
              </Button>
              <Button variant="secondary" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            </>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Panel>
            <div className="flex flex-wrap items-center gap-4 border-b border-sand/60 px-5 py-5">
              <Avatar name={customer.name} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={customer.status === 'active' ? 'bg-sage-100 text-sage' : 'bg-cream text-ink-mute'}>
                    {customer.status === 'active' ? 'Active' : 'Inactive'}
                  </Badge>
                  <span className="text-sm text-ink-mute">Customer since {formatDate(customer.createdAt.slice(0, 10))}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft">
                  <a href={`tel:${customer.phone}`} className="inline-flex items-center gap-1.5 hover:text-plum-700">
                    <Phone className="h-4 w-4" aria-hidden />
                    <span className="font-numeric">{customer.phone}</span>
                  </a>
                  {customer.email && (
                    <a href={`mailto:${customer.email}`} className="inline-flex items-center gap-1.5 hover:text-plum-700">
                      <Mail className="h-4 w-4" aria-hidden />
                      {customer.email}
                    </a>
                  )}
                </div>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-px bg-sand/70 sm:grid-cols-3">
              <div className="bg-[#fffdfb] px-5 py-4">
                <dd className="font-display text-4xl leading-none text-plum-900">
                  <span className="font-numeric">{customer.appointmentCount}</span>
                </dd>
                <dt className="mt-1.5 text-sm text-ink-mute">Appointments</dt>
              </div>
              <div className="bg-[#fffdfb] px-5 py-4">
                <dd className="font-display text-2xl leading-none text-plum-900">
                  {customer.lastVisit ? formatDate(customer.lastVisit) : 'Not yet'}
                </dd>
                <dt className="mt-2.5 text-sm text-ink-mute">Last visit</dt>
              </div>
              {isAdmin && (
                <div className="col-span-2 bg-[#fffdfb] px-5 py-4 sm:col-span-1">
                  <dd className="font-display text-2xl leading-none text-plum-900">
                    <span className="font-numeric">{formatMoney(customer.totalSpent, user?.currency)}</span>
                  </dd>
                  <dt className="mt-2.5 text-sm text-ink-mute">Total spent</dt>
                </div>
              )}
            </dl>
            <dl className="grid gap-4 px-5 py-5 sm:grid-cols-3">
              <Fact label="Preferred service" value={customer.preferredService} />
              <Fact label="Preferred staff" value={customer.preferredStaff} />
              <Fact label="Scheduling preference" value={customer.schedulingPreference} />
            </dl>
          </Panel>

          <Panel>
            <PanelHeader title="Appointment history" description={appointments.length ? `${appointments.length} in total` : undefined} />
            {appointments.length === 0 ? (
              <EmptyState
                icon={<CalendarPlus className="h-6 w-6" />}
                title="No appointments yet"
                description="Their bookings will appear here."
                action={isAdmin ? <Button onClick={() => modals.openBooking({ customerId: customer.id })}>Book appointment</Button> : undefined}
              />
            ) : (
              <DataTable
                columns={columns}
                rows={appointments}
                rowKey={(a) => a.id}
                rowLabel={(a) => `${a.serviceName} on ${formatDate(a.date)}`}
                onRowClick={(a) => navigate(`/appointments/${a.id}`)}
              />
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel>
            <PanelHeader title="Next appointment" />
            <div className="px-5 py-4">
              {next ? (
                <Link to={`/appointments/${next.id}`} className="block rounded-2xl border border-sand/80 bg-white px-4 py-3 transition-colors hover:border-mauve-300 hover:bg-lavender-50/60">
                  <p className="font-display text-xl text-plum-900">{formatDateLong(next.date)}</p>
                  <p className="font-numeric text-sm text-plum-700">{formatTime(next.startTime)}</p>
                  <p className="mt-1 text-[13px] text-ink-mute">
                    {next.serviceName} with {next.staffName}
                  </p>
                </Link>
              ) : (
                <p className="text-sm text-ink-mute">Nothing booked yet.</p>
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Notes" />
            <form onSubmit={submitNote} noValidate className="space-y-3 border-b border-sand/60 px-5 py-4">
              <TextareaField label="Add a note" placeholder="Allergies, preferences, anything worth remembering" error={errors.body?.message} {...register('body')} />
              <Button type="submit" size="sm" icon={<NotebookPen className="h-4 w-4" />} loading={addNote.isPending}>
                Save note
              </Button>
            </form>
            {notes.length === 0 ? (
              <p className="px-5 py-5 text-sm text-ink-mute">No notes yet.</p>
            ) : (
              <ul className="divide-y divide-sand/60">
                {notes.map((note) => (
                  <li key={note.id} className="flex items-start gap-2 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="whitespace-pre-wrap break-words text-sm text-ink">{note.body}</p>
                      <p className="mt-1 text-xs text-ink-mute">
                        {note.authorName ?? 'Someone'} · {formatDateTime(note.createdAt)}
                      </p>
                    </div>
                    {isAdmin && (
                      <IconButton label="Delete note" onClick={() => setNoteToDelete(note.id)}>
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Recent activity" />
            {activity.length === 0 ? (
              <p className="px-5 py-5 text-sm text-ink-mute">Nothing recorded yet.</p>
            ) : (
              <ol className="space-y-4 px-5 py-5">
                {activity.map((entry) => (
                  <li key={entry.id} className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-champagne" aria-hidden />
                    <div>
                      <p className="text-sm text-ink">{entry.description}</p>
                      <p className="text-xs text-ink-mute">{formatDateTime(entry.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this customer?"
        message="Their profile and notes will be removed for good. Customers who already have appointments can’t be deleted; mark them inactive instead."
        confirmLabel="Delete customer"
        loading={deleteCustomer.isPending}
        onConfirm={removeCustomer}
        onClose={() => setConfirmDelete(false)}
      />
      <ConfirmDialog
        open={!!noteToDelete}
        title="Delete this note?"
        message="This can’t be undone."
        confirmLabel="Delete note"
        loading={deleteNote.isPending}
        onConfirm={removeNote}
        onClose={() => setNoteToDelete(null)}
      />
    </>
  );
}
