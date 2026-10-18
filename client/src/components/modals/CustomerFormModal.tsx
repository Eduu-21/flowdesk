import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useToast } from '@/context/ToastContext';
import { useSaveCustomer } from '@/hooks/queries';
import { errorMessage } from '@/lib/api';
import { applyServerErrors } from '@/lib/forms';
import { customerSchema, type CustomerValues } from '@/schemas';
import type { Customer } from '@/types';
import { Button } from '../ui/Button';
import { SelectField, TextareaField, TextField } from '../ui/Form';
import { Modal } from '../ui/Modal';

interface Props {
  open: boolean;
  customer?: Customer | null;
  onClose: () => void;
  onSaved?: (customer: Customer) => void;
}

export function CustomerFormModal({ open, customer, onClose, onSaved }: Props) {
  const toast = useToast();
  const save = useSaveCustomer();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CustomerValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: customer?.name ?? '',
      phone: customer?.phone ?? '',
      email: customer?.email ?? '',
      preferredService: customer?.preferredService ?? '',
      preferredStaff: customer?.preferredStaff ?? '',
      schedulingPreference: customer?.schedulingPreference ?? '',
      status: customer?.status ?? 'active',
    },
  });

  const onSubmit = handleSubmit((values) =>
    save.mutate(
      { id: customer?.id, values },
      {
        onSuccess: (res) => {
          toast.success(customer ? 'Customer updated' : 'Customer added');
          onSaved?.((res as { customer: Customer }).customer);
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
      title={customer ? 'Edit customer' : 'Add customer'}
      description={customer ? undefined : 'Save their details once, then book as often as they visit.'}
      dismissible={!save.isPending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="customer-form" loading={save.isPending}>
            {customer ? 'Save changes' : 'Add customer'}
          </Button>
        </>
      }
    >
      <form id="customer-form" onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        <TextField label="Full name" required autoComplete="off" error={errors.name?.message} {...register('name')} wrapperClassName="sm:col-span-2" />
        <TextField label="Phone" required type="tel" placeholder="+251 91 123 4567" error={errors.phone?.message} {...register('phone')} />
        <TextField label="Email" type="email" placeholder="Optional" error={errors.email?.message} {...register('email')} />
        <TextField label="Preferred service" error={errors.preferredService?.message} {...register('preferredService')} />
        <TextField label="Preferred staff member" error={errors.preferredStaff?.message} {...register('preferredStaff')} />
        <TextareaField
          label="Scheduling preference"
          rows={2}
          hint="For example: weekday mornings, or every second Friday."
          error={errors.schedulingPreference?.message}
          {...register('schedulingPreference')}
          wrapperClassName="sm:col-span-2"
        />
        <SelectField label="Status" error={errors.status?.message} {...register('status')}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </SelectField>
      </form>
    </Modal>
  );
}
