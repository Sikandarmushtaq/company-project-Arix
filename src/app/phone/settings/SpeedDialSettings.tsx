'use client';

/**
 * Speed Dial Settings
 *
 * Speed dial positions 1-9 with add/edit/remove actions.
 *
 * @module app/phone/settings/SpeedDialSettings
 */

import React, { useState, useCallback } from 'react';
import {
  FiZap,
  FiCheckCircle,
  FiX,
  FiPlus,
  FiTrash2,
  FiPhone,
} from 'react-icons/fi';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '@/components/ui';
import { useSpeedDial, useSetSpeedDial, useRemoveSpeedDial } from '@/lib/hooks';
import type { SpeedDialEntry } from '@/lib/api';

export function SpeedDialSettings() {
  const { data: speedDialEntries, isLoading: speedDialLoading } = useSpeedDial();
  const setSpeedDial = useSetSpeedDial();
  const removeSpeedDial = useRemoveSpeedDial();

  const [editingSpeedDial, setEditingSpeedDial] = useState<number | null>(null);
  const [speedDialNumber, setSpeedDialNumber] = useState('');
  const [speedDialName, setSpeedDialName] = useState('');

  const handleSetSpeedDial = useCallback(
    async (position: number) => {
      if (!speedDialNumber.trim()) return;
      await setSpeedDial.mutateAsync({
        position,
        phoneNumber: speedDialNumber.trim(),
        name: speedDialName.trim() || undefined,
      });
      setEditingSpeedDial(null);
      setSpeedDialNumber('');
      setSpeedDialName('');
    },
    [setSpeedDial, speedDialNumber, speedDialName]
  );

  const handleRemoveSpeedDial = useCallback(
    async (position: number) => {
      await removeSpeedDial.mutateAsync(position);
    },
    [removeSpeedDial]
  );

  const handleEditSpeedDial = useCallback((position: number, entry?: SpeedDialEntry) => {
    setEditingSpeedDial(position);
    setSpeedDialNumber(entry?.phoneNumber || '');
    setSpeedDialName(entry?.name || '');
  }, []);

  const handleCancelSpeedDialEdit = useCallback(() => {
    setEditingSpeedDial(null);
    setSpeedDialNumber('');
    setSpeedDialName('');
  }, []);

  const getSpeedDialEntry = useCallback(
    (position: number) => speedDialEntries?.find((e) => e.position === position),
    [speedDialEntries]
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FiZap className="w-4 h-4 text-[var(--foreground)]" />
          Speed Dial
        </CardTitle>
        <p className="text-xs text-[var(--muted-foreground)] mt-1">
          Long-press 1-9 on the dialpad
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        {speedDialLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-[var(--border)] border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((position) => {
              const entry = getSpeedDialEntry(position);
              const isEditing = editingSpeedDial === position;

              return (
                <div key={position} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--muted)] flex-shrink-0 flex items-center justify-center text-sm font-semibold text-[var(--foreground)]">
                    {position}
                  </div>
                  {isEditing ? (
                    <div className="flex-1 flex items-center gap-2">
                      <Input
                        placeholder="Phone number"
                        value={speedDialNumber}
                        onChange={(e) => setSpeedDialNumber(e.target.value)}
                        className="flex-1 h-8 text-sm"
                      />
                      <Input
                        placeholder="Name (optional)"
                        value={speedDialName}
                        onChange={(e) => setSpeedDialName(e.target.value)}
                        className="flex-1 h-8 text-sm"
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleSetSpeedDial(position)}
                        disabled={setSpeedDial.isPending || !speedDialNumber.trim()}
                      >
                        <FiCheckCircle className="w-4 h-4 text-green-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={handleCancelSpeedDialEdit}
                      >
                        <FiX className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : entry ? (
                    <div className="flex-1 flex items-center justify-between min-w-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--foreground)] truncate">
                          {entry.name || entry.phoneNumber}
                        </p>
                        {entry.name && (
                          <p className="text-xs text-[var(--muted-foreground)] truncate">
                            {entry.phoneNumber}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleEditSpeedDial(position, entry)}
                        >
                          <FiPhone className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleRemoveSpeedDial(position)}
                          disabled={removeSpeedDial.isPending}
                        >
                          <FiTrash2 className="w-3 h-3 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 justify-start text-[var(--muted-foreground)]"
                      onClick={() => handleEditSpeedDial(position)}
                    >
                      <FiPlus className="w-3 h-3 mr-1" />
                      Add speed dial
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
