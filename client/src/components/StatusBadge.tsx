import { ChevronDown } from 'lucide-react';
import { useUpdateAppointment } from '@/hooks/queries';
import { errorMessage } from '@/lib/api';
import { PAYMENT_LABELS, PAYMENT_STYLES, STATUS_LABELS, STATUS_STYLES } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useToast } from '@/context/ToastContext';
import { APPOINTMENT_STATUSES, type AppointmentStatus, type PaymentStatus } from '@/types';
import { Badge } from './ui/Misc';
import { Dropdown } from './ui/Dropdown';

export function StatusBadge({ status, className }: { status: AppointmentStatus; className?: string }) {
  const style = STATUS_STYLES[status];
  return (
    <Badge className={cn(style.badge, className)} dot={style.dot}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function PaymentBadge({ status, className }: { status: PaymentStatus; className?: string }) {
  return <Badge className={cn(PAYMENT_STYLES[status], className)}>{PAYMENT_LABELS[status]}</Badge>;
}

/** Badge that opens a menu to change an appointment's status immediately. */
export function StatusMenu({
  appointmentId,
  status,
  disabled,
  onChanged,
}: {
  appointmentId: string;
  status: AppointmentStatus;
  disabled?: boolean;
  onChanged?: (status: AppointmentStatus) => void;
}) {
  const update = useUpdateAppointment();
  const toast = useToast();

  const change = (next: AppointmentStatus) => {
    if (next === status) return;
    update.mutate(
      { id: appointmentId, values: { status: next } },
      {
        onSuccess: () => {
          toast.success(`Marked as ${STATUS_LABELS[next].toLowerCase()}`);
          onChanged?.(next);
        },
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  };

  if (disabled) return <StatusBadge status={status} />;

  return (
    <Dropdown
      label={`Change status, currently ${STATUS_LABELS[status]}`}
      align="left"
      triggerClassName="gap-1 rounded-full pr-1.5 hover:brightness-95 disabled:opacity-60"
      trigger={
        <span className="inline-flex items-center gap-0.5">
          <StatusBadge status={status} className={update.isPending ? 'opacity-60' : undefined} />
          <ChevronDown className="h-3.5 w-3.5 text-ink-mute" aria-hidden />
        </span>
      }
      items={APPOINTMENT_STATUSES.map((s) => ({
        label: STATUS_LABELS[s],
        active: s === status,
        danger: s === 'cancelled' || s === 'no_show',
        onSelect: () => change(s),
      }))}
    />
  );
}
