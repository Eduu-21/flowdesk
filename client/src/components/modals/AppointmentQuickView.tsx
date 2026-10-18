import { CalendarClock, ExternalLink, Phone, StickyNote, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useAppointment, useUpdateAppointment } from '@/hooks/queries';
import { errorMessage } from '@/lib/api';
import { formatDateLong, formatTimeRange } from '@/lib/dates';
import { formatDuration, formatMoney } from '@/lib/format';
import { PaymentBadge, StatusMenu } from '../StatusBadge';
import { Button } from '../ui/Button';
import { ErrorState, Skeleton } from '../ui/Feedback';
import { Avatar } from '../ui/Misc';
import { ConfirmDialog, Modal } from '../ui/Modal';
import { useModals } from './ModalsContext';

interface Props {
  appointmentId: string;
  open: boolean;
  onClose: () => void;
}

const CANCELLABLE = ['pending', 'confirmed', 'checked_in'];

export function AppointmentQuickView({ appointmentId, open, onClose }: Props) {
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const modals = useModals();
  const query = useAppointment(appointmentId);
  const update = useUpdateAppointment();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const appt = query.data?.appointment;

  const cancel = () =>
    update.mutate(
      { id: appointmentId, values: { status: 'cancelled' } },
      {
        onSuccess: () => {
          toast.success('Appointment cancelled');
          setConfirmCancel(false);
        },
        onError: (error) => {
          toast.error(errorMessage(error));
          setConfirmCancel(false);
        },
      },
    );

  return (
    <>
      <Modal
        open={open && !confirmCancel}
        onClose={onClose}
        title={appt ? appt.customerName : 'Appointment'}
        description={appt ? `${appt.serviceName} with ${appt.staffName}` : undefined}
        footer={
          appt && (
            <>
              {isAdmin && CANCELLABLE.includes(appt.status) && (
                <Button variant="ghost" className="mr-auto text-berry hover:bg-berry-100" icon={<XCircle className="h-4 w-4" />} onClick={() => setConfirmCancel(true)}>
                  Cancel appointment
                </Button>
              )}
              {isAdmin && (
                <Button
                  variant="secondary"
                  icon={<CalendarClock className="h-4 w-4" />}
                  onClick={() => {
                    onClose();
                    modals.editAppointment(appt);
                  }}
                >
                  Edit or reschedule
                </Button>
              )}
              <Link
                to={`/appointments/${appt.id}`}
                onClick={onClose}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-plum-700 px-4 text-sm font-medium text-ivory transition-colors hover:bg-plum-600"
              >
                <ExternalLink className="h-4 w-4" />
                Open details
              </Link>
            </>
          )
        }
      >
        {query.isLoading && (
          <div className="space-y-3" role="status" aria-label="Loading appointment">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-20" />
            <Skeleton className="h-16" />
          </div>
        )}
        {query.error && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
        {appt && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <StatusMenu appointmentId={appt.id} status={appt.status} />
              {isAdmin && <PaymentBadge status={appt.paymentStatus} />}
            </div>
            <dl className="divide-y divide-sand/60 rounded-2xl border border-sand bg-white text-sm">
              <div className="flex justify-between gap-4 px-4 py-3">
                <dt className="text-ink-mute">When</dt>
                <dd className="text-right font-medium text-plum-900">
                  {formatDateLong(appt.date)}
                  <span className="font-numeric block font-normal text-ink-soft">{formatTimeRange(appt.startTime, appt.endTime)}</span>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <dt className="text-ink-mute">Staff</dt>
                <dd className="flex items-center gap-2 font-medium text-plum-900">
                  <Avatar name={appt.staffName} color={appt.staffColor} size="xs" />
                  {appt.staffName}
                </dd>
              </div>
              <div className="flex justify-between gap-4 px-4 py-3">
                <dt className="text-ink-mute">Duration</dt>
                <dd className="font-medium text-plum-900">{formatDuration(appt.durationMinutes)}</dd>
              </div>
              <div className="flex justify-between gap-4 px-4 py-3">
                <dt className="text-ink-mute">Price</dt>
                <dd className="font-numeric font-medium text-plum-900">{formatMoney(appt.price, user?.currency)}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-soft">
              <Link to={`/customers/${appt.customerId}`} onClick={onClose} className="rounded-md underline-offset-4 hover:text-plum-700 hover:underline">
                View customer profile
              </Link>
              {appt.customerPhone && (
                <a href={`tel:${appt.customerPhone}`} className="inline-flex items-center gap-1.5 rounded-md hover:text-plum-700">
                  <Phone className="h-3.5 w-3.5" aria-hidden />
                  {appt.customerPhone}
                </a>
              )}
            </div>
            {appt.notes && (
              <div className="flex gap-3 rounded-2xl bg-champagne-100/60 px-4 py-3 text-sm text-ink-soft">
                <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-champagne-600" aria-hidden />
                <p>{appt.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
      <ConfirmDialog
        open={open && confirmCancel}
        title="Cancel this appointment?"
        message={
          <>
            {appt?.customerName}’s {appt?.serviceName} on {appt && formatDateLong(appt.date)} will be cancelled and the time will open up again. If they have an email on file, they will be told.
          </>
        }
        confirmLabel="Cancel appointment"
        loading={update.isPending}
        onConfirm={cancel}
        onClose={() => setConfirmCancel(false)}
      />
    </>
  );
}
