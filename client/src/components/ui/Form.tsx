import { Eye, EyeOff } from 'lucide-react';
import {
  forwardRef,
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/cn';

const controlClass = (invalid: boolean) =>
  cn(
    'w-full rounded-xl border bg-white px-3.5 py-2.5 text-[15px] text-ink placeholder:text-ink-mute/70',
    'transition-[border-color,box-shadow] duration-150 disabled:cursor-not-allowed disabled:bg-cream disabled:text-ink-mute',
    invalid ? 'border-berry focus-visible:shadow-[0_0_0_3px_rgba(140,59,98,0.25)]' : 'border-sand hover:border-mauve-300 focus-visible:border-champagne',
  );

interface FieldShellProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function FieldShell({ id, label, error, hint, required, children, className }: FieldShellProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-medium text-plum-900">
        {label}
        {required && (
          <span className="ml-0.5 text-berry" aria-hidden>
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[13px] text-berry">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[13px] text-ink-mute">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const describedBy = (id: string, error?: string, hint?: string) =>
  error ? `${id}-error` : hint ? `${id}-hint` : undefined;

interface BaseFieldProps {
  label: string;
  error?: string;
  hint?: string;
  wrapperClassName?: string;
}

export const TextField = forwardRef<HTMLInputElement, BaseFieldProps & InputHTMLAttributes<HTMLInputElement>>(
  function TextField({ label, error, hint, wrapperClassName, className, required, ...rest }, ref) {
    const id = useId();
    return (
      <FieldShell id={id} label={label} error={error} hint={hint} required={required} className={wrapperClassName}>
        <input
          ref={ref}
          id={id}
          aria-invalid={!!error}
          aria-describedby={describedBy(id, error, hint)}
          required={required}
          className={cn(controlClass(!!error), className)}
          {...rest}
        />
      </FieldShell>
    );
  },
);

export const PasswordField = forwardRef<HTMLInputElement, BaseFieldProps & InputHTMLAttributes<HTMLInputElement>>(
  function PasswordField({ label, error, hint, wrapperClassName, className, ...rest }, ref) {
    const id = useId();
    const [visible, setVisible] = useState(false);
    return (
      <FieldShell id={id} label={label} error={error} hint={hint} className={wrapperClassName}>
        <div className="relative">
          <input
            ref={ref}
            id={id}
            type={visible ? 'text' : 'password'}
            aria-invalid={!!error}
            aria-describedby={describedBy(id, error, hint)}
            className={cn(controlClass(!!error), 'pr-11', className)}
            {...rest}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            aria-pressed={visible}
            className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-ink-mute hover:bg-lavender-50 hover:text-plum-800"
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </FieldShell>
    );
  },
);

export const SelectField = forwardRef<
  HTMLSelectElement,
  BaseFieldProps & SelectHTMLAttributes<HTMLSelectElement>
>(function SelectField({ label, error, hint, wrapperClassName, className, children, required, ...rest }, ref) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} required={required} className={wrapperClassName}>
      <select
        ref={ref}
        id={id}
        aria-invalid={!!error}
        aria-describedby={describedBy(id, error, hint)}
        className={cn(controlClass(!!error), 'appearance-none bg-[length:16px] bg-[right_0.9rem_center] bg-no-repeat pr-10', className)}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236f6475' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        }}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  );
});

export const TextareaField = forwardRef<
  HTMLTextAreaElement,
  BaseFieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>
>(function TextareaField({ label, error, hint, wrapperClassName, className, required, ...rest }, ref) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} required={required} className={wrapperClassName}>
      <textarea
        ref={ref}
        id={id}
        rows={3}
        aria-invalid={!!error}
        aria-describedby={describedBy(id, error, hint)}
        className={cn(controlClass(!!error), 'resize-y', className)}
        {...rest}
      />
    </FieldShell>
  );
});

/** Plain input for toolbars and filters (no label wrapper; give it an aria-label). */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cn(controlClass(false), 'h-10 py-0', className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(controlClass(false), 'h-10 appearance-none bg-[length:16px] bg-[right_0.8rem_center] bg-no-repeat py-0 pr-9', className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236f6475' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
      }}
      {...rest}
    >
      {children}
    </select>
  );
});

interface ToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

/** Accessible switch with a visible label. */
export function Toggle({ checked, onChange, label, description, disabled }: ToggleProps) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className="block text-sm font-medium text-plum-900">
          {label}
        </label>
        {description && <p className="mt-0.5 text-[13px] text-ink-mute">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-50',
          checked ? 'bg-plum-700' : 'bg-sand',
        )}
      >
        <span
          className={cn(
            'inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, className, ...rest },
  ref,
) {
  const id = useId();
  return (
    <label htmlFor={id} className={cn('inline-flex cursor-pointer items-center gap-2 text-sm text-ink-soft', className)}>
      <input
        ref={ref}
        id={id}
        type="checkbox"
        className="h-4 w-4 rounded border-sand accent-plum-700"
        {...rest}
      />
      {label}
    </label>
  );
});
