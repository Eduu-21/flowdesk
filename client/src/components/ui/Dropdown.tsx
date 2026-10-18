import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDismiss } from '@/hooks/useClickOutside';
import { cn } from '@/lib/cn';

export interface DropdownItem {
  label: string;
  icon?: ReactNode;
  onSelect?: () => void;
  /** Navigates when chosen */
  to?: string;
  danger?: boolean;
  /** Draws a divider above this item */
  separated?: boolean;
  disabled?: boolean;
  /** Marks the current choice (for status pickers) */
  active?: boolean;
}

interface DropdownProps {
  label: string;
  trigger: ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
  header?: ReactNode;
  triggerClassName?: string;
  menuClassName?: string;
}

export function Dropdown({ label, trigger, items, align = 'right', header, triggerClassName, menuClassName }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();

  const close = useCallback(() => setOpen(false), []);
  useDismiss(wrapperRef, close, open);

  const focusItem = (index: number) => {
    const nodes = menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])');
    if (!nodes?.length) return;
    nodes[(index + nodes.length) % nodes.length]?.focus();
  };

  const onMenuKey = (event: React.KeyboardEvent) => {
    const nodes = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? []);
    const current = nodes.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusItem(current + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusItem(current - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusItem(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusItem(nodes.length - 1);
    } else if (event.key === 'Escape') {
      setOpen(false);
      triggerRef.current?.focus();
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  const choose = (item: DropdownItem) => {
    if (item.disabled) return;
    setOpen(false);
    triggerRef.current?.focus();
    if (item.to) navigate(item.to);
    item.onSelect?.();
  };

  return (
    <div ref={wrapperRef} className="relative inline-block text-left">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => {
          setOpen((o) => !o);
          requestAnimationFrame(() => focusItem(0));
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
            requestAnimationFrame(() => focusItem(0));
          }
        }}
        className={cn('inline-flex items-center rounded-xl', triggerClassName)}
      >
        {trigger}
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKey}
          className={cn(
            'absolute z-40 mt-2 min-w-[13rem] origin-top animate-pop-in rounded-2xl border border-sand bg-[#fffdfb] p-1.5 shadow-pop',
            align === 'right' ? 'right-0' : 'left-0',
            menuClassName,
          )}
        >
          {header}
          {items.map((item, index) => (
            <div key={`${item.label}-${index}`}>
              {item.separated && <div className="my-1.5 h-px bg-sand/80" role="separator" />}
              <button
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => choose(item)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors disabled:opacity-45',
                  item.danger ? 'text-berry hover:bg-berry-100' : 'text-ink hover:bg-lavender-50',
                  item.active && 'bg-lavender-50 font-medium text-plum-800',
                )}
              >
                {item.icon && <span className="text-ink-mute">{item.icon}</span>}
                {item.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
