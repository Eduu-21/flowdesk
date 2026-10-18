import type { ReactNode } from 'react';
import { Wordmark } from '@/components/Wordmark';

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-plum-900 lg:flex lg:flex-col lg:justify-between lg:p-14">
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 600 900" preserveAspectRatio="xMidYMid slice" aria-hidden>
          <g fill="none" stroke="#c4a265" strokeLinecap="round">
            <path d="M-40 640C120 520 200 760 340 640S520 480 660 560" strokeWidth="1.4" opacity="0.55" />
            <path d="M-40 690C120 570 200 810 340 690S520 530 660 610" strokeWidth="1" opacity="0.35" />
            <path d="M-40 740C120 620 200 860 340 740S520 580 660 660" strokeWidth="1" opacity="0.2" />
          </g>
        </svg>
        <Wordmark tone="light" size="lg" />
        <div className="relative max-w-md">
          <p className="font-display text-5xl leading-[1.08] text-ivory">A calmer way to run your studio.</p>
          <p className="mt-5 text-[15px] leading-relaxed text-mauve-300">
            Appointments, customers and your team in one orderly place, so the day flows and you can give clients your full attention.
          </p>
        </div>
        <p className="relative text-sm text-mauve-300/80">For hair, nails, lashes, skin and bridal studios.</p>
      </aside>

      <main id="main" className="flex min-h-screen flex-col px-5 py-8 sm:px-10">
        <div className="mb-10 lg:hidden">
          <Wordmark />
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
          <h1 className="font-display text-4xl text-plum-900">{title}</h1>
          {subtitle && <p className="mt-2 text-[15px] text-ink-mute">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-ink-mute">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
