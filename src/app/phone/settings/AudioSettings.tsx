'use client';

/**
 * Audio Settings
 *
 * Audio device selection (mic/speaker), ringtone selection, volume control,
 * and ringback preview.
 *
 * @module app/phone/settings/AudioSettings
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  FiVolume2,
  FiMic,
  FiSpeaker,
  FiPlay,
  FiStopCircle,
  FiRefreshCw,
  FiMusic,
  FiChevronDown,
  FiCheck,
} from 'react-icons/fi';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui';
import {
  callAudioService,
  AVAILABLE_RINGTONES,
  type AudioSettings as AudioSettingsType,
} from '@/lib/sip';

// Reusable Toggle Switch Component
function ToggleSwitch({
  enabled,
  onChange,
  disabled = false,
}: {
  enabled: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${
        enabled ? 'bg-[var(--primary-600)]' : 'bg-gray-300 dark:bg-gray-600'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
          enabled ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

/**
 * Styled device dropdown — replaces the native <select> so the open list
 * matches the app (rounded card menu) instead of the OS's boxy picker, and is
 * anchored to the trigger (left-0 right-0) so it can't spill out of the UI.
 */
function DeviceSelect({
  icon,
  label,
  value,
  options,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  return (
    <div>
      <label className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)] mb-2">
        {icon}
        {label}
      </label>
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="w-full h-10 flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 text-sm text-[var(--foreground)] hover:border-[var(--primary-400)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-600)] transition-colors"
        >
          <span className="truncate text-left">{selected?.label ?? 'System Default'}</span>
          <FiChevronDown
            className={`w-4 h-4 flex-shrink-0 text-[var(--muted-foreground)] transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>
        {open && (
          <div
            role="listbox"
            className="absolute left-0 right-0 top-full mt-1 z-50 max-h-64 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg py-1"
          >
            {options.map((o) => {
              const isSel = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={isSel}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                    isSel
                      ? 'bg-[var(--primary-50)] dark:bg-[var(--primary-900)]/20 text-[var(--foreground)] dark:text-[var(--primary-300)]'
                      : 'text-[var(--foreground)] hover:bg-[var(--muted)]'
                  }`}
                >
                  <FiCheck
                    className={`w-4 h-4 flex-shrink-0 text-[var(--foreground)] ${isSel ? 'opacity-100' : 'opacity-0'}`}
                  />
                  <span className="truncate">{o.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export interface AudioSettingsProps {
  audioDevices: MediaDeviceInfo[];
  selectedAudioInput: string | null;
  selectedAudioOutput: string | null;
  onRefreshAudioDevices: () => void;
  onSetAudioInput: (deviceId: string) => void;
  onSetAudioOutput: (deviceId: string) => void;
}

export function AudioSettings({
  audioDevices,
  selectedAudioInput,
  selectedAudioOutput,
  onRefreshAudioDevices,
  onSetAudioInput,
  onSetAudioOutput,
}: AudioSettingsProps) {
  const [audioSettings, setAudioSettings] = useState<AudioSettingsType>(() =>
    callAudioService.getSettings()
  );
  const [isPlayingRingback, setIsPlayingRingback] = useState(false);
  const [previewingRingtoneId, setPreviewingRingtoneId] = useState<string | null>(null);

  useEffect(() => {
    callAudioService.initialize().then(() => {
      setAudioSettings(callAudioService.getSettings());
    });
  }, []);

  useEffect(() => {
    return () => {
      callAudioService.stopAll();
    };
  }, []);

  const handleAudioSettingsChange = useCallback((updates: Partial<AudioSettingsType>) => {
    callAudioService.updateSettings(updates);
    setAudioSettings(callAudioService.getSettings());
  }, []);

  const handlePreviewRingtone = useCallback(
    (ringtoneId: string) => {
      if (previewingRingtoneId === ringtoneId) {
        callAudioService.stopPreview();
        setPreviewingRingtoneId(null);
      } else {
        callAudioService.stopAll();
        setIsPlayingRingback(false);
        callAudioService.previewRingtone(ringtoneId);
        setPreviewingRingtoneId(ringtoneId);
        setTimeout(() => {
          callAudioService.stopPreview();
          setPreviewingRingtoneId(null);
        }, 5000);
      }
    },
    [previewingRingtoneId]
  );

  const handleSelectRingtone = useCallback(
    (ringtoneId: string) => {
      handleAudioSettingsChange({ selectedRingtone: ringtoneId });
    },
    [handleAudioSettingsChange]
  );

  const handleTestRingback = useCallback(() => {
    if (isPlayingRingback) {
      callAudioService.stopRingback();
      setIsPlayingRingback(false);
    } else {
      callAudioService.stopAll();
      setPreviewingRingtoneId(null);
      callAudioService.playRingback();
      setIsPlayingRingback(true);
      setTimeout(() => {
        callAudioService.stopRingback();
        setIsPlayingRingback(false);
      }, 6000);
    }
  }, [isPlayingRingback]);

  const inputDevices = audioDevices.filter((d) => d.kind === 'audioinput');
  const outputDevices = audioDevices.filter((d) => d.kind === 'audiooutput');

  return (
    <>
      {/* Audio Devices */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <FiVolume2 className="w-4 h-4 text-[var(--foreground)]" />
              Audio Devices
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRefreshAudioDevices()}
              className="h-8 px-2"
            >
              <FiRefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          <DeviceSelect
            icon={<FiMic className="w-4 h-4 text-[var(--muted-foreground)]" />}
            label="Microphone"
            value={selectedAudioInput || ''}
            options={[
              { value: '', label: 'System Default' },
              ...inputDevices.map((device) => ({
                value: device.deviceId,
                label: device.label || `Microphone ${device.deviceId.slice(0, 8)}`,
              })),
            ]}
            onChange={onSetAudioInput}
          />
          <DeviceSelect
            icon={<FiSpeaker className="w-4 h-4 text-[var(--muted-foreground)]" />}
            label="Speaker"
            value={selectedAudioOutput || ''}
            options={[
              { value: '', label: 'System Default' },
              ...outputDevices.map((device) => ({
                value: device.deviceId,
                label: device.label || `Speaker ${device.deviceId.slice(0, 8)}`,
              })),
            ]}
            onChange={onSetAudioOutput}
          />
        </CardContent>
      </Card>

      {/* Ringtone & Sounds */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <FiMusic className="w-4 h-4 text-[var(--foreground)]" />
              Sounds
            </CardTitle>
            <ToggleSwitch
              enabled={audioSettings.enabled}
              onChange={() => handleAudioSettingsChange({ enabled: !audioSettings.enabled })}
            />
          </div>
          {!audioSettings.enabled && (
            <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
              All sounds are muted
            </p>
          )}
        </CardHeader>
        <CardContent
          className={`pt-0 space-y-5 ${!audioSettings.enabled ? 'opacity-50 pointer-events-none' : ''}`}
        >
          {/* Volume */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-[var(--foreground)]">Volume</label>
              <span className="text-sm tabular-nums text-[var(--muted-foreground)]">
                {Math.round(audioSettings.volume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(audioSettings.volume * 100)}
              onChange={(e) =>
                handleAudioSettingsChange({ volume: parseInt(e.target.value) / 100 })
              }
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[var(--primary-600)]"
            />
          </div>

          <div className="border-t border-[var(--border)]" />

          {/* Incoming Ringtone */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-[var(--foreground)]">Incoming Ringtone</p>
              <ToggleSwitch
                enabled={audioSettings.ringtoneEnabled}
                onChange={() =>
                  handleAudioSettingsChange({ ringtoneEnabled: !audioSettings.ringtoneEnabled })
                }
              />
            </div>

            {audioSettings.ringtoneEnabled && (
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <select
                    value={audioSettings.selectedRingtone}
                    onChange={(e) => handleSelectRingtone(e.target.value)}
                    className="w-full h-10 rounded-lg border border-[var(--border)] bg-[var(--input)] pl-3 pr-8 text-sm text-[var(--foreground)] appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--primary-600)]"
                  >
                    {AVAILABLE_RINGTONES.map((ringtone) => (
                      <option key={ringtone.id} value={ringtone.id}>
                        {ringtone.name}
                      </option>
                    ))}
                  </select>
                  <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)] pointer-events-none" />
                </div>
                <button
                  onClick={() => handlePreviewRingtone(audioSettings.selectedRingtone)}
                  className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                    previewingRingtoneId === audioSettings.selectedRingtone
                      ? 'bg-red-500 text-white'
                      : 'bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                  }`}
                  aria-label={
                    previewingRingtoneId === audioSettings.selectedRingtone
                      ? 'Stop preview'
                      : 'Preview ringtone'
                  }
                >
                  {previewingRingtoneId === audioSettings.selectedRingtone ? (
                    <FiStopCircle className="w-4 h-4" />
                  ) : (
                    <FiPlay className="w-4 h-4" />
                  )}
                </button>
              </div>
            )}
          </div>

          <div className="border-t border-[var(--border)]" />

          {/* Outgoing Ringback */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={handleTestRingback}
                className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                  isPlayingRingback
                    ? 'bg-red-500 text-white'
                    : 'bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                }`}
                aria-label={isPlayingRingback ? 'Stop ringback' : 'Preview ringback'}
              >
                {isPlayingRingback ? (
                  <FiStopCircle className="w-4 h-4" />
                ) : (
                  <FiPlay className="w-4 h-4" />
                )}
              </button>
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">Outgoing Ringback</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Sound while waiting for answer
                </p>
              </div>
            </div>
            <ToggleSwitch
              enabled={audioSettings.ringbackEnabled}
              onChange={() =>
                handleAudioSettingsChange({ ringbackEnabled: !audioSettings.ringbackEnabled })
              }
            />
          </div>
        </CardContent>
      </Card>
    </>
  );
}
