import { CalendarClock, Mail, Phone, Trash2, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useModals } from '@/components/modals/ModalsContext';
import { PaymentBadge, StatusMenu } from '@/components/StatusBadge';
import { Button } from '@/components/ui/Button';
import { ErrorState, PageSkeleton } from '@/components/ui/Feedback';
import { Select, TextareaField, TextField } from '@/components/ui/Form';
import { ConfirmDialog } from '@/components/ui/Modal';
import { Avatar, PageHeader, Panel, PanelHeader } from '@/components/ui/Misc';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useAppointment, useDeleteAppointment, useSetPayment, useUpdateAppointment } from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDebounce';
import { errorMessage } from '@/lib/api';
import { formatDateLong, formatDateTime, formatTimeRange } from '@/lib/dates';
import { formatDuration, formatMoney, METHOD_LABELS, PAYMENT_LABELS } from '@/lib/format';
import { PAYMENT_METHODS, PAYMENT_STATUSES, type AppointmentDetail, type PaymentMethod, type PaymentStatus } from '@/types';

function PaymentPanel({ detail }: { detail: AppointmentDetail }) {
  const { user } = useAuth();
  const toast = useToast();
  const setPayment = useSetPayment();
  const { appointment, payment } = detail;
  const [status, setStatus] = useState<PaymentStatus>(appointment.paymentStatus);
  const [method, setMethod] = useState<PaymentMethod>(payment?.method ?? 'cash');
  const [amount, setAmount] = useState(payment && appointment.paymentStatus === 'partial' ? String(payment.amount) : '');
  const [amountError, setAmountError] = useState('');

  useEffect(() => {
    setStatus(appointment.paymentStatus);
    if (payment) setMethod(payment.method);
  }, [appointment.paymentStatus, payment]);

  const save = () => {
    setAmountError('');
    const values: Record<string, unknown> = { status };
    if (status !== 'unpaid') values.method = method;
    if (status === 'partial') {
      const n = Number(amount);
      if (!amount || Number.isNaN(n) || n <= 0 || n >= appointment.price) {
        setAmountError(`Enter an amount above 0 and below ${formatMoney(appointment.price, user?.currency)}.`);
        return;
      }
      values.amount = n;
    }
    setPayment.mutate(
      { id: appointment.id, values },
      {
        onSuccess: () => toast.success(`Payment marked ${PAYMENT_LABELS[status].toLowerCase()}`),
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  };

  return (
    <Panel>
      <PanelHeader title="Payment" action={<PaymentBadge status={appointment.paymentStatus} />} />
      <div className="space-y-4 p-5">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-ink-mute">Price</dt>
            <dd className="font-numeric mt-0.5 font-display text-2xl text-plum-900">{formatMoney(appointment.price, user?.currency)}</dd>
          </div>
          <div>
            <dt className="text-ink-mute">Received</dt>
            <dd className="font-numeric mt-0.5 font-display text-2xl text-plum-900">{formatMoney(appointment.amountPaid, user?.currency)}</dd>
          </div>
          {payment && (
            <div className="col-span-2 text-[13px] text-ink-mute">
              Last updated {formatDateTime(payment.paidAt)} · {METHOD_LABELS[payment.method]}
            </div>
          )}
        </dl>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="pay-status" className="block text-sm font-medium text-plum-900">
              Payment status
            </label>
            <Select id="pay-status" value={status} onChange={(e) => setStatus(e.target.value as PaymentStatus)}>
              {PAYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PAYMENT_LABELS[s]}
                </option>
              ))}
            </Select>
          </div>
          {status !== 'unpaid' && (
            <div className="space-y-1.5">
              <label htmlFor="pay-method" className="block text-sm font-medium text-plum-900">
                Payment method
              </label>
              <Select id="pay-method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {METHOD_LABELS[m]}
                  </option>
                ))}
              </Select>
            </div>
          )}
          {status === 'partial' && (
            <TextField label="Amount received" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} error={amountError} wrapperClassName="sm:col-span-2" />
          )}
        </div>
        <Button onClick={save} loading={setPayment.isPending} disabled={status === appointment.paymentStatus && status !== 'partial' && (status === 'unpaid' || method === payment?.method)}>
          Save payment
        </Button>
      </div>
    </Panel>
  );
}

function NotesPanel({ appointmentId, notes }: { appointmentId: string; notes: string }) {
  const toast = useToast();
  const update = useUpdateAppointment();
  const [value, setValue] = useState(notes);
  useEffect(() => setValue(notes), [notes]);
  return (
    <Panel>
      <PanelHeader title="Notes" />
      <div className="space-y-3 p-5">
        <TextareaField label="Appointment notes" rows={3} value={value} maxLength={1000} onChange={(e) => setValue(e.target.value)} hint="Visible to your team. Keep to business details such as preferences." />
        <Button
          variant="secondary"
          disabled={value === notes}
          loading={update.isPending}
          onClick={() =>
            update.mutate(
              { id: appointmentId, values: { notes: value } },
              { onSuccess: () => toast.success('Notes saved'), onError: (e) => toast.error(errorMessage(e)) },
            )
          }
        >
          Save notes
        </Button>
      </div>
    </Panel>
  );
}

export default function AppointmentDetailPage() {
  const { id } = useParams();
  const { isAdmin, user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const modals = useModals();
  const query = useAppointment(id);
  const update = useUpdateAppointment();
  const remove = useDeleteAppointment();
  const [confirm, setConfirm] = useState<'cancel' | 'delete' | null>(null);
  const appt = query.data?.appointment;
  useDocumentTitle(appt ? `${appt.customerName} · appointment` : 'Appointment');

  if (query.isLoading) return <PageSkeleton rows={3} />;
  if (query.error || !query.data || !appt) {
    return (
      <>
        <PageHeader title="Appointment" backTo={{ to: '/appointments', label: 'All appointments' }} />
        <ErrorState error={query.error ?? new Error('That appointment could not be found.')} onRetry={() => query.refetch()} />
      </>
    );
  }

  const canCancel = ['pending', 'confirmed', 'checked_in'].includes(appt.status);

  return (
    <>
      <PageHeader
        backTo={{ to: '/appointments', label: 'All appointments' }}
        title={appt.customerName}
        description={`${appt.serviceName} with ${appt.staffName}`}
        actions={
          isAdmin && (
            <>
              <Button variant="secondary" icon={<CalendarClock className="h-4 w-4" />} onClick={() => modals.editAppointment(appt)}>
                Edit or reschedule
              </Button>
              {canCancel && (
                <Button variant="secondary" icon={<XCircle className="h-4 w-4" />} onClick={() => setConfirm('cancel')}>
                  Cancel
                </Button>
              )}
              <Button variant="ghost" className="text-berry hover:bg-berry-100" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirm('delete')}>
                Delete
              </Button>
            </>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Panel>
            <PanelHeader title="Details" action={<StatusMenu appointmentId={appt.id} status={appt.status} />} />
            <dl className="grid gap-x-6 gap-y-5 p-5 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-ink-mute">Date</dt>
                <dd className="mt-0.5 font-medium text-plum-900">{formatDateLong(appt.date)}</dd>
              </div>
              <div>
                <dt className="text-sm text-ink-mute">Time</dt>
                <dd className="font-numeric mt-0.5 font-medium text-plum-900">{formatTimeRange(appt.startTime, appt.endTime)}</dd>
              </div>
              <div>
                <dt className="text-sm text-ink-mute">Service</dt>
                <dd className="mt-0.5 font-medium text-plum-900">
                  {appt.serviceName} <span className="font-normal text-ink-mute">· {appt.categoryName}</span>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-ink-mute">Duration</dt>
                <dd className="mt-0.5 font-medium text-plum-900">{formatDuration(appt.durationMinutes)}</dd>
              </div>
              <div>
                <dt className="text-sm text-ink-mute">Staff</dt>
                <dd className="mt-0.5 flex items-center gap-2 font-medium text-plum-900">
                  <Avatar name={appt.staffName} color={appt.staffColor} size="xs" />
                  {appt.staffName}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-ink-mute">Booked on</dt>
                <dd className="mt-0.5 font-medium text-plum-900">{formatDateTime(appt.createdAt)}</dd>
              </div>
              {!isAdmin && (
                <div>
                  <dt className="text-sm text-ink-mute">Price</dt>
                  <dd className="font-numeric mt-0.5 font-medium text-plum-900">{formatMoney(appt.price, user?.currency)}</dd>
                </div>
              )}
            </dl>
          </Panel>
          {isAdmin && <PaymentPanel detail={query.data} />}
          <NotesPanel appointmentId={appt.id} notes={appt.notes} />
        </div>

        <div className="space-y-6">
          <Panel>
            <PanelHeader title="Customer" />
            <div className="space-y-3 p-5">
              <Link to={`/customers/${appt.customerId}`} className="flex items-center gap-3 rounded-xl hover:bg-lavender-50">
                <Avatar name={appt.customerName} />
                <span>
                  <span className="block font-medium text-plum-900">{appt.customerName}</span>
                  <span className="text-[13px] text-plum-600 underline-offset-4 hover:underline">View profile</span>
                </span>
              </Link>
              {appt.customerPhone && (
                <a href={`tel:${appt.customerPhone}`} className="flex items-center gap-2.5 text-sm text-ink-soft hover:text-plum-700">
                  <Phone className="h-4 w-4 text-ink-mute" aria-hidden />
                  {appt.customerPhone}
                </a>
              )}
              {appt.customerEmail && (
                <a href={`mailto:${appt.customerEmail}`} className="flex items-center gap-2.5 text-sm text-ink-soft hover:text-plum-700">
                  <Mail className="h-4 w-4 text-ink-mute" aria-hidden />
                  {appt.customerEmail}
                </a>
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="History" />
            {query.data.history.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-ink-mute">No activity recorded yet.</p>
            ) : (
              <ol className="space-y-4 p-5">
                {query.data.history.map((h) => (
                  <li key={h.id} className="relative pl-5 text-sm before:absolute before:left-0 before:top-1.5 before:h-2 before:w-2 before:rounded-full before:bg-champagne">
                    <p className="text-ink">{h.description}</p>
                    <p className="text-xs text-ink-mute">
                      {formatDateTime(h.createdAt)}
                      {h.userName ? ` · ${h.userName}` : ''}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>

      <ConfirmDialog
        open={confirm === 'cancel'}
        title="Cancel this appointment?"
        message="The time will open up again, and the customer will be emailed if they have an address on file."
        confirmLabel="Cancel appointment"
        loading={update.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={() =>
          update.mutate(
            { id: appt.id, values: { status: 'cancelled' } },
            {
              onSuccess: () => {
                toast.success('Appointment cancelled');
                setConfirm(null);
              },
              onError: (e) => {
                toast.error(errorMessage(e));
                setConfirm(null);
              },
            },
          )
        }
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        title="Delete this appointment?"
        message="This removes the appointment and any payment recorded against it. This can’t be undone. To keep a record, cancel it instead."
        confirmLabel="Delete appointment"
        loading={remove.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={() =>
          remove.mutate(appt.id, {
            onSuccess: () => {
              toast.success('Appointment deleted');
              navigate('/appointments', { replace: true });
            },
            onError: (e) => {
              toast.error(errorMessage(e));
              setConfirm(null);
            },
          })
        }
      />
    </>
  );
}
