import { fromMinutes, toMinutes } from './dates';

export interface BusyRange {
  start: string; // HH:MM
  end: string; // HH:MM
}

export interface Slot {
  start: string;
  end: string;
}

interface SlotOptions {
  workStart: string;
  workEnd: string;
  durationMinutes: number;
  busy: BusyRange[];
  /** Earliest minute-of-day a slot may start (used for "today"). */
  notBefore?: number;
  stepMinutes?: number;
}

/** Lists the start times where a service fits inside working hours without clashing. */
export function buildSlots(opts: SlotOptions): Slot[] {
  const step = opts.stepMinutes ?? 15;
  const workStart = toMinutes(opts.workStart);
  const workEnd = toMinutes(opts.workEnd);
  const busy = opts.busy.map((b) => ({ s: toMinutes(b.start), e: toMinutes(b.end) }));
  const slots: Slot[] = [];
  for (let start = workStart; start + opts.durationMinutes <= workEnd; start += step) {
    if (opts.notBefore !== undefined && start < opts.notBefore) continue;
    const end = start + opts.durationMinutes;
    if (busy.some((b) => start < b.e && end > b.s)) continue;
    slots.push({ start: fromMinutes(start), end: fromMinutes(end) });
  }
  return slots;
}
