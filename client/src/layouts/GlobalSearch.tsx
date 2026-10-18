import { CalendarDays, Scissors, Search, UserRound, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useModals } from '@/components/modals/ModalsContext';
import { Spinner } from '@/components/ui/Feedback';
import { useDismiss } from '@/hooks/useClickOutside';
import { useDebounce } from '@/hooks/useDebounce';
import { useSearch } from '@/hooks/queries';
import { formatDate, formatTime } from '@/lib/dates';
import { formatMoney } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-1.5">
      <p className="px-3 pb-1 text-xs font-medium text-ink-mute">{title}</p>
      <ul>{children}</ul>
    </div>
  );
}

function Row({ icon, title, detail, onClick }: { icon: React.ReactNode; title: string; detail?: string; onClick: () => void }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-lavender-50 focus-visible:bg-lavender-50">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mauve-100 text-plum-600">{icon}</span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-plum-900">{title}</span>
          {detail && <span className="block truncate text-xs text-ink-mute">{detail}</span>}
        </span>
      </button>
    </li>
  );
}

export function GlobalSearch() {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const debounced = useDebounce(text.trim(), 250);
  const wrapper = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const modals = useModals();
  const { user } = useAuth();
  const results = useSearch(debounced);
  useDismiss(wrapper, () => setOpen(false), open);

  // "/" focuses the search box from anywhere that is not a text field
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(target.tagName) && !target.isContentEditable) {
        event.preventDefault();
        input.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const go = (action: () => void) => {
    setOpen(false);
    setText('');
    action();
  };

  const data = results.data;
  const empty = data && !data.customers.length && !data.appointments.length && !data.services.length;

  return (
    <div ref={wrapper} className="relative w-full max-w-md">
      <label htmlFor="global-search" className="sr-only">
        Search customers, appointments and services
      </label>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" aria-hidden />
      <input
        ref={input}
        id="global-search"
        type="search"
        autoComplete="off"
        placeholder="Search customers, appointments, services"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        aria-expanded={open && !!debounced}
        aria-controls="global-search-results"
        className="h-10 w-full rounded-xl border border-sand bg-white pl-10 pr-9 text-sm placeholder:text-ink-mute/80 hover:border-mauve-300 focus-visible:border-champagne [&::-webkit-search-cancel-button]:hidden"
      />
      {text && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setText('');
            input.current?.focus();
          }}
          className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-ink-mute hover:bg-lavender-50"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {open && debounced && (
        <div id="global-search-results" className="absolute left-0 right-0 top-full z-40 mt-2 max-h-[70vh] animate-pop-in overflow-y-auto rounded-2xl border border-sand bg-[#fffdfb] p-1.5 shadow-pop">
          {results.isFetching && !data && (
            <div className="flex items-center gap-2 px-3 py-4 text-sm text-ink-mute">
              <Spinner className="h-4 w-4" /> Searching…
            </div>
          )}
          {results.error && <p className="px-3 py-4 text-sm text-berry">Search isn’t available right now. Please try again.</p>}
          {empty && <p className="px-3 py-5 text-center text-sm text-ink-mute">Nothing found for “{debounced}”.</p>}
          {data && data.customers.length > 0 && (
            <Group title="Customers">
              {data.customers.map((c) => (
                <Row key={c.id} icon={<UserRound className="h-4 w-4" />} title={c.name} detail={c.phone || c.email} onClick={() => go(() => navigate(`/customers/${c.id}`))} />
              ))}
            </Group>
          )}
          {data && data.appointments.length > 0 && (
            <Group title="Appointments">
              {data.appointments.map((a) => (
                <Row
                  key={a.id}
                  icon={<CalendarDays className="h-4 w-4" />}
                  title={`${a.customerName} · ${a.serviceName}`}
                  detail={`${formatDate(a.date, { month: 'short', day: 'numeric' })} at ${formatTime(a.startTime)} with ${a.staffName}`}
                  onClick={() => go(() => modals.openAppointment(a.id))}
                />
              ))}
            </Group>
          )}
          {data && data.services.length > 0 && (
            <Group title="Services">
              {data.services.map((s) => (
                <Row
                  key={s.id}
                  icon={<Scissors className="h-4 w-4" />}
                  title={s.name}
                  detail={`${s.category} · ${formatMoney(s.price, user?.currency)}`}
                  onClick={() => go(() => navigate(`/services?search=${encodeURIComponent(s.name)}`))}
                />
              ))}
            </Group>
          )}
        </div>
      )}
    </div>
  );
}
