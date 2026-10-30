'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type MessageStatus = 'pending' | 'sending' | 'sent' | 'failed';

export interface QueuedMessage {
  id: string;
  to: string;
  name?: string;
  address?: string;
  body: string;
  timestamp: number;
  status: MessageStatus;
  sentAt?: number;
  error?: string;
}

export interface ParsedRecipient {
  phone: string;
  name?: string;
  address?: string;
  row: number;
}

interface BulkSmsState {
  // Campaign data
  recipients: ParsedRecipient[];
  queue: QueuedMessage[];
  sentMessages: QueuedMessage[];
  failedMessages: QueuedMessage[];
  messageTemplate: string;
  uploadedFileName: string | null;
  intervalSeconds: number;
  // Backend campaign-history record id for this run (persisted so it survives a
  // remount/refresh — otherwise a paused/active run can't be finalized).
  currentCampaignId: number | null;

  // Runtime (not persisted)
  isRunning: boolean;

  // Actions
  setRecipients: (recipients: ParsedRecipient[]) => void;
  removeRecipient: (index: number) => void;
  setMessageTemplate: (msg: string) => void;
  setUploadedFileName: (name: string | null) => void;
  setIntervalSeconds: (seconds: number) => void;
  setCurrentCampaignId: (id: number | null) => void;
  queueBulkMessages: (recipients: ParsedRecipient[], template: string) => void;
  markSending: (id: string) => void;
  markSent: (id: string) => void;
  markFailed: (id: string, error: string) => void;
  removeFromQueue: (id: string) => void;
  retryFailed: () => void;
  setIsRunning: (running: boolean) => void;
  clearAll: () => void;
}

export function resolveTemplate(template: string, name?: string, address?: string): string {
  let result = template;
  if (result.includes('{name}')) {
    result = result.replace(/\{name\}/gi, name?.trim() || 'there');
  }
  if (result.includes('{address}')) {
    result = result.replace(/\{address\}/gi, address?.trim() || '');
  }
  return result;
}

export const useBulkSmsStore = create<BulkSmsState>()(
  persist(
    (set, get) => ({
      recipients: [],
      queue: [],
      sentMessages: [],
      failedMessages: [],
      messageTemplate: '',
      uploadedFileName: null,
      intervalSeconds: 5,
      currentCampaignId: null,
      isRunning: false,

      setRecipients: (recipients) => set({ recipients }),

      setCurrentCampaignId: (id) => set({ currentCampaignId: id }),

      removeRecipient: (index) =>
        set((s) => ({ recipients: s.recipients.filter((_, i) => i !== index) })),

      setMessageTemplate: (msg) => set({ messageTemplate: msg }),

      setUploadedFileName: (name) => set({ uploadedFileName: name }),

      setIntervalSeconds: (seconds) => set({ intervalSeconds: seconds }),

      queueBulkMessages: (recipients, template) => {
        const now = Date.now();
        const newMessages: QueuedMessage[] = recipients.map((r, index) => ({
          id: `msg-${now}-${index}-${Math.random().toString(36).slice(2)}`,
          to: r.phone,
          name: r.name,
          address: r.address,
          body: resolveTemplate(template, r.name, r.address),
          timestamp: now,
          status: 'pending' as MessageStatus,
        }));
        set((s) => ({ queue: [...s.queue, ...newMessages] }));
      },

      markSending: (id) =>
        set((s) => ({
          queue: s.queue.map((msg) =>
            msg.id === id ? { ...msg, status: 'sending' as MessageStatus } : msg
          ),
        })),

      markSent: (id) =>
        set((s) => {
          const msg = s.queue.find((m) => m.id === id);
          if (!msg) return s;
          const sentMsg = { ...msg, status: 'sent' as MessageStatus, sentAt: Date.now() };
          return {
            queue: s.queue.filter((m) => m.id !== id),
            sentMessages: [...s.sentMessages, sentMsg],
          };
        }),

      markFailed: (id, error) =>
        set((s) => {
          const msg = s.queue.find((m) => m.id === id);
          if (!msg) return s;
          const failedMsg = { ...msg, status: 'failed' as MessageStatus, error };
          return {
            queue: s.queue.filter((m) => m.id !== id),
            failedMessages: [...s.failedMessages, failedMsg],
          };
        }),

      removeFromQueue: (id) => set((s) => ({ queue: s.queue.filter((msg) => msg.id !== id) })),

      retryFailed: () =>
        set((s) => {
          const retryMessages = s.failedMessages.map((msg) => ({
            ...msg,
            id: `retry-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            status: 'pending' as MessageStatus,
            error: undefined,
          }));
          return {
            queue: [...s.queue, ...retryMessages],
            failedMessages: [],
          };
        }),

      setIsRunning: (running) => set({ isRunning: running }),

      clearAll: () =>
        set({
          recipients: [],
          queue: [],
          sentMessages: [],
          failedMessages: [],
          messageTemplate: '',
          uploadedFileName: null,
          currentCampaignId: null,
          isRunning: false,
        }),
    }),
    {
      name: 'bulk-sms-campaign',
      storage: {
        getItem: (name) => {
          if (typeof window === 'undefined') return null;
          const value = sessionStorage.getItem(name);
          return value ? JSON.parse(value) : null;
        },
        setItem: (name, value) => {
          if (typeof window !== 'undefined') {
            sessionStorage.setItem(name, JSON.stringify(value));
          }
        },
        removeItem: (name) => {
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem(name);
          }
        },
      },
      partialize: (state) =>
        ({
          recipients: state.recipients,
          queue: state.queue.map((m) =>
            m.status === 'sending' ? { ...m, status: 'pending' as MessageStatus } : m
          ),
          sentMessages: state.sentMessages,
          failedMessages: state.failedMessages,
          messageTemplate: state.messageTemplate,
          uploadedFileName: state.uploadedFileName,
          currentCampaignId: state.currentCampaignId,
          intervalSeconds: state.intervalSeconds,
          // isRunning is NOT persisted - campaigns don't auto-resume
        }) as unknown as BulkSmsState,
    }
  )
);
