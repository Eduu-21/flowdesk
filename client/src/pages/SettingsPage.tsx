import { zodResolver } from '@hookform/resolvers/zod';
import { LogOut, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { AvatarUpload } from '@/components/AvatarUpload';
import { Button } from '@/components/ui/Button';
import { Skeleton, ErrorState } from '@/components/ui/Feedback';
import { PasswordField, TextareaField, TextField, Toggle } from '@/components/ui/Form';
import { ConfirmDialog } from '@/components/ui/Modal';
import { PageHeader, Panel, PanelHeader, Tabs } from '@/components/ui/Misc';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useAction, useSessionInfo, useStudio } from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDebounce';
import { api, errorMessage, tokenStore } from '@/lib/api';
import { formatDateTime } from '@/lib/dates';
import { applyServerErrors } from '@/lib/forms';
import {
  changePasswordSchema,
  profileSchema,
  studioSchema,
  type ChangePasswordValues,
  type ProfileValues,
  type StudioValues,
} from '@/schemas';
import type { NotificationPrefs, StudioSettings, User } from '@/types';

type Tab = 'profile' | 'studio' | 'notifications' | 'security';

/* --------------------------------- profile --------------------------------- */
function ProfileTab() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const save = useAction((body: Record<string, unknown>) => api.put<{ user: User }>('/settings/profile', body));
  const [avatar, setAvatar] = useState<string | null>(user?.avatarUrl ?? null);
  const [avatarTouched, setAvatarTouched] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name ?? '', email: user?.email ?? '', phone: user?.phone ?? '' },
  });

  const onSubmit = handleSubmit((values) => {
    const body: Record<string, unknown> = { ...values };
    if (avatarTouched) body.avatarUrl = avatar;
    save.mutate(body, {
      onSuccess: (res) => {
        setUser(res.user);
        setAvatarTouched(false);
        toast.success('Profile updated');
      },
      onError: (error) => {
        if (!applyServerErrors(error, setError)) toast.error(errorMessage(error));
      },
    });
  });

  return (
    <Panel>
      <PanelHeader title="Your profile" description="How your name and photo appear across FlowDesk." />
      <form onSubmit={onSubmit} noValidate className="grid max-w-2xl gap-5 px-5 py-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <AvatarUpload
            name={watch('name')}
            value={avatar}
            onChange={(v) => {
              setAvatar(v);
              setAvatarTouched(true);
            }}
          />
        </div>
        <TextField label="Full name" required autoComplete="name" error={errors.name?.message} {...register('name')} />
        <TextField label="Email" required type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <TextField label="Phone" type="tel" autoComplete="tel" placeholder="+251 91 123 4567" error={errors.phone?.message} {...register('phone')} />
        <div className="flex items-end sm:col-span-2">
          <Button type="submit" loading={save.isPending}>
            Save profile
          </Button>
        </div>
      </form>
    </Panel>
  );
}

/* ---------------------------------- studio ---------------------------------- */
const COMMON_ZONES = ['Africa/Addis_Ababa', 'Africa/Nairobi', 'Africa/Lagos', 'Africa/Cairo', 'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Los_Angeles', 'Asia/Dubai', 'Asia/Kolkata'];

function zoneOptions(): string[] {
  try {
    const all = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('timeZone');
    if (all?.length) return all;
  } catch {
    /* fall through */
  }
  return COMMON_ZONES;
}

function StudioForm({ studio }: { studio: StudioSettings }) {
  const { setUser } = useAuth();
  const toast = useToast();
  const save = useAction((body: StudioValues) => api.put<{ studio: StudioSettings }>('/settings/studio', body));
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<StudioValues>({
    resolver: zodResolver(studioSchema),
    defaultValues: {
      name: studio.name,
      description: studio.description,
      phone: studio.phone,
      email: studio.email,
      address: studio.address,
      currency: studio.currency,
      timezone: studio.timezone,
    },
  });

  const onSubmit = handleSubmit((values) =>
    save.mutate(values, {
      onSuccess: async () => {
        // The user object carries the studio name, currency and time zone, so refresh it.
        try {
          const me = await api.get<{ user: User }>('/auth/me');
          setUser(me.user);
        } catch {
          /* the next page load will pick it up */
        }
        toast.success('Business details saved');
      },
      onError: (error) => {
        if (!applyServerErrors(error, setError)) toast.error(errorMessage(error));
      },
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="grid max-w-2xl gap-5 px-5 py-5 sm:grid-cols-2">
      <TextField label="Business name" required error={errors.name?.message} {...register('name')} wrapperClassName="sm:col-span-2" />
      <TextareaField label="Description" hint="A short line about your studio." error={errors.description?.message} {...register('description')} wrapperClassName="sm:col-span-2" />
      <TextField label="Business phone" type="tel" error={errors.phone?.message} {...register('phone')} />
      <TextField label="Business email" type="email" error={errors.email?.message} {...register('email')} />
      <TextField label="Address" error={errors.address?.message} {...register('address')} wrapperClassName="sm:col-span-2" />
      <TextField label="Currency" required maxLength={3} hint="Three-letter code, e.g. ETB or USD." className="uppercase" error={errors.currency?.message} {...register('currency')} />
      <TextField label="Time zone" required list="timezones" hint="Used for today’s schedule and reminders." error={errors.timezone?.message} {...register('timezone')} />
      <datalist id="timezones">
        {zoneOptions().map((zone) => (
          <option key={zone} value={zone} />
        ))}
      </datalist>
      <div className="sm:col-span-2">
        <Button type="submit" loading={save.isPending}>
          Save business details
        </Button>
      </div>
    </form>
  );
}

function StudioTab() {
  const query = useStudio();
  return (
    <Panel>
      <PanelHeader title="Business details" description="Shown in your account and used for scheduling." />
      {query.error && !query.data ? (
        <div className="p-5">
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        </div>
      ) : !query.data ? (
        <div className="space-y-4 p-5" role="status" aria-label="Loading business details">
          <Skeleton className="h-11 max-w-2xl" />
          <Skeleton className="h-24 max-w-2xl" />
          <Skeleton className="h-11 max-w-2xl" />
        </div>
      ) : (
        <StudioForm studio={query.data.studio} />
      )}
    </Panel>
  );
}

/* ------------------------------ notifications ------------------------------ */
const PREF_LABELS: { key: keyof NotificationPrefs; label: string; description: string; adminOnly?: boolean }[] = [
  { key: 'appointment_reminders', label: 'Appointment reminders', description: 'A nudge in FlowDesk shortly before an appointment starts.' },
  { key: 'booking_notifications', label: 'New bookings', description: 'Tell me when an appointment is booked.' },
  { key: 'cancellation_notifications', label: 'Cancellations', description: 'Tell me when an appointment is cancelled or marked as a no-show.' },
  { key: 'email_notifications', label: 'Also send by email', description: 'Email a copy of these notifications to your address.' },
];

function NotificationsTab() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const save = useAction((prefs: NotificationPrefs) => api.put<{ user: User }>('/settings/notifications', prefs));
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(user?.notificationPrefs ?? null);

  useEffect(() => {
    if (user) setPrefs(user.notificationPrefs);
  }, [user]);

  if (!prefs) return null;

  const change = (key: keyof NotificationPrefs, value: boolean) => {
    const previous = prefs;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    save.mutate(next, {
      onSuccess: (res) => {
        setUser(res.user);
        toast.success('Preference saved');
      },
      onError: (error) => {
        setPrefs(previous);
        toast.error(errorMessage(error));
      },
    });
  };

  return (
    <Panel>
      <PanelHeader title="Notification preferences" description="Choose what FlowDesk tells you about. Changes save as you go." />
      <div className="max-w-2xl divide-y divide-sand/60 px-5">
        {PREF_LABELS.map((pref) => (
          <div key={pref.key} className="py-4">
            <Toggle label={pref.label} description={pref.description} checked={prefs[pref.key]} onChange={(v) => change(pref.key, v)} disabled={save.isPending} />
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* --------------------------------- security --------------------------------- */
function SecurityTab() {
  const { logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const session = useSessionInfo();
  const change = useAction((values: ChangePasswordValues) =>
    api.put<{ token: string }>('/auth/password', values),
  );
  const [confirmAll, setConfirmAll] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit((values) =>
    change.mutate(
      values,
      {
        onSuccess: (res) => {
          // The server issues a fresh token because every other device was signed out.
          tokenStore.refresh(res.token);
          reset();
          toast.success('Password updated. Other devices were signed out.');
        },
        onError: (error) => {
          if (!applyServerErrors(error, setError)) toast.error(errorMessage(error));
        },
      },
    ),
  );

  const signOutEverywhere = async () => {
    setSigningOut(true);
    try {
      await api.post('/auth/logout-all');
      await logout();
      navigate('/login', { replace: true });
    } catch (error) {
      toast.error(errorMessage(error));
      setSigningOut(false);
      setConfirmAll(false);
    }
  };

  const info = session.data?.session;

  return (
    <div className="space-y-6">
      <Panel>
        <PanelHeader title="Change password" description="Use at least 8 characters with upper and lower case letters and a number." />
        <form onSubmit={onSubmit} noValidate className="grid max-w-md gap-4 px-5 py-5">
          <PasswordField label="Current password" autoComplete="current-password" error={errors.currentPassword?.message} {...register('currentPassword')} />
          <PasswordField label="New password" autoComplete="new-password" error={errors.newPassword?.message} {...register('newPassword')} />
          <PasswordField label="Confirm new password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
          <div>
            <Button type="submit" loading={change.isPending}>
              Update password
            </Button>
          </div>
        </form>
      </Panel>

      <Panel>
        <PanelHeader title="Sign-in activity" />
        <div className="space-y-4 px-5 py-5">
          {session.isLoading ? (
            <Skeleton className="h-16 max-w-md" />
          ) : session.error ? (
            <p className="text-sm text-ink-mute">We couldn’t load your sign-in details right now.</p>
          ) : (
            <dl className="grid max-w-2xl gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-[13px] text-ink-mute">Last sign-in</dt>
                <dd className="mt-0.5 text-sm text-ink">{info?.lastLoginAt ? formatDateTime(info.lastLoginAt) : 'This is your first session'}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-ink-mute">From</dt>
                <dd className="mt-0.5 text-sm text-ink">{info?.lastLoginIp || 'Unknown location'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[13px] text-ink-mute">Device</dt>
                <dd className="mt-0.5 break-words text-sm text-ink">{info?.lastLoginAgent || 'Unknown device'}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-ink-mute">Account created</dt>
                <dd className="mt-0.5 text-sm text-ink">{info ? formatDateTime(info.accountCreatedAt) : ''}</dd>
              </div>
            </dl>
          )}
          <div className="flex flex-wrap items-center gap-3 border-t border-sand/60 pt-4">
            <ShieldCheck className="h-5 w-5 text-sage" aria-hidden />
            <p className="flex-1 text-sm text-ink-soft">Lost a device or used a shared computer? Sign out everywhere, including this browser.</p>
            <Button variant="secondary" icon={<LogOut className="h-4 w-4" />} onClick={() => setConfirmAll(true)}>
              Sign out of all devices
            </Button>
          </div>
        </div>
      </Panel>

      <ConfirmDialog
        open={confirmAll}
        title="Sign out of all devices?"
        message="You’ll be signed out here too and will need to sign in again."
        confirmLabel="Sign out everywhere"
        cancelLabel="Cancel"
        destructive={false}
        loading={signingOut}
        onConfirm={() => void signOutEverywhere()}
        onClose={() => setConfirmAll(false)}
      />
    </div>
  );
}

/* ----------------------------------- page ----------------------------------- */
export default function SettingsPage() {
  useDocumentTitle('Settings');
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const { tab } = useParams();

  const tabs: { value: Tab; label: string }[] = [
    { value: 'profile', label: 'Profile' },
    ...(isAdmin ? [{ value: 'studio' as const, label: 'Business' }] : []),
    { value: 'notifications', label: 'Notifications' },
    { value: 'security', label: 'Security' },
  ];

  const current = tabs.find((t) => t.value === tab);
  if (!current) return <Navigate to="/settings/profile" replace />;

  return (
    <>
      <PageHeader title="Settings" description="Your account, your business and how FlowDesk keeps in touch." />
      <div className="mb-6">
        <Tabs label="Settings sections" variant="underline" value={current.value} onChange={(value) => navigate(`/settings/${value}`)} tabs={tabs} />
      </div>
      {current.value === 'profile' && <ProfileTab />}
      {current.value === 'studio' && <StudioTab />}
      {current.value === 'notifications' && <NotificationsTab />}
      {current.value === 'security' && <SecurityTab />}
    </>
  );
}
