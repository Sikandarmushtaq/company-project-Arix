'use client';

/**
 * /admin2 shared design-system primitives — mirror the ArixCall admin prototype
 * (admin2-prototype.html): coral #FF6542 accent, soft cards, status dots, pills,
 * metric tiles, section cards, tabs. Every admin2 page composes these so the look
 * stays consistent and matches the GPT UI. Theme-aware (light + dark:).
 */

import type { ReactNode } from 'react';

/* ---------- status dot (green/amber/red/grey) ---------- */
export type Health = 'ok' | 'warn' | 'bad' | 'off';
const HEALTH_DOT: Record<Health, string> = {
  ok: 'bg-emerald-500',
  warn: 'bg-amber-500',
  bad: 'bg-red-500',
  off: 'bg-slate-400',
};
const HEALTH_TEXT: Record<Health, string> = {
  ok: 'text-emerald-600 dark:text-emerald-400',
  warn: 'text-amber-600 dark:text-amber-400',
  bad: 'text-red-600 dark:text-red-400',
  off: 'text-slate-500',
};

export function StatusDot({ health, label }: { health: Health; label: string }) {
  return (
    <span className={`inline-flex items-center gap-2 text-xs font-bold ${HEALTH_TEXT[health]}`}>
      <span className={`h-2 w-2 rounded-full ${HEALTH_DOT[health]}`} />
      {label}
    </span>
  );
}

/* ---------- subscription (Stripe billing_status) badge ---------- */
export function SubscriptionBadge({ status }: { status?: string }) {
  const s = (status || 'active').toLowerCase();
  const map: Record<string, string> = {
    active: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    canceling: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    past_due: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    suspended: 'bg-red-500/10 text-red-600 dark:text-red-400',
    canceled: 'bg-red-500/10 text-red-600 dark:text-red-400',
    cancelled: 'bg-red-500/10 text-red-600 dark:text-red-400',
    trial: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    trialing: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-bold capitalize ${map[s] || 'bg-slate-500/10 text-slate-500'}`}>
      {s.replace('_', ' ')}
    </span>
  );
}

/* ---------- pill ---------- */
export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'coral' }) {
  const cls =
    tone === 'coral'
      ? 'bg-[#FF6542]/10 text-[#b8462c] dark:text-[#ffb09a]'
      : 'bg-slate-500/10 text-slate-600 dark:text-slate-300';
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${cls}`}>{children}</span>;
}

/* ---------- card + section ---------- */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 ${className}`}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h3 className="text-sm font-black">{children}</h3>
      {action}
    </div>
  );
}

/* ---------- metric tile ---------- */
export function Metric({ label, value, sub, subTone = 'ok' }: { label: string; value: ReactNode; sub?: ReactNode; subTone?: Health }) {
  return (
    <Card className="p-5">
      <div className="text-[13px] text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-2 text-[28px] font-extrabold tracking-tight">{value}</div>
      {sub != null && <div className={`mt-1.5 text-xs font-semibold ${HEALTH_TEXT[subTone]}`}>{sub}</div>}
    </Card>
  );
}

/* ---------- page header ---------- */
export function PageHead({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-start">
      <div>
        <h1 className="text-3xl font-black tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/* ---------- buttons ---------- */
export function Btn({
  children,
  variant = 'default',
  size = 'md',
  onClick,
  disabled,
  type = 'button',
}: {
  children: ReactNode;
  variant?: 'default' | 'primary' | 'dark' | 'danger';
  size?: 'sm' | 'md';
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  const base = 'rounded-xl font-bold transition disabled:opacity-40';
  const sz = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm';
  const v =
    variant === 'primary'
      ? 'bg-[#FF6542] text-white hover:brightness-95'
      : variant === 'dark'
        ? 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900'
        : variant === 'danger'
          ? 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300'
          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800';
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${sz} ${v}`}>
      {children}
    </button>
  );
}

/* ---------- state blocks ---------- */
export function ErrorState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-800 dark:border-red-950 dark:bg-red-950/30 dark:text-red-200">
      {children}
    </div>
  );
}

export function EmptyState({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
      <h2 className="text-xl font-extrabold">{title}</h2>
      {subtitle && <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function RowSkeleton({ cols }: { cols: number }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-4">
          <div className="h-4 rounded bg-slate-200 dark:bg-slate-800" />
        </td>
      ))}
    </tr>
  );
}

/* ---------- health row (label ↔ status) ---------- */
export function HealthRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-200 py-3 last:border-0 dark:border-slate-800">
      <span className="text-sm">{label}</span>
      {children}
    </div>
  );
}

/* ---------- tabs ---------- */
export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<{ key: T; label: ReactNode }>;
  active: T;
  onChange: (k: T) => void;
}) {
  return (
    <div className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-bold ${
            active === t.key
              ? 'border-[#FF6542] text-[#FF6542]'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- modal shell ---------- */
export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  size = 'md',
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" onClick={onClose}>
      <div
        className={`w-full ${size === 'lg' ? 'max-w-4xl' : 'max-w-xl'} overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-black">{title}</h2>
            {subtitle && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-lg text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            ×
          </button>
        </div>
        <div className="max-h-[70vh] overflow-auto p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-800">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- labeled input/select ---------- */
export const fieldInput =
  'mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#FF6542] dark:border-slate-800 dark:bg-slate-950';

export function Field({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block text-sm font-bold">
      {label}
      {children}
      {hint && <span className="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400">{hint}</span>}
    </label>
  );
}

/* ---------- toggle row ---------- */
export function ToggleRow({
  title,
  description,
  checked,
  onChange,
  disabled,
}: {
  title: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
      <div>
        <div className="text-sm font-bold">{title}</div>
        {description && <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</div>}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-40 ${checked ? 'bg-[#FF6542]' : 'bg-slate-300 dark:bg-slate-600'}`}
        aria-pressed={checked}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}
