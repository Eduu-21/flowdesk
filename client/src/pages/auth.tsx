import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Checkbox, PasswordField, TextField } from '@/components/ui/Form';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useDocumentTitle } from '@/hooks/useDebounce';
import { api, ApiError, errorMessage } from '@/lib/api';
import { applyServerErrors } from '@/lib/forms';
import { AuthLayout } from '@/layouts/AuthLayout';
import {
  forgotSchema,
  loginSchema,
  registerSchema,
  resetSchema,
  type ForgotValues,
  type LoginValues,
  type RegisterValues,
  type ResetValues,
} from '@/schemas';

const FormError = ({ message }: { message: string }) =>
  message ? (
    <p role="alert" className="rounded-xl bg-berry-100 px-4 py-3 text-sm text-berry">
      {message}
    </p>
  ) : null;

const DEMO = { email: 'demo@flowdesk.local', password: 'DemoPassword123!' };

/* ---------------------------------- login ---------------------------------- */
export function LoginPage() {
  useDocumentTitle('Sign in');
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState('');
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', remember: false },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError('');
    try {
      await login(values.email, values.password, values.remember);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== '/login' ? from : '/dashboard', { replace: true });
    } catch (error) {
      setFormError(errorMessage(error));
    }
  });

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to see today’s appointments."
      footer={
        <>
          New to FlowDesk?{' '}
          <Link to="/register" className="font-medium text-plum-700 underline-offset-4 hover:underline">
            Create a studio account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormError message={formError} />
        <TextField label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <PasswordField label="Password" autoComplete="current-password" error={errors.password?.message} {...register('password')} />
        <div className="flex items-center justify-between">
          <Checkbox label="Remember me" {...register('remember')} />
          <Link to="/forgot-password" className="rounded-md text-sm font-medium text-plum-700 underline-offset-4 hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" className="w-full" loading={isSubmitting}>
          Sign in
        </Button>
        <Button
          variant="soft"
          className="w-full"
          onClick={() => {
            setValue('email', DEMO.email);
            setValue('password', DEMO.password);
          }}
        >
          Fill in the demo account
        </Button>
      </form>
    </AuthLayout>
  );
}

/* --------------------------------- register --------------------------------- */
export function RegisterPage() {
  useDocumentTitle('Create account');
  const { register: signUp } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [formError, setFormError] = useState('');
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError('');
    try {
      await signUp(values);
      toast.success('Your studio is ready. Welcome to FlowDesk.');
      navigate('/dashboard', { replace: true });
    } catch (error) {
      if (!applyServerErrors(error, setError)) setFormError(errorMessage(error));
    }
  });

  return (
    <AuthLayout
      title="Set up your studio"
      subtitle="Create an owner account. You can add your team after."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-plum-700 underline-offset-4 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormError message={formError} />
        <TextField label="Full name" autoComplete="name" error={errors.name?.message} {...register('name')} />
        <TextField label="Studio or business name" autoComplete="organization" error={errors.studioName?.message} {...register('studioName')} />
        <TextField label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <PasswordField
          label="Password"
          autoComplete="new-password"
          hint="At least 8 characters with upper and lower case letters and a number."
          error={errors.password?.message}
          {...register('password')}
        />
        <PasswordField label="Confirm password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
        <Button type="submit" className="w-full" loading={isSubmitting}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}

/* ----------------------------- forgot password ----------------------------- */
export function ForgotPasswordPage() {
  useDocumentTitle('Forgot password');
  const [sent, setSent] = useState<{ devResetUrl?: string } | null>(null);
  const [formError, setFormError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotValues>({ resolver: zodResolver(forgotSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError('');
    try {
      setSent(await api.post<{ devResetUrl?: string }>('/auth/forgot-password', values));
    } catch (error) {
      setFormError(errorMessage(error));
    }
  });

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your email and we will send you a link to choose a new one."
      footer={
        <Link to="/login" className="font-medium text-plum-700 underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="space-y-4 rounded-2xl border border-sand bg-white p-5">
          <p className="flex items-start gap-3 text-sm text-ink-soft">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-sage" aria-hidden />
            If an account exists for that email, a reset link is on its way. It stays valid for one hour.
          </p>
          {sent.devResetUrl && (
            <div className="rounded-xl bg-champagne-100 p-3 text-[13px] text-champagne-600">
              <p className="mb-1.5 font-medium">Development mode: no email provider is set up.</p>
              <a href={sent.devResetUrl} className="break-all underline">
                Open the reset link
              </a>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <FormError message={formError} />
          <TextField label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
          <Button type="submit" className="w-full" loading={isSubmitting}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

/* ------------------------------ reset password ------------------------------ */
export function ResetPasswordPage() {
  useDocumentTitle('Choose a new password');
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const toast = useToast();
  const [formError, setFormError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetValues>({ resolver: zodResolver(resetSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError('');
    try {
      await api.post('/auth/reset-password', { token, ...values });
      toast.success('Password updated. Sign in with your new password.');
      navigate('/login', { replace: true });
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : errorMessage(error));
    }
  });

  if (!token) {
    return (
      <AuthLayout
        title="This link isn’t valid"
        subtitle="The reset link is missing its token. Request a new link and try again."
        footer={
          <Link to="/forgot-password" className="font-medium text-plum-700 underline-offset-4 hover:underline">
            Request a new link
          </Link>
        }
      >
        <span />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Choose a new password" subtitle="Pick something you have not used elsewhere.">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormError message={formError} />
        <PasswordField
          label="New password"
          autoComplete="new-password"
          hint="At least 8 characters with upper and lower case letters and a number."
          error={errors.password?.message}
          {...register('password')}
        />
        <PasswordField label="Confirm new password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
        <Button type="submit" className="w-full" loading={isSubmitting}>
          Update password
        </Button>
        {formError && (
          <p className="text-center text-sm">
            <Link to="/forgot-password" className="font-medium text-plum-700 underline-offset-4 hover:underline">
              Request a new link
            </Link>
          </p>
        )}
      </form>
    </AuthLayout>
  );
}
