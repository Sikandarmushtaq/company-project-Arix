'use client';

/**
 * PlanTemplatePicker — a dropdown of saved custom-plan templates.
 *
 * Picking a saved plan calls `onApply(template)` so the parent fills its plan
 * builder fields; the default option "Custom (build manually)" leaves the fields
 * for ad-hoc entry (the fallback). Used by the onboarding builder and the org
 * change-plan card so saved plans are available everywhere a plan is set.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { planTemplateApi, type PlanTemplate } from '@/lib/api/services/plan-template.api';

const selCls =
  'mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-[#FF6542] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

export function PlanTemplatePicker({
  onApply,
  className,
}: {
  onApply: (t: PlanTemplate) => void;
  className?: string;
}) {
  const q = useQuery({
    queryKey: ['admin2', 'plan-templates', 'picker'],
    queryFn: () => planTemplateApi.list(),
    staleTime: 30_000,
  });
  const plans = q.data ?? [];
  const [sel, setSel] = useState('');

  return (
    <div className={className}>
      <label className="text-sm font-bold">
        Start from a saved plan
        <select
          className={selCls}
          value={sel}
          onChange={(e) => {
            const id = e.target.value;
            setSel(id);
            const t = plans.find((p) => String(p.id) === id);
            if (t) onApply(t);
          }}
        >
          <option value="">Custom (build manually)</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — ${(p.monthlyCents / 100).toFixed(2)}/mo
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400">
          {plans.length === 0
            ? 'No saved plans yet — build one manually below (or save reusable plans under Customer Plans).'
            : 'Pick a saved plan to pre-fill the fields, or keep “Custom” to build manually. You can still tweak any field after.'}
        </span>
      </label>
    </div>
  );
}
