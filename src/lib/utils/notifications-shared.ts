'use client';

/**
 * Notification Shared Utilities
 *
 * Title flashing, favicon badges, audio system, browser notification helpers,
 * and toast utilities shared by all notification handlers.
 *
 * @module lib/utils/notifications-shared
 */

import { toast } from '@/lib/stores/toast';
import { useNotificationSettings } from '@/lib/stores/notificationSettings';
import {
  NOTIFICATION_SOUNDS,
  BROWSER_NOTIFICATION,
  type NotificationSoundType,
} from '@/lib/constants/notifications';

// ============================================================
// Title Flashing System
// ============================================================

interface TitleFlashState {
  intervalId: ReturnType<typeof setInterval> | null;
  originalTitle: string;
  isFlashing: boolean;
}

const titleFlashState: TitleFlashState = {
  intervalId: null,
  originalTitle: '',
  isFlashing: false,
};

/**
 * Start flashing the browser tab title
 * Alternates between original title and notification message
 */
export function startTitleFlash(message: string, emoji: string = '📞'): void {
  if (typeof document === 'undefined') return;

  // Don't flash if tab is focused
  if (document.hasFocus()) return;

  // Already flashing - update message
  if (titleFlashState.isFlashing) {
    stopTitleFlash();
  }

  titleFlashState.originalTitle = document.title;
  titleFlashState.isFlashing = true;

  let showNotification = true;
  titleFlashState.intervalId = setInterval(() => {
    if (showNotification) {
      document.title = `${emoji} ${message}`;
    } else {
      document.title = titleFlashState.originalTitle;
    }
    showNotification = !showNotification;
  }, 1000);

  // Stop flashing when tab gains focus
  const handleFocus = () => {
    stopTitleFlash();
    window.removeEventListener('focus', handleFocus);
  };
  window.addEventListener('focus', handleFocus);
}

/**
 * Stop title flashing and restore original title
 */
export function stopTitleFlash(): void {
  if (typeof document === 'undefined') return;

  if (titleFlashState.intervalId) {
    clearInterval(titleFlashState.intervalId);
    titleFlashState.intervalId = null;
  }

  if (titleFlashState.isFlashing) {
    document.title = titleFlashState.originalTitle;
    titleFlashState.isFlashing = false;
  }
}

// ============================================================
// Favicon Badge System
// ============================================================

interface FaviconBadgeState {
  originalFavicon: string | null;
  badgeCount: number;
  linkElement: HTMLLinkElement | null;
}

const faviconState: FaviconBadgeState = {
  originalFavicon: null,
  badgeCount: 0,
  linkElement: null,
};

/**
 * Get the current favicon link element
 */
function getFaviconLink(): HTMLLinkElement | null {
  if (typeof document === 'undefined') return null;

  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.querySelector<HTMLLinkElement>('link[rel="shortcut icon"]');
  }
  return link;
}

/**
 * Draw favicon with badge
 */
function drawFaviconWithBadge(count: number): void {
  if (typeof document === 'undefined') return;

  const link = getFaviconLink();
  if (!link) return;

  // Store original favicon on first call
  if (faviconState.originalFavicon === null) {
    faviconState.originalFavicon = link.href;
    faviconState.linkElement = link;
  }

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const canvas = document.createElement('canvas');
    const size = 32;
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw original favicon
    ctx.drawImage(img, 0, 0, size, size);

    // Draw badge
    if (count > 0) {
      const badgeSize = 14;
      const badgeX = size - badgeSize;
      const badgeY = 0;

      // Badge background (red circle)
      ctx.beginPath();
      ctx.arc(badgeX + badgeSize / 2, badgeY + badgeSize / 2, badgeSize / 2, 0, 2 * Math.PI);
      ctx.fillStyle = '#ef4444';
      ctx.fill();

      // Badge text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const displayCount = count > 9 ? '9+' : count.toString();
      ctx.fillText(displayCount, badgeX + badgeSize / 2, badgeY + badgeSize / 2 + 1);
    }

    // Update favicon
    if (faviconState.linkElement) {
      faviconState.linkElement.href = canvas.toDataURL('image/png');
    }
  };

  img.onerror = () => {
    // If favicon can't be loaded, create a simple badge-only favicon
    const canvas = document.createElement('canvas');
    const size = 32;
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw simple phone icon background
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, 2 * Math.PI);
    ctx.fill();

    // Draw badge if count > 0
    if (count > 0) {
      const badgeSize = 14;
      const badgeX = size - badgeSize;
      const badgeY = 0;

      ctx.beginPath();
      ctx.arc(badgeX + badgeSize / 2, badgeY + badgeSize / 2, badgeSize / 2, 0, 2 * Math.PI);
      ctx.fillStyle = '#ef4444';
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const displayCount = count > 9 ? '9+' : count.toString();
      ctx.fillText(displayCount, badgeX + badgeSize / 2, badgeY + badgeSize / 2 + 1);
    }

    if (faviconState.linkElement) {
      faviconState.linkElement.href = canvas.toDataURL('image/png');
    }
  };

  img.src = faviconState.originalFavicon || '/favicon.ico';
}

/**
 * Update favicon badge count
 */
export function updateFaviconBadge(count: number): void {
  faviconState.badgeCount = count;

  if (count === 0) {
    clearFaviconBadge();
  } else {
    drawFaviconWithBadge(count);
  }
}

/**
 * Increment favicon badge count
 */
export function incrementFaviconBadge(): void {
  updateFaviconBadge(faviconState.badgeCount + 1);
}

/**
 * Clear favicon badge and restore original
 */
export function clearFaviconBadge(): void {
  if (faviconState.originalFavicon && faviconState.linkElement) {
    faviconState.linkElement.href = faviconState.originalFavicon;
  }
  faviconState.badgeCount = 0;
}

/**
 * Get current badge count
 */
export function getFaviconBadgeCount(): number {
  return faviconState.badgeCount;
}

// ============================================================
// Audio System
// ============================================================

/**
 * Audio element cache - reused to avoid creating new elements each time
 */
const audioCache: Map<NotificationSoundType, HTMLAudioElement> = new Map();

/**
 * Track if sound files are available
 */
const soundFileStatus: Map<NotificationSoundType, boolean> = new Map();

/**
 * Shared AudioContext for fallback beeps - must be resumed after user gesture
 */
let sharedAudioContext: AudioContext | null = null;
let audioContextResumed = false;

/**
 * Get or create audio element for a sound type
 */
function getAudioElement(type: NotificationSoundType): HTMLAudioElement | null {
  if (typeof window === 'undefined') {
    return null;
  }

  let audio = audioCache.get(type);
  if (!audio) {
    audio = new Audio(NOTIFICATION_SOUNDS[type]);
    audio.preload = 'auto';

    // Track if file loads successfully
    audio.addEventListener('canplaythrough', () => {
      soundFileStatus.set(type, true);
    });
    audio.addEventListener('error', () => {
      soundFileStatus.set(type, false);
      console.debug(`[Notification] Sound file not found: ${NOTIFICATION_SOUNDS[type]}`);
    });

    audioCache.set(type, audio);
  }

  return audio;
}

/**
 * Get or create the shared AudioContext
 */
function getSharedAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new AudioContextClass();
  }

  return sharedAudioContext;
}

/**
 * Resume the shared AudioContext (must be called from a user gesture)
 */
export function resumeAudioContext(): void {
  const ctx = getSharedAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx
      .resume()
      .then(() => {
        audioContextResumed = true;
      })
      .catch((err) => {
        console.debug('[Notification] Failed to resume AudioContext:', err);
      });
  } else if (ctx && ctx.state === 'running') {
    audioContextResumed = true;
  }
}

/**
 * Play short notification sound using Web Audio API
 * Pleasant two-tone "ding" - quick and non-intrusive
 */
async function playFallbackBeep(volume: number): Promise<void> {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;

    // If context isn't running (no user gesture yet), skip silently
    if (ctx.state === 'suspended') {
      console.debug('[Notification] AudioContext suspended, skipping notification sound');
      return;
    }

    const now = ctx.currentTime;

    // Create a pleasant two-tone notification sound
    // First tone: E6 (1318.5 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.value = 1318.5;
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    gain1.gain.setValueAtTime(volume * 0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc1.start(now);
    osc1.stop(now + 0.15);

    // Second tone: G6 (1568 Hz) - slightly delayed for "ding-dong" effect
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.value = 1568;
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    gain2.gain.setValueAtTime(0, now);
    gain2.gain.setValueAtTime(volume * 0.2, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.3);

    // Cleanup oscillators/gains (context is shared, don't close it)
    setTimeout(() => {
      osc1.disconnect();
      gain1.disconnect();
      osc2.disconnect();
      gain2.disconnect();
    }, 500);
  } catch (error) {
    console.debug('[Notification] Notification sound failed:', error);
  }
}

/**
 * Stop a notification sound that is currently playing
 */
export function stopNotificationSound(type: NotificationSoundType): void {
  const audio = audioCache.get(type);
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
}

/**
 * Play notification sound
 * Respects user settings for sound enabled and volume
 * Falls back to Web Audio API beep if sound file not available
 */
export async function playNotificationSound(type: NotificationSoundType): Promise<void> {
  const settings = useNotificationSettings.getState();

  if (!settings.soundEnabled) {
    return;
  }

  try {
    const audio = getAudioElement(type);
    if (!audio) return;

    // Check if sound file is available
    if (soundFileStatus.get(type) === false) {
      await playFallbackBeep(settings.soundVolume);
      return;
    }

    audio.volume = settings.soundVolume;
    audio.currentTime = 0;
    await audio.play();
  } catch (error) {
    // If file playback fails, try fallback beep
    console.debug('[Notification] Sound playback failed, using fallback:', error);
    await playFallbackBeep(settings.soundVolume);
  }
}

// ============================================================
// Browser Notification Helpers
// ============================================================

/**
 * Request browser notification permission
 * Call this on user interaction (e.g., settings page toggle)
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission !== 'denied') {
    return await Notification.requestPermission();
  }

  return Notification.permission;
}

/**
 * Check if browser notifications are permitted
 */
export function areBrowserNotificationsPermitted(): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  return Notification.permission === 'granted';
}

/**
 * Show browser notification
 * Respects user settings for browser notifications enabled
 */
export function showBrowserNotification(
  title: string,
  options?: NotificationOptions
): Notification | null {
  const settings = useNotificationSettings.getState();

  if (!settings.browserNotificationsEnabled) {
    console.log('[Notification] Browser notifications disabled in settings');
    return null;
  }

  if (!areBrowserNotificationsPermitted()) {
    console.log('[Notification] Browser notifications not permitted');
    return null;
  }

  try {
    // Only include icon/badge if they're set
    const notificationOptions: NotificationOptions = { ...options };
    if (BROWSER_NOTIFICATION.ICON) {
      notificationOptions.icon = BROWSER_NOTIFICATION.ICON;
    }
    if (BROWSER_NOTIFICATION.BADGE) {
      notificationOptions.badge = BROWSER_NOTIFICATION.BADGE;
    }

    console.log('[Notification] Creating browser notification:', title, notificationOptions);
    const notification = new Notification(title, notificationOptions);

    // Auto-close after configured time
    setTimeout(() => notification.close(), BROWSER_NOTIFICATION.AUTO_CLOSE_MS);

    console.log('[Notification] Browser notification created successfully');
    return notification;
  } catch (error) {
    console.error('[Notification] Failed to show browser notification:', error);
    return null;
  }
}

// ============================================================
// Toast Helper
// ============================================================

/**
 * Show toast notification (for generic messages)
 * Respects user settings for toast enabled
 */
export function showToast(
  message: string,
  type: 'success' | 'error' | 'info' | 'warning' = 'info',
  duration?: number
): void {
  const settings = useNotificationSettings.getState();

  if (!settings.toastEnabled) {
    return;
  }

  const toastDuration = duration ?? settings.toastDuration;
  toast[type](message, toastDuration);
}

// ============================================================
// Navigation Helper
// ============================================================

/**
 * Navigate without page reload using custom event
 * Components can listen for 'app:navigate' events and use Next.js router
 */
export function navigateFromNotification(path: string): void {
  // Dispatch custom event for React components to handle
  const event = new CustomEvent('app:navigate', { detail: { path } });
  window.dispatchEvent(event);
}

// ============================================================
// Preload & Unlock
// ============================================================

/**
 * Preload all notification sounds
 * Call this on app initialization for faster playback
 */
export function preloadNotificationSounds(): void {
  Object.keys(NOTIFICATION_SOUNDS).forEach((key) => {
    getAudioElement(key as NotificationSoundType);
  });
}

/**
 * Unlock notification audio elements for autoplay policy.
 * Must be called from a user gesture (click/keydown/touch) handler.
 * Plays each cached element silently so future programmatic play() succeeds.
 * Also resumes the shared AudioContext for fallback beeps.
 */
export function unlockNotificationAudio(): void {
  // Resume the shared AudioContext for fallback beeps
  resumeAudioContext();

  // Unlock cached audio elements
  audioCache.forEach((audio) => {
    const prevVolume = audio.volume;
    audio.volume = 0;
    audio
      .play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = prevVolume;
      })
      .catch(() => {
        audio.volume = prevVolume;
      });
  });
}

// ============================================================
// Test Helper
// ============================================================

/**
 * Test browser notification - call from console: testBrowserNotification()
 * Useful for debugging notification issues
 */
export function testBrowserNotification(): void {
  console.log('[Notification] Testing browser notification...');
  console.log('[Notification] Permission:', Notification.permission);

  if (Notification.permission !== 'granted') {
    console.log('[Notification] Requesting permission...');
    Notification.requestPermission().then((permission) => {
      console.log('[Notification] Permission result:', permission);
      if (permission === 'granted') {
        new Notification('Test Notification', {
          body: 'If you see this, notifications are working!',
          requireInteraction: true,
        });
      }
    });
  } else {
    const notification = new Notification('Test Notification', {
      body: 'If you see this, notifications are working!',
      requireInteraction: true,
    });
    console.log('[Notification] Test notification created:', notification);
  }
}

// Expose to window for console testing
if (typeof window !== 'undefined') {
  (
    window as unknown as { testBrowserNotification: typeof testBrowserNotification }
  ).testBrowserNotification = testBrowserNotification;
}
