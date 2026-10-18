import { cn } from '@/lib/cn';

interface WordmarkProps {
  /** "light" is for dark backgrounds (sidebar, login panel) */
  tone?: 'dark' | 'light';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = { sm: { box: 'h-6 w-6', text: 'text-xl' }, md: { box: 'h-8 w-8', text: 'text-[1.75rem]' }, lg: { box: 'h-11 w-11', text: 'text-4xl' } };

/** Text wordmark with a small flowing-line mark. No external logo file needed. */
export function Wordmark({ tone = 'dark', size = 'md', className }: WordmarkProps) {
  const s = SIZES[size];
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 32 32" className={s.box} aria-hidden="true">
        <rect width="32" height="32" rx="9" fill={tone === 'light' ? '#5b2a50' : '#3b1f38'} />
        <path d="M7 20c4-9 8 3 12-6 2-4 4-4 6-3" fill="none" stroke="#c4a265" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      <span className={cn('font-display leading-none tracking-tight', s.text, tone === 'light' ? 'text-ivory' : 'text-plum-900')}>
        flowdesk
      </span>
    </span>
  );
}
