import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { initials } from '@/lib/format';
import { Button } from './Button';

/* ---------------------------------- Panel ---------------------------------- */
export function Panel({ children, className, as: Tag = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' }) {
  return <Tag className={cn('rounded-panel border border-sand/70 bg-[#fffdfb] shadow-panel', className)}>{children}</Tag>;
}

export function PanelHeader({ title, action, description }: { title: string; action?: ReactNode; description?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sand/60 px-5 py-4">
      <div>
        <h2 className="font-display text-xl text-plum-900">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-ink-mute">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/* -------------------------------- PageHeader -------------------------------- */
interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  backTo?: { to: string; label: string };
}

export function PageHeader({ title, description, actions, backTo }: PageHeaderProps) {
  return (
    <div className="mb-6">
      {backTo && (
        <Link
          to={backTo.to}
          className="mb-3 inline-flex items-center gap-1.5 rounded-lg text-sm text-ink-mute hover:text-plum-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {backTo.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-4xl leading-tight text-plum-900 sm:text-[2.6rem]">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-[15px] text-ink-mute">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/* ---------------------------------- Badge ---------------------------------- */
export function Badge({ children, className, dot }: { children: ReactNode; className?: string; dot?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', className)}>
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dot)} aria-hidden />}
      {children}
    </span>
  );
}

/* ---------------------------------- Avatar ---------------------------------- */
const AVATAR_SIZES = { xs: 'h-6 w-6 text-[10px]', sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-16 w-16 text-xl', xl: 'h-24 w-24 text-3xl' };

export function Avatar({
  name,
  src,
  color = '#8a5a83',
  size = 'md',
  className,
}: {
  name: string;
  src?: string | null;
  color?: string;
  size?: keyof typeof AVATAR_SIZES;
  className?: string;
}) {
  if (src) {
    return <img src={src} alt={name} className={cn('shrink-0 rounded-full object-cover', AVATAR_SIZES[size], className)} />;
  }
  return (
    <span
      aria-hidden
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-medium text-white', AVATAR_SIZES[size], className)}
      style={{ backgroundColor: color }}
    >
      {initials(name)}
    </span>
  );
}

/* ----------------------------------- Tabs ----------------------------------- */
interface TabItem<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
  label,
  variant = 'segmented',
}: {
  value: T;
  onChange: (value: T) => void;
  tabs: TabItem<T>[];
  label: string;
  variant?: 'segmented' | 'underline';
}) {
  const onKey = (event: React.KeyboardEvent, index: number) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
    onChange(next.value);
    const parent = (event.currentTarget as HTMLElement).parentElement;
    requestAnimationFrame(() => parent?.querySelector<HTMLElement>(`[data-tab="${next.value}"]`)?.focus());
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        variant === 'segmented' ? 'inline-flex rounded-xl bg-cream p-1' : 'flex gap-6 overflow-x-auto border-b border-sand/80',
      )}
    >
      {tabs.map((tab, index) => {
        const selected = tab.value === value;
        return (
          <button
            key={tab.value}
            role="tab"
            type="button"
            data-tab={tab.value}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.value)}
            onKeyDown={(event) => onKey(event, index)}
            className={cn(
              'whitespace-nowrap text-sm font-medium transition-colors',
              variant === 'segmented'
                ? cn('rounded-lg px-3.5 py-1.5', selected ? 'bg-white text-plum-800 shadow-sm' : 'text-ink-mute hover:text-plum-700')
                : cn(
                    '-mb-px border-b-2 pb-3 pt-1',
                    selected ? 'border-champagne text-plum-800' : 'border-transparent text-ink-mute hover:text-plum-700',
                  ),
            )}
          >
            {tab.label}
            {tab.count !== undefined && <span className="ml-1.5 text-ink-mute">{tab.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------- Pagination -------------------------------- */
export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const windowStart = Math.max(1, Math.min(page - 2, pages - 4));
  const numbers = Array.from({ length: Math.min(5, pages) }, (_, i) => windowStart + i);

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 px-1 pt-4 text-sm text-ink-mute">
      <p>
        Showing <span className="font-medium text-ink">{from}–{to}</span> of <span className="font-medium text-ink">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <Button variant="secondary" size="sm" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {numbers.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onPage(n)}
            aria-current={n === page ? 'page' : undefined}
            className={cn(
              'h-8 min-w-8 rounded-lg px-2 text-[13px] font-medium transition-colors',
              n === page ? 'bg-plum-700 text-ivory' : 'text-ink-soft hover:bg-lavender-50',
            )}
          >
            {n}
          </button>
        ))}
        <Button variant="secondary" size="sm" onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}
