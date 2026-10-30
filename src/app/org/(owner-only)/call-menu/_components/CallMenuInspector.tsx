'use client';

/**
 * Right-hand inspector: edit the selected call-menu step. Emits data patches up
 * to the builder; the canvas + save flow own persistence.
 */

import React, { useState, useEffect } from 'react';
import { FiTrash2, FiPlus, FiUploadCloud, FiCheckCircle, FiLoader, FiType, FiMic } from 'react-icons/fi';
import type { Node } from '@xyflow/react';
import type { IvrNodeData, IvrMenuKey } from '@/lib/api/services/ivr.api';
import { useIvrTargets, useUploadIvrPrompt, useIvrVoices } from '@/lib/hooks/useIvr';
import { toast } from '@/lib/stores/toast';
import { StyledSelect } from '@/components/ui';
import { NODE_META } from './ivrNodes';
import { HoursEditor } from './HoursEditor';

const MENU_KEYS: IvrMenuKey[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '#'];

const fieldCls =
  'w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary-600)]';
const labelCls = 'mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]';

/** Segmented-toggle button style (shared by the greeting + forward choosers). */
const segBtn = (active: boolean) =>
  `flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
    active
      ? 'bg-[var(--card)] text-[var(--foreground)] shadow-sm'
      : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
  }`;

export function CallMenuInspector({
  node,
  onPatch,
  onDelete,
}: {
  node: Node | null;
  onPatch: (id: string, patch: Partial<IvrNodeData>) => void;
  onDelete: (id: string) => void;
}) {
  // Hooks must run before any early return (rules of hooks).
  const { data: targets } = useIvrTargets();
  const { data: voices } = useIvrVoices();
  const uploadPrompt = useUploadIvrPrompt();
  // Greeting + forward modes are per-step; reset when a different step is selected.
  const [greetMode, setGreetMode] = useState<'text' | 'upload'>('text');
  const [fwdMode, setFwdMode] = useState<'user' | 'number'>('number');
  useEffect(() => {
    const d = node?.data as IvrNodeData | undefined;
    setGreetMode(d?.prompt?.audioKey ? 'upload' : 'text');
    setFwdMode(d?.userId != null || d?.extension ? 'user' : 'number');
  }, [node?.id]);

  if (!node) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-[var(--muted-foreground)]">
        Select a step to edit it, or drag one in from the left.
      </div>
    );
  }

  const type = node.type as keyof typeof NODE_META;
  const data = node.data as IvrNodeData;
  const meta = NODE_META[type];
  const patch = (p: Partial<IvrNodeData>) => onPatch(node.id, p);
  const options = data.options ?? [];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{ background: `${meta.accent}1a`, color: meta.accent }}
        >
          <meta.Icon className="h-4 w-4" />
        </span>
        <span className="text-sm font-semibold text-[var(--foreground)]">{meta.label}</span>
        {type !== 'entry' && (
          <button
            type="button"
            onClick={() => onDelete(node.id)}
            className="ml-auto rounded-md p-1.5 text-[var(--muted-foreground)] hover:bg-red-500/10 hover:text-red-500"
            aria-label="Delete step"
            title="Delete step"
          >
            <FiTrash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div>
          <label className={labelCls}>Label</label>
          <input
            className={fieldCls}
            value={data.label ?? ''}
            placeholder={meta.label}
            onChange={(e) => patch({ label: e.target.value })}
          />
        </div>

        {(type === 'greeting' || type === 'menu') && (
          <div>
            <label className={labelCls}>{type === 'menu' ? 'Menu message' : 'Greeting'}</label>

            {/* Choose ONE way to voice this step. */}
            <div className="mb-2 grid grid-cols-2 gap-1 rounded-lg bg-[var(--muted)]/60 p-1">
              <button
                type="button"
                onClick={() => {
                  setGreetMode('text');
                  if (data.prompt?.audioKey) patch({ prompt: { ...data.prompt, audioKey: undefined } });
                }}
                className={segBtn(greetMode === 'text')}
              >
                <FiType className="h-3.5 w-3.5" /> Type text
              </button>
              <button type="button" onClick={() => setGreetMode('upload')} className={segBtn(greetMode === 'upload')}>
                <FiMic className="h-3.5 w-3.5" /> Upload audio
              </button>
            </div>

            {greetMode === 'text' ? (
              <>
                <textarea
                  className={`${fieldCls} min-h-[84px] resize-y`}
                  value={data.prompt?.text ?? ''}
                  placeholder={
                    type === 'menu'
                      ? 'e.g. Press 1 for Sales, 2 for Support, 0 for the operator.'
                      : 'e.g. Thanks for calling Acme. Please hold.'
                  }
                  onChange={(e) => patch({ prompt: { ...data.prompt, text: e.target.value } })}
                />
                {(voices ?? []).length > 0 && (
                  <div className="mt-2">
                    <label className={labelCls}>Voice</label>
                    <StyledSelect
                      className={fieldCls}
                      aria-label="Voice"
                      placeholder="Default voice"
                      value={data.prompt?.voice ?? ''}
                      onChange={(v) => patch({ prompt: { ...data.prompt, voice: v || undefined } })}
                    >
                      {(voices ?? []).map((vc) => (
                        <option key={vc.id} value={vc.id}>
                          {vc.name}
                          {vc.gender ? ` (${vc.gender === 'male' ? 'M' : 'F'})` : ''}
                        </option>
                      ))}
                    </StyledSelect>
                  </div>
                )}
                <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                  Read aloud to callers automatically — no recording needed. Free.
                </p>
              </>
            ) : data.prompt?.audioKey ? (
              <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 px-3 py-2.5 text-xs">
                <FiCheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
                <span className="min-w-0 flex-1 text-[var(--foreground)]">Recording added — this will play to callers.</span>
                <button
                  type="button"
                  onClick={() => patch({ prompt: { ...data.prompt, audioKey: undefined } })}
                  className="shrink-0 font-medium text-[var(--muted-foreground)] underline-offset-2 hover:text-red-500 hover:underline"
                >
                  Remove
                </button>
              </div>
            ) : (
              <>
                <label
                  className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-3 py-5 text-center text-xs font-medium text-[var(--muted-foreground)] hover:border-[var(--primary-600)] hover:text-[var(--foreground)] ${
                    uploadPrompt.isPending ? 'pointer-events-none opacity-60' : ''
                  }`}
                >
                  {uploadPrompt.isPending ? (
                    <FiLoader className="h-5 w-5 animate-spin" />
                  ) : (
                    <FiUploadCloud className="h-5 w-5" />
                  )}
                  {uploadPrompt.isPending ? 'Uploading…' : 'Choose an MP3 or WAV file'}
                  <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = ''; // allow re-selecting the same file
                      if (!file) return;
                      uploadPrompt.mutate(file, {
                        onSuccess: (r) => patch({ prompt: { ...data.prompt, audioKey: r.audioKey } }),
                        onError: (err) =>
                          toast.error(err instanceof Error ? err.message : 'Upload failed'),
                      });
                    }}
                  />
                </label>
                <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                  Upload your own recorded greeting.
                </p>
              </>
            )}
          </div>
        )}

        {type === 'menu' && (
          <div>
            <label className={labelCls}>Keypad options</label>
            <div className="space-y-2">
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <StyledSelect
                    className={`${fieldCls} w-16 px-2`}
                    aria-label={`Keypad key for option ${i + 1}`}
                    value={opt.key}
                    onChange={(v) => {
                      if (options.some((o, j) => j !== i && o.key === v)) return; // no dup keys
                      const next = [...options];
                      next[i] = { ...opt, key: v as IvrMenuKey };
                      patch({ options: next });
                    }}
                  >
                    {MENU_KEYS.map((k) => (
                      <option key={k} value={k} disabled={k !== opt.key && options.some((o) => o.key === k)}>
                        {k}
                      </option>
                    ))}
                  </StyledSelect>
                  <input
                    className={fieldCls}
                    value={opt.label ?? ''}
                    placeholder="e.g. Sales"
                    onChange={(e) => {
                      const next = [...options];
                      next[i] = { ...opt, label: e.target.value };
                      patch({ options: next });
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => patch({ options: options.filter((_, j) => j !== i) })}
                    aria-label={`Remove keypad option ${i + 1}`}
                    title="Remove option"
                    className="rounded-md p-1.5 text-[var(--muted-foreground)] hover:bg-red-500/10 hover:text-red-500"
                  >
                    <FiTrash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  const used = new Set(options.map((o) => o.key));
                  const nextKey = MENU_KEYS.find((k) => !used.has(k)) ?? '0';
                  patch({ options: [...options, { key: nextKey, label: '' }] });
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] hover:border-[var(--primary-600)] hover:text-[var(--foreground)]"
              >
                <FiPlus className="h-3.5 w-3.5" /> Add option
              </button>
            </div>
            <p className="mt-2 text-[11px] text-[var(--muted-foreground)]">
              Each option shows a connector on the canvas — drag it to the step it should route to.
            </p>
          </div>
        )}

        {type === 'hours' && <HoursEditor data={data} onPatch={patch} />}

        {type === 'ring_user' && (
          <div>
            <label className={labelCls}>Ring which person</label>
            <StyledSelect
              className={fieldCls}
              aria-label="Ring which person"
              placeholder="Choose a team member…"
              value={data.userId != null ? String(data.userId) : ''}
              onChange={(v) => {
                const u = (targets?.users ?? []).find((x) => String(x.id) === v);
                patch(u ? { userId: u.id, extension: u.extension } : { userId: undefined, extension: undefined });
              }}
            >
              {(targets?.users ?? []).map((u) => (
                <option key={u.id} value={String(u.id)}>
                  {u.name} (ext {u.extension})
                </option>
              ))}
            </StyledSelect>
            {(targets?.users ?? []).length === 0 && (
              <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                No team members with an extension yet — add people in Users first.
              </p>
            )}
          </div>
        )}

        {type === 'ring_group' && (
          <div>
            <label className={labelCls}>Ring which team</label>
            <StyledSelect
              className={fieldCls}
              aria-label="Ring which team"
              placeholder="Choose a team…"
              value={data.groupId != null ? String(data.groupId) : ''}
              onChange={(v) => {
                const t = (targets?.teams ?? []).find((x) => String(x.id) === v);
                patch({ groupId: t ? t.id : undefined });
              }}
            >
              {(targets?.teams ?? []).map((t) => (
                <option key={t.id} value={String(t.id)}>
                  {t.name}
                </option>
              ))}
            </StyledSelect>
            {(targets?.teams ?? []).length === 0 && (
              <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                No teams yet — create a call group first, then it appears here.
              </p>
            )}
          </div>
        )}

        {type === 'voicemail' && (
          <div>
            <label className={labelCls}>Whose voicemail</label>
            <StyledSelect
              className={fieldCls}
              aria-label="Whose voicemail"
              placeholder="Choose a mailbox…"
              value={data.userId != null ? String(data.userId) : ''}
              onChange={(v) => {
                const u = (targets?.users ?? []).find((x) => String(x.id) === v);
                patch(u ? { userId: u.id, extension: u.extension } : { userId: undefined, extension: undefined });
              }}
            >
              {(targets?.users ?? []).map((u) => (
                <option key={u.id} value={String(u.id)}>
                  {u.name} (ext {u.extension})
                </option>
              ))}
            </StyledSelect>
            {(targets?.users ?? []).length === 0 ? (
              <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                No team members with an extension yet — add people in Users first.
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                Callers leave a message in this person’s mailbox.
              </p>
            )}
          </div>
        )}

        {type === 'transfer' && (
          <div>
            <label className={labelCls}>Forward to</label>
            <div className="mb-2 grid grid-cols-2 gap-1 rounded-lg bg-[var(--muted)]/60 p-1">
              <button
                type="button"
                onClick={() => {
                  setFwdMode('user');
                  patch({ externalNumber: undefined });
                }}
                className={segBtn(fwdMode === 'user')}
              >
                Team member
              </button>
              <button
                type="button"
                onClick={() => {
                  setFwdMode('number');
                  patch({ userId: undefined, extension: undefined });
                }}
                className={segBtn(fwdMode === 'number')}
              >
                External number
              </button>
            </div>

            {fwdMode === 'user' ? (
              <>
                <StyledSelect
                  className={fieldCls}
                  aria-label="Forward to team member"
                  placeholder="Choose a team member…"
                  value={data.userId != null ? String(data.userId) : ''}
                  onChange={(v) => {
                    const u = (targets?.users ?? []).find((x) => String(x.id) === v);
                    patch(
                      u
                        ? { userId: u.id, extension: u.extension, externalNumber: undefined }
                        : { userId: undefined, extension: undefined }
                    );
                  }}
                >
                  {(targets?.users ?? []).map((u) => (
                    <option key={u.id} value={String(u.id)}>
                      {u.name} (ext {u.extension})
                    </option>
                  ))}
                </StyledSelect>
                {(targets?.users ?? []).length === 0 && (
                  <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                    No team members with an extension yet — add people in Users first.
                  </p>
                )}
              </>
            ) : (
              <>
                <input
                  className={fieldCls}
                  value={data.externalNumber ?? ''}
                  placeholder="e.g. 12165551234"
                  onChange={(e) =>
                    patch({ externalNumber: e.target.value, userId: undefined, extension: undefined })
                  }
                />
                <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                  11 digits, no “+” (e.g. 12165551234).
                </p>
              </>
            )}
          </div>
        )}

        {type === 'hangup' && (
          <p className="rounded-lg bg-[var(--muted)]/40 p-3 text-xs text-[var(--muted-foreground)]">
            The call ends here.
          </p>
        )}
        {type === 'entry' && (
          <p className="rounded-lg bg-[var(--muted)]/40 p-3 text-xs text-[var(--muted-foreground)]">
            Every incoming call starts here. Connect it to the first step (usually a Greeting or Menu).
          </p>
        )}
      </div>
    </div>
  );
}
