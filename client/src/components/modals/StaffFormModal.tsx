import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useToast } from '@/context/ToastContext';
import { useSaveStaff } from '@/hooks/queries';
import { errorMessage } from '@/lib/api';
import { applyServerErrors } from '@/lib/forms';
import { staffSchema, type StaffValues } from '@/schemas';
import type { Staff } from '@/types';
import { AvatarUpload } from '../AvatarUpload';
import { Button } from '../ui/Button';
import { PasswordField, SelectField, TextField } from '../ui/Form';
import { Modal } from '../ui/Modal';

interface Props {
  open: boolean;
  staff?: Staff | null;
  onClose: () => void;
}

export function StaffFormModal({ open, staff, onClose }: Props) {
  const toast = useToast();
  const save = useSaveStaff();
  const [avatar, setAvatar] = useState<string | null>(staff?.avatarUrl ?? null);
  const [avatarTouched, setAvatarTouched] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm<StaffValues>({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      name: staff?.name ?? '',
      email: staff?.email ?? '',
      phone: staff?.phone ?? '',
      roleTitle: staff?.roleTitle ?? 'Stylist',
      specialties: staff?.specialties.join(', ') ?? '',
      status: staff?.status ?? 'active',
      password: '',
    },
  });

  const onSubmit = handleSubmit((values) => {
    const payload: Record<string, unknown> = {
      name: values.name,
      email: values.email,
      phone: values.phone,
      roleTitle: values.roleTitle,
      status: values.status,
      specialties: values.specialties
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };
    if (avatarTouched) payload.avatarUrl = avatar;
    if (!staff && values.password) payload.password = values.password;
    save.mutate(
      { id: staff?.id, values: payload },
      {
        onSuccess: () => {
          toast.success(staff ? 'Staff member updated' : 'Staff member added');
          onClose();
        },
        onError: (error) => {
          if (!applyServerErrors(error, setError)) toast.error(errorMessage(error));
        },
      },
    );
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={staff ? 'Edit staff member' : 'Add staff member'}
      dismissible={!save.isPending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="staff-form" loading={save.isPending}>
            {staff ? 'Save changes' : 'Add staff member'}
          </Button>
        </>
      }
    >
      <form id="staff-form" onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <AvatarUpload
            name={watch('name')}
            color={staff?.avatarColor}
            value={avatar}
            onChange={(v) => {
              setAvatar(v);
              setAvatarTouched(true);
            }}
          />
        </div>
        <TextField label="Full name" required error={errors.name?.message} {...register('name')} />
        <TextField label="Role" required placeholder="Stylist" error={errors.roleTitle?.message} {...register('roleTitle')} />
        <TextField label="Email" required type="email" error={errors.email?.message} {...register('email')} />
        <TextField label="Phone" type="tel" placeholder="+251 91 123 4567" error={errors.phone?.message} {...register('phone')} />
        <TextField
          label="Specialties"
          hint="Separate with commas, e.g. Braiding, Silk press."
          error={errors.specialties?.message}
          {...register('specialties')}
          wrapperClassName="sm:col-span-2"
        />
        <SelectField label="Status" error={errors.status?.message} {...register('status')}>
          <option value="active">Active</option>
          <option value="inactive">Inactive (cannot sign in or be booked)</option>
        </SelectField>
        {!staff && (
          <PasswordField
            label="Login password (optional)"
            autoComplete="new-password"
            hint="Give them a password so they can sign in and see their own schedule."
            error={errors.password?.message}
            {...register('password')}
          />
        )}
      </form>
    </Modal>
  );
}
