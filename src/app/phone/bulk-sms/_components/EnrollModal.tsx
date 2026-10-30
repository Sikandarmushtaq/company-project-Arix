'use client';

/**
 * Enroll recipients into a drip sequence. Paste/type one per line as
 * `phone[, name]`. The server normalizes, skips opted-out / already-enrolled
 * contacts, and schedules step 1.
 */

import React, { useMemo, useState } from 'react';
import { Modal, Button } from '@/components/ui';
import { toast } from '@/lib/stores/toast';
import { useEnrollDrip } from '@/lib/hooks/useSmsDrip';

function parseRecipients(text: string): { phone: string; name?: string }[] {
  const out: { phone: string; name?: string }[] = [];
  for (const raw of text.split(/\n+/)) {
    const line = raw.trim();
    if (!line) continue;
    const [phonePart, ...rest] = line.split(/[,\t]/);
    const phone = phonePart.trim();
    if (!phone) continue;
    const name = rest.join(' ').trim();
    out.push(name ? { phone, name } : { phone });
  }
  return out;
}

export function EnrollModal({
  sequenceId,
  sequenceName,
  onClose,
}: {
  sequenceId: number;
  sequenceName: string;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const enroll = useEnrollDrip();
  const recipients = useMemo(() => parseRecipients(text), [text]);

  const handleEnroll = async () => {
    if (recipients.length === 0) {
      toast.error('Add at least one recipient (one per line)');
      return;
    }
    try {
      const res = await enroll.mutateAsync({ id: sequenceId, data: { recipients } });
      toast.success(
        `Enrolled ${res.enrolled}${res.skipped ? ` · skipped ${res.skipped} (opted-out / already enrolled)` : ''}`
      );
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not enroll recipients');
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Enroll into “${sequenceName}”`} size="md">
      <div className="space-y-3">
        <p className="text-xs text-[var(--muted-foreground)]">
          One recipient per line — <code>phone, name</code> (name optional). The name fills{' '}
          <code>{'{name}'}</code> in your messages.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder={'12165551234, Alex\n12165559876, Sam\n12165550000'}
          className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-600)]"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--muted-foreground)]">
            {recipients.length} recipient{recipients.length !== 1 ? 's' : ''}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={enroll.isPending}>
              Cancel
            </Button>
            <Button onClick={handleEnroll} loading={enroll.isPending} disabled={enroll.isPending || recipients.length === 0}>
              Enroll
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
