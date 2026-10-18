import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Wordmark } from '@/components/Wordmark';
import { useDocumentTitle } from '@/hooks/useDebounce';

export default function NotFoundPage() {
  useDocumentTitle('Page not found');
  return (
    <main id="main" className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
      <Wordmark />
      <h1 className="font-display text-6xl text-plum-900">Page not found</h1>
      <p className="max-w-sm text-[15px] text-ink-mute">That address doesn’t lead anywhere. It may have moved, or the link might be mistyped.</p>
      <Link to="/dashboard">
        <Button>Go to dashboard</Button>
      </Link>
    </main>
  );
}
