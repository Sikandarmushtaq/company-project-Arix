'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useBulkSmsStore } from '@/lib/stores/bulkSms';

export { type QueuedMessage, type ParsedRecipient } from '@/lib/stores/bulkSms';

export function useAutoSms() {
  const store = useBulkSmsStore();
  const sendCallbackRef = useRef<((to: string, body: string) => Promise<void>) | null>(null);
  const isSendingRef = useRef(false);
  const lastSentTimeRef = useRef<number | null>(null);

  const setSendCallback = useCallback((callback: (to: string, body: string) => Promise<void>) => {
    sendCallbackRef.current = callback;
  }, []);

  const processQueue = useCallback(async () => {
    const { queue, isRunning, intervalSeconds, markSending, markSent, markFailed, setIsRunning } =
      useBulkSmsStore.getState();

    if (!isRunning || !sendCallbackRef.current || isSendingRef.current) return;

    const next = queue.find((m) => m.status === 'pending');
    if (!next) {
      if (queue.length === 0) setIsRunning(false);
      return;
    }

    const now = Date.now();
    const timeSinceLastSent = lastSentTimeRef.current
      ? now - lastSentTimeRef.current
      : intervalSeconds * 1000;

    if (timeSinceLastSent < intervalSeconds * 1000) return;

    isSendingRef.current = true;
    markSending(next.id);

    try {
      await sendCallbackRef.current(next.to, next.body);
      lastSentTimeRef.current = Date.now();
      markSent(next.id);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Send failed';
      markFailed(next.id, errorMsg);

      // Auto-pause on SMS limit reached
      if (/limit\s*reached|limit\s*exceeded|sms\s*limit/i.test(errorMsg)) {
        setIsRunning(false);
      }
    } finally {
      isSendingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const hasPending = store.queue.some((m) => m.status === 'pending');

    // Queue drained while still "running" → the run finished. Flip isRunning off
    // so the UI settles (otherwise it stays stuck sending and buttons gated on
    // !isRunning never appear).
    if (store.isRunning && !hasPending) {
      useBulkSmsStore.getState().setIsRunning(false);
      return;
    }

    if (!store.isRunning || !hasPending) return;

    const interval = setInterval(processQueue, 1000);
    return () => clearInterval(interval);
  }, [store.isRunning, store.queue, processQueue]);

  const start = useCallback(() => {
    const { queue, setIsRunning } = useBulkSmsStore.getState();
    if (queue.some((m) => m.status === 'pending')) {
      setIsRunning(true);
    }
  }, []);

  const pause = useCallback(() => {
    useBulkSmsStore.getState().setIsRunning(false);
  }, []);

  return {
    ...store,
    start,
    pause,
    setSendCallback,
  };
}
