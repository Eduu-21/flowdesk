import { Lock } from 'lucide-react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from './ui/Button';
import { EmptyState, ErrorState, Spinner } from './ui/Feedback';
import { Wordmark } from './Wordmark';

function FullScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <Wordmark />
      {children}
    </div>
  );
}

/** Everything inside requires a signed-in user. */
export function RequireAuth() {
  const { status, error, retry } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <FullScreen>
        <Spinner className="h-7 w-7" />
      </FullScreen>
    );
  }
  if (status === 'error') {
    return (
      <FullScreen>
        <ErrorState error={error} onRetry={retry} className="max-w-md" />
      </FullScreen>
    );
  }
  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  return <Outlet />;
}

/** Login, register and password pages bounce signed-in users to the dashboard. */
export function PublicOnly() {
  const { status } = useAuth();
  if (status === 'loading') {
    return (
      <FullScreen>
        <Spinner className="h-7 w-7" />
      </FullScreen>
    );
  }
  if (status === 'authenticated') return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

/** Admin-only pages show a friendly explanation instead of a blank screen. */
export function RequireAdmin() {
  const { isAdmin } = useAuth();
  if (isAdmin) return <Outlet />;
  return (
    <EmptyState
      className="mx-auto max-w-md py-20"
      icon={<Lock className="h-6 w-6" />}
      title="Admins only"
      description="This area is only available to the studio owner and admins. Ask them if you need access."
      action={
        <Link to="/dashboard">
          <Button>Back to dashboard</Button>
        </Link>
      }
    />
  );
}
