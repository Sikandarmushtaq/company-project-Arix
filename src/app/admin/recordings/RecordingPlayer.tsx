'use client';

/**
 * RecordingPlayer — backwards-compat re-export.
 *
 * The actual player moved to `@/components/recordings/AudioPlayer` when
 * the WhatsApp call recordings page needed the same widget. Keeping this
 * file as a thin re-export so the existing SIP recordings imports
 * (RecordingsTable.tsx, etc.) keep working without churn.
 *
 * @module app/admin/recordings/RecordingPlayer
 */

export {
  AudioPlayer,
  PLAYBACK_SPEEDS,
  type AudioPlayerProps,
} from '@/components/recordings/AudioPlayer';
