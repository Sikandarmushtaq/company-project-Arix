import React, { useState } from 'react';
import { Button, Input } from '@/components/ui';

interface CallerIdSectionProps {
  currentCallerId: string | null;
  onSaveCallerId: (newName: string | null) => void;
  isSaving?: boolean;
}

export function CallerIdSection({
  currentCallerId,
  onSaveCallerId,
  isSaving = false,
}: CallerIdSectionProps) {
  const [callerIdName, setCallerIdName] = useState(currentCallerId || '');

  const hasChanged = callerIdName.trim() !== (currentCallerId || '').trim();

  const handleSave = () => {
    onSaveCallerId(callerIdName.trim() || null);
  };

  return (
    <div className="space-y-4">
      {/* OUTBOUND CALLER ID NAME */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-1.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)]">
            Outbound Caller ID Name (CNAM)
          </h3>
          <span className="text-[11px] font-mono text-[var(--muted-foreground)]">
            {callerIdName.length}/15
          </span>
        </div>

        <div className="space-y-2">
          <Input
            hideLabel
            label="Caller ID Name"
            value={callerIdName}
            onChange={(e) => setCallerIdName(e.target.value.slice(0, 15))}
            placeholder="e.g. TechCorp Support"
            maxLength={15}
            disabled={isSaving}
          />

          <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed">
            May appear on supported outbound calls. Carrier updates can take 24–48 hours.
          </p>

          <div className="flex justify-end pt-1">
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={!hasChanged || isSaving}
              loading={isSaving}
              className="text-xs font-semibold"
            >
              Save Caller ID Name
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
