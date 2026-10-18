import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useToast } from '@/context/ToastContext';
import { useUser } from '@/context/AuthContext';
import { useAvailability, useServices, useStaffList, useUpdateAppointment } from '@/hooks/queries';
import { errorMessage } from '@/lib/api';
import { formatDateLong, formatTime, formatTimeRange, todayIn } from '@/lib/dates';
import { applyServerErrors } from '@/lib/forms';
import { appointmentEditSchema, type AppointmentEditValues } from '@/schemas';
import type { Appointment } from '@/types';
import { Button } from '../ui/Button';
import { Input, SelectField, TextareaField, TextField } from '../ui/Form';
import { Modal } from '../ui/Modal';

interface Props {
  open: boolean;
  appointment: Appointment;
  onClose: () => void;
}

const RESCHEDULABLE = ['pending', 'confirmed', 'checked_in'];

/** Edit or reschedule an appointment. Completed, cancelled and no-show visits only allow notes and price. */
export function AppointmentEditModal({ open, appointment, onClose }: Props) {
  const user = useUser();
  const toast = useToast();
  const update = useUpdateAppointment();
  const services = useServices();
  const staffList = useStaffList();
  const locked = !RESCHEDULABLE.includes(appointment.status);
  const today = todayIn(user.timezone);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, dirtyFields },
  } = useForm<AppointmentEditValues>({
    resolver: zodResolver(appointmentEditSchema),
    defaultValues: {
      serviceId: appointment.serviceId,
      staffId: appointment.staffId,
      date: appointment.date,
      startTime: appointment.startTime,
      price: appointment.price,
      notes: appointment.notes,
    },
  });

  const serviceId = watch('serviceId');
  const staffId = watch('staffId');
  const date = watch('date');
  const startTime = watch('startTime');
  const availability = useAvailability({ staffId, serviceId, date, excludeId: appointment.id });

  // Changing the service updates the price to the new service's price
  const firstService = useRef(serviceId);
  useEffect(() => {
    if (serviceId === firstService.current) return;
    const s = services.data?.data.find((x) => x.id === serviceId);
    if (s) setValue('price', s.price, { shouldDirty: true });
  }, [serviceId, services.data, setValue]);

  const slots = availability.data?.slots ?? [];

  const onSubmit = handleSubmit((values) => {
    const changes: Record<string, unknown> = {};
    if (values.notes !== appointment.notes) changes.notes = values.notes;
    if (values.price !== appointment.price) changes.price = values.price;
    if (!locked) {
      if (values.serviceId !== appointment.serviceId) changes.serviceId = values.serviceId;
      if (values.staffId !== appointment.staffId) changes.staffId = values.staffId;
      if (values.date !== appointment.date) changes.date = values.date;
      if (values.startTime !== appointment.startTime) changes.startTime = values.startTime;
    }
    if (!Object.keys(changes).length) {
      onClose();
      return;
    }
    update.mutate(
      { id: appointment.id, values: changes },
      {
        onSuccess: () => {
          toast.success('Appointment updated');
          onClose();
        },
        onError: (error) => {
          if (!applyServerErrors(error, setError)) toast.error(errorMessage(error));
          else toast.error(errorMessage(error));
        },
      },
    );
  });

  void dirtyFields;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit appointment"
      description={`${appointment.customerName} · ${formatDateLong(appointment.date)}, ${formatTimeRange(appointment.startTime, appointment.endTime)}`}
      dismissible={!update.isPending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={update.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="appointment-edit-form" loading={update.isPending}>
            Save changes
          </Button>
        </>
      }
    >
      {locked && (
        <p className="mb-4 rounded-xl bg-champagne-100 px-4 py-3 text-sm text-champagne-600">
          This appointment is {appointment.status.replace('_', ' ')}, so its date, time and service are locked. You can still update the price and notes.
        </p>
      )}
      <form id="appointment-edit-form" onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Service" disabled={locked} error={errors.serviceId?.message} {...register('serviceId')}>
          {services.data?.data
            .filter((s) => s.isActive || s.id === appointment.serviceId)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </SelectField>
        <SelectField label="Staff member" disabled={locked} error={errors.staffId?.message} {...register('staffId')}>
          {staffList.data?.data
            .filter((s) => s.status === 'active' || s.id === appointment.staffId)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </SelectField>
        <div className="space-y-1.5">
          <label htmlFor="edit-date" className="block text-sm font-medium text-plum-900">
            Date
          </label>
          <Input
            id="edit-date"
            type="date"
            min={today}
            disabled={locked}
            aria-invalid={!!errors.date}
            {...register('date', { onChange: () => setValue('startTime', '') })}
          />
          {errors.date && (
            <p role="alert" className="text-[13px] text-berry">
              {errors.date.message}
            </p>
          )}
        </div>
        <SelectField
          label="Start time"
          disabled={locked}
          error={errors.startTime?.message}
          hint={availability.data && slots.length === 0 ? availability.data.reason : undefined}
          {...register('startTime')}
        >
          {(locked || !startTime) && <option value={locked ? appointment.startTime : ''}>{locked ? formatTime(appointment.startTime) : 'Choose a time'}</option>}
          {!locked &&
            slots.map((s) => (
              <option key={s.start} value={s.start}>
                {formatTime(s.start)}
              </option>
            ))}
        </SelectField>
        <TextField
          label="Price"
          type="number"
          min={0}
          step="0.01"
          error={errors.price?.message}
          {...register('price', { valueAsNumber: true })}
        />
        <TextareaField label="Notes" rows={3} error={errors.notes?.message} {...register('notes')} wrapperClassName="sm:col-span-2" />
      </form>
    </Modal>
  );
}
