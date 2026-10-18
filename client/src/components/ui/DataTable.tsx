import { ArrowDown, ArrowUp, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Server-side sort key. Omit when the column is not sortable. */
  sortKey?: string;
  className?: string;
  align?: 'left' | 'right';
  /** Hide the column in the stacked mobile layout */
  mobileHide?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  rowLabel?: (row: T) => string;
  sort?: { key: string; order: 'asc' | 'desc' };
  onSort?: (key: string) => void;
}

/**
 * A real table on larger screens. Below the md breakpoint each row becomes a
 * stacked card (first column is the title) so nothing overflows on phones.
 */
export function DataTable<T>({ columns, rows, rowKey, onRowClick, rowLabel, sort, onSort }: DataTableProps<T>) {
  const [first, ...rest] = columns;
  const mobileColumns = rest.filter((c) => !c.mobileHide);

  return (
    <>
      <div className="hidden md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-sand/80">
              {columns.map((col) => {
                const active = sort?.key === col.sortKey;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={active ? (sort!.order === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={cn('px-4 py-3 text-[13px] font-medium text-ink-mute', col.align === 'right' && 'text-right', col.className)}
                  >
                    {col.sortKey && onSort ? (
                      <button
                        type="button"
                        onClick={() => onSort(col.sortKey!)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-md hover:text-plum-700',
                          active && 'text-plum-800',
                          col.align === 'right' && 'flex-row-reverse',
                        )}
                      >
                        {col.header}
                        {active &&
                          (sort!.order === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />)}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                className={cn(
                  'border-b border-sand/50 transition-colors last:border-0',
                  onRowClick && 'cursor-pointer hover:bg-lavender-50/70 focus-within:bg-lavender-50/70',
                )}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col, i) => (
                  <td key={col.key} className={cn('px-4 py-3.5 align-middle', col.align === 'right' && 'text-right', col.className)}>
                    {onRowClick && i === 0 ? (
                      <button
                        type="button"
                        className="text-left focus-visible:rounded-md"
                        aria-label={rowLabel ? `Open ${rowLabel(row)}` : undefined}
                        onClick={(event) => {
                          event.stopPropagation();
                          onRowClick(row);
                        }}
                      >
                        {col.cell(row)}
                      </button>
                    ) : (
                      col.cell(row)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-sand/60 md:hidden">
        {rows.map((row) => {
          const body = (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">{first.cell(row)}</div>
                {onRowClick && <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-ink-mute" aria-hidden />}
              </div>
              <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
                {mobileColumns.map((col) => (
                  <div key={col.key} className="min-w-0">
                    <dt className="text-ink-mute">{col.header}</dt>
                    <dd className="truncate text-ink">{col.cell(row)}</dd>
                  </div>
                ))}
              </dl>
            </>
          );
          return (
            <li key={rowKey(row)}>
              {onRowClick ? (
                <button
                  type="button"
                  onClick={() => onRowClick(row)}
                  className="block w-full px-4 py-4 text-left transition-colors hover:bg-lavender-50/70"
                  aria-label={rowLabel ? `Open ${rowLabel(row)}` : undefined}
                >
                  {body}
                </button>
              ) : (
                <div className="px-4 py-4">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
