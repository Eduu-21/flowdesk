import { AlertTriangle, WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Button } from './Button';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton h-4 w-full', className)} aria-hidden />;
}

export function PageSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-4" role="status" aria-label="Loading">
      <Skeleton className="h-24 w-full rounded-panel" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-2xl" />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn('inline-block h-5 w-5 animate-spin rounded-full border-2 border-mauve-300 border-t-plum-700', className)}
    />
  );
}

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-mauve-100 text-plum-600">{icon}</div>
      <h3 className="font-display text-2xl text-plum-900">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-mute">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}

/** Friendly error panel. Distinguishes "server unreachable" from other failures. */
export function ErrorState({ error, onRetry, className }: ErrorStateProps) {
  const network = error instanceof ApiError && error.isNetwork;
  const message = error instanceof Error ? error.message : 'Something went wrong while loading this page.';
  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center rounded-panel border border-sand bg-[#fffdfb] px-6 py-12 text-center', className)}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-berry-100 text-berry">
        {network ? <WifiOff className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
      </div>
      <h3 className="font-display text-2xl text-plum-900">{network ? 'Can’t reach the server' : 'This didn’t load'}</h3>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-ink-mute">{message}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
