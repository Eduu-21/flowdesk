import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useToast } from '@/context/ToastContext';
import { useCategories, useSaveService } from '@/hooks/queries';
import { errorMessage } from '@/lib/api';
import { applyServerErrors } from '@/lib/forms';
import { serviceSchema, type ServiceValues } from '@/schemas';
import type { Service } from '@/types';
import { Button } from '../ui/Button';
import { TextareaField, TextField, Toggle } from '../ui/Form';
import { Modal } from '../ui/Modal';

interface Props {
  open: boolean;
  service?: Service | null;
  onClose: () => void;
}

export function ServiceFormModal({ open, service, onClose }: Props) {
  const toast = useToast();
  const save = useSaveService();
  const categories = useCategories();
  const {
    register,
    handleSubmit,
    setError,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ServiceValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: service?.name ?? '',
      category: service?.category ?? 'Hair',
      description: service?.description ?? '',
      durationMinutes: service?.durationMinutes ?? 60,
      price: service?.price ?? 0,
      isActive: service?.isActive ?? true,
    },
  });

  const onSubmit = handleSubmit((values) =>
    save.mutate(
      { id: service?.id, values },
      {
        onSuccess: () => {
          toast.success(service ? 'Service updated' : 'Service added');
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
      title={service ? 'Edit service' : 'Add service'}
      dismissible={!save.isPending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="service-form" loading={save.isPending}>
            {service ? 'Save changes' : 'Add service'}
          </Button>
        </>
      }
    >
      <form id="service-form" onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        <TextField label="Service name" required error={errors.name?.message} {...register('name')} wrapperClassName="sm:col-span-2" />
        <div>
          <TextField
            label="Category"
            required
            list="service-categories"
            error={errors.category?.message}
            hint="Pick one or type a new category."
            {...register('category')}
          />
          <datalist id="service-categories">
            {categories.data?.data.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
        </div>
        <TextField
          label="Duration (minutes)"
          required
          type="number"
          inputMode="numeric"
          min={5}
          step={5}
          error={errors.durationMinutes?.message}
          {...register('durationMinutes', { valueAsNumber: true })}
        />
        <TextField
          label="Price"
          required
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          error={errors.price?.message}
          {...register('price', { valueAsNumber: true })}
        />
        <div className="flex items-end pb-2">
          <div className="w-full">
            <Toggle
              label="Available for booking"
              description="Inactive services are hidden from new bookings."
              checked={watch('isActive')}
              onChange={(v) => setValue('isActive', v, { shouldDirty: true })}
            />
          </div>
        </div>
        <TextareaField label="Description" rows={3} error={errors.description?.message} {...register('description')} wrapperClassName="sm:col-span-2" />
      </form>
    </Modal>
  );
}
