'use client';

/**
 * Drip SEQUENCE BUILDER — a vertical timeline of timed message steps (the
 * industry-standard linear-drip pattern). Each step = a delay (relative to the
 * previous step) + a message with a live segment counter and template insert.
 * Create or edit; saves the whole steps array (backend replaces steps atomically).
 */

import React, { useMemo, useState } from 'react';
import { FiPlus, FiTrash2, FiClock, FiArrowDown } from 'react-icons/fi';
import { Modal, Button, StyledSelect, Input } from '@/components/ui';
import { useAuthStore } from '@/lib/stores/auth';
import { toast } from '@/lib/stores/toast';
import { calculateSmsSegments } from '@/app/phone/messages/_components/utils';
import { useCreateDripSequence, useUpdateDripSequence } from '@/lib/hooks/useSmsDrip';
import type { DripSequence } from '@/lib/api/services/sms-drip.service';
import { TemplatePicker } from './TemplatePicker';

type Unit = 'minutes' | 'hours' | 'days';
interface EditStep {
  key: string;
  delayValue: number;
  delayUnit: Unit;
  body: string;
}

const UNIT_MINUTES: Record<Unit, number> = { minutes: 1, hours: 60, days: 1440 };

/** Pick the cleanest unit to display a minutes value. */
function toValueUnit(mins: number): { delayValue: number; delayUnit: Unit } {
  if (mins > 0 && mins % 1440 === 0) return { delayValue: mins / 1440, delayUnit: 'days' };
  if (mins > 0 && mins % 60 === 0) return { delayValue: mins / 60, delayUnit: 'hours' };
  return { delayValue: mins, delayUnit: 'minutes' };
}

let keySeq = 0;
const newKey = () => `s${keySeq++}`;

export function SequenceBuilder({
  sequence,
  onClose,
}: {
  sequence: DripSequence | null; // null = create
  onClose: () => void;
}) {
  const { user } = useAuthStore();
  const create = useCreateDripSequence();
  const update = useUpdateDripSequence();
  const isEdit = !!sequence;

  // SMS-capable numbers the user may send automated SMS from.
  const numbers = useMemo(() => {
    const phones = user?.phoneNumbers ?? [];
    const auto = phones.filter((p) => p.autoSmsEnabled && p.smsEnabled);
    return (auto.length ? auto : phones.filter((p) => p.smsEnabled)).map((p) => p.phoneNumber);
  }, [user?.phoneNumbers]);

  const [name, setName] = useState(sequence?.name ?? '');
  const [fromPhone, setFromPhone] = useState(sequence?.fromPhone ?? numbers[0] ?? '');
  const [enabled, setEnabled] = useState(sequence?.enabled ?? true);
  const [steps, setSteps] = useState<EditStep[]>(() =>
    sequence?.steps?.length
      ? sequence.steps.map((s) => ({ key: newKey(), body: s.body, ...toValueUnit(s.delayMinutes) }))
      : [
          { key: newKey(), delayValue: 0, delayUnit: 'minutes', body: '' },
          { key: newKey(), delayValue: 2, delayUnit: 'days', body: '' },
        ]
  );

  const busy = create.isPending || update.isPending;

  const setStep = (key: string, patch: Partial<EditStep>) =>
    setSteps((arr) => arr.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  const addStep = () =>
    setSteps((arr) => [...arr, { key: newKey(), delayValue: arr.length === 0 ? 0 : 2, delayUnit: 'days', body: '' }]);
  const removeStep = (key: string) => setSteps((arr) => arr.filter((s) => s.key !== key));

  const handleSave = async () => {
    if (!name.trim()) return toast.error('Name your sequence');
    if (!fromPhone) return toast.error('Pick a number to send from');
    const cleaned = steps.filter((s) => s.body.trim());
    if (cleaned.length === 0) return toast.error('Add at least one step with a message');
    const payload = {
      name: name.trim(),
      fromPhone,
      enabled,
      steps: cleaned.map((s) => ({
        delayMinutes: Math.max(0, Math.round(s.delayValue)) * UNIT_MINUTES[s.delayUnit],
        body: s.body.trim(),
      })),
    };
    try {
      if (isEdit) await update.mutateAsync({ id: sequence!.id, data: payload });
      else await create.mutateAsync(payload);
      toast.success(isEdit ? 'Sequence updated' : 'Sequence created');
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save sequence');
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={isEdit ? 'Edit sequence' : 'New drip sequence'} size="lg">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Sequence name
            </label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. New lead follow-up" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Send from
            </label>
            <StyledSelect
              value={fromPhone}
              onChange={(v) => setFromPhone(v)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
            >
              {numbers.length === 0 && <option value="">No SMS number available</option>}
              {numbers.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </StyledSelect>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Active — the scheduler sends this sequence to enrolled contacts
        </label>

        {/* Timeline */}
        <div className="space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            Steps
          </div>
          {steps.map((s, i) => {
            const seg = calculateSmsSegments(s.body);
            return (
              <div key={s.key}>
                {i > 0 && (
                  <div className="flex items-center gap-1.5 py-1 pl-1 text-[11px] text-[var(--muted-foreground)]">
                    <FiArrowDown className="h-3 w-3" /> then wait
                  </div>
                )}
                <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                      <FiClock className="h-3.5 w-3.5" />
                      {i === 0 ? (
                        <span>Send</span>
                      ) : (
                        <>
                          <input
                            type="number"
                            min={0}
                            value={s.delayValue}
                            onChange={(e) => setStep(s.key, { delayValue: Number(e.target.value) })}
                            className="w-16 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm text-[var(--foreground)]"
                          />
                          <StyledSelect
                            value={s.delayUnit}
                            onChange={(v) => setStep(s.key, { delayUnit: v as Unit })}
                            className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm"
                          >
                            <option value="minutes">minutes</option>
                            <option value="hours">hours</option>
                            <option value="days">days</option>
                          </StyledSelect>
                          <span>after the previous step</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <TemplatePicker currentBody={s.body} onInsert={(b) => setStep(s.key, { body: b })} />
                      {steps.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeStep(s.key)}
                          aria-label="Remove step"
                          className="text-[var(--muted-foreground)] hover:text-red-500"
                        >
                          <FiTrash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <textarea
                    value={s.body}
                    onChange={(e) => setStep(s.key, { body: e.target.value })}
                    rows={3}
                    placeholder={`Message for step ${i + 1}…  Use {name} to personalize.`}
                    className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-600)]"
                  />
                  <div className="mt-1 text-right text-[11px] text-[var(--muted-foreground)]">
                    {seg.segmentCount} segment{seg.segmentCount !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            );
          })}
          <button
            type="button"
            onClick={addStep}
            className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--muted-foreground)] hover:border-[var(--primary-600)] hover:text-[var(--foreground)]"
          >
            <FiPlus className="h-3.5 w-3.5" /> Add step
          </button>
        </div>

        <p className="rounded-lg bg-[var(--muted)]/40 px-3 py-2 text-[11px] leading-relaxed text-[var(--muted-foreground)]">
          A reply from a contact automatically pauses their sequence (a person can take over); texting
          STOP opts them out of all automated messages.
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={busy} disabled={busy}>
            {isEdit ? 'Save changes' : 'Create sequence'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
