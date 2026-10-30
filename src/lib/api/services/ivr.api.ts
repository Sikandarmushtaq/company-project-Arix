/**
 * Call Menu (IVR) API — Phase 0 (flow CRUD + validation, no telephony).
 * Mirrors serverconfig/server/src/modules/ivr. Owner-only endpoints at /ivr.
 */
import { apiClient } from '../client';
import type { ApiResponse } from '@/lib/types';

export type IvrNodeType =
  | 'entry'
  | 'greeting'
  | 'menu'
  | 'hours'
  | 'ring_user'
  | 'ring_group'
  | 'voicemail'
  | 'transfer'
  | 'hangup';

export type IvrMenuKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '*' | '#';
/** A business-hours node's outgoing branches. */
export type IvrHoursHandle = 'open' | 'closed' | 'holiday';
export type IvrMenuHandle = IvrMenuKey | 'timeout' | 'invalid' | IvrHoursHandle;

export interface IvrPrompt {
  text?: string;
  audioKey?: string;
  voice?: string;
}

/** A weekly OPEN interval. day: 1=Sun … 7=Sat (FreeSWITCH wday). start/end "HH:MM" 24h. */
export interface IvrHoursInterval {
  day: number;
  start: string;
  end: string;
}

/** A holiday/closed date → the holiday (else closed) branch. */
export interface IvrHoliday {
  name?: string;
  /** Recurring "MM-DD" (every year) or one-off "YYYY-MM-DD". */
  date: string;
  /** Optional inclusive end date (same format) for a multi-day closure. */
  endDate?: string;
}

export interface IvrNodeData {
  label?: string;
  prompt?: IvrPrompt;
  options?: { key: IvrMenuKey; label?: string }[];
  timeoutSeconds?: number;
  maxRetries?: number;
  userId?: number;
  extension?: string;
  groupId?: number;
  externalNumber?: string;
  /** hours: weekly OPEN intervals; a call outside all of them takes the `closed` branch. */
  hours?: IvrHoursInterval[];
  /** hours: dates that force the `holiday` branch (or `closed` if no holiday branch). */
  holidays?: IvrHoliday[];
  /** hours: IANA timezone the schedule is evaluated in (e.g. "America/New_York"). */
  timezone?: string;
}

export interface IvrNode {
  id: string;
  type: IvrNodeType;
  position: { x: number; y: number };
  data: IvrNodeData;
}

export interface IvrEdge {
  id: string;
  source: string;
  sourceHandle?: IvrMenuHandle;
  target: string;
}

export interface IvrFlow {
  nodes: IvrNode[];
  edges: IvrEdge[];
}

export interface IvrFlowRecord {
  id: number;
  organizationId: number;
  name: string;
  status: 'draft' | 'published';
  flow: IvrFlow;
  version: number;
  isDefault: boolean;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  /** Phase 1 publish state (null until first published). */
  ivrExtension: string | null;
  attachedNumber: string | null;
}

export interface IvrGateCheck {
  key: 'org' | 'telephony' | 'number' | 'flow';
  label: string;
  ok: boolean;
  detail?: string;
}

export interface IvrReadiness {
  canPublish: boolean;
  checks: IvrGateCheck[];
  numbers: string[];
}

export interface IvrPreview {
  ok: boolean;
  kind: 'menu' | 'linear' | 'hours';
  errors: { code: string; message: string }[];
  warnings: string[];
  ivrExtension: string;
  dialplanXml: string;
  statements: { sql: string; params: unknown[] }[];
}

export interface IvrTargetOption {
  id: number;
  name: string;
  extension: string;
}

export interface IvrTargets {
  users: IvrTargetOption[];
  teams: IvrTargetOption[];
}

export interface IvrUploadResult {
  audioKey: string;
  filename: string;
  bytes: number;
}

export interface IvrVoice {
  id: string;
  name: string;
  gender?: 'male' | 'female';
}

/** Preview-audio render: a playable data URI, or null when TTS is unavailable. */
export interface IvrPreviewAudio {
  audio: string | null;
  reason?: string;
  mime?: string;
  bytes?: number;
}

export interface IvrValidationIssue {
  level: 'error' | 'warning';
  nodeId?: string;
  message: string;
}

export interface IvrValidationResult {
  valid: boolean;
  issues: IvrValidationIssue[];
}

export const ivrApi = {
  /** Load (or lazily create) the org's default call menu — the builder's entry point. */
  async getDefault(): Promise<IvrFlowRecord> {
    const res = await apiClient.get<ApiResponse<IvrFlowRecord>>('/ivr/default');
    return res.data;
  },

  async list(): Promise<IvrFlowRecord[]> {
    const res = await apiClient.get<ApiResponse<IvrFlowRecord[]>>('/ivr');
    return res.data;
  },

  async get(id: number): Promise<IvrFlowRecord> {
    const res = await apiClient.get<ApiResponse<IvrFlowRecord>>(`/ivr/${id}`);
    return res.data;
  },

  /** Save name/flow. Returns the saved flow + advisory validation issues. */
  async update(
    id: number,
    body: { name?: string; flow?: IvrFlow }
  ): Promise<{ flow: IvrFlowRecord; validation: IvrValidationResult }> {
    const res = await apiClient.put<
      ApiResponse<IvrFlowRecord> & { validation: IvrValidationResult }
    >(`/ivr/${id}`, body);
    return { flow: res.data, validation: res.validation };
  },

  /** Validate a flow without saving (live builder feedback). */
  async validate(flow: IvrFlow): Promise<IvrValidationResult> {
    const res = await apiClient.post<ApiResponse<IvrValidationResult>>('/ivr/validate', { flow });
    return res.data;
  },

  async remove(id: number): Promise<void> {
    await apiClient.delete(`/ivr/${id}`);
  },

  // ---- Phase 1 publish lifecycle ----

  /** People + teams a step can route to (builder target pickers). */
  async targets(): Promise<IvrTargets> {
    const res = await apiClient.get<ApiResponse<IvrTargets>>('/ivr/targets');
    return res.data;
  },

  /** Available TTS voices for greeting selection. */
  async voices(): Promise<IvrVoice[]> {
    const res = await apiClient.get<ApiResponse<IvrVoice[]>>('/ivr/voices');
    return res.data;
  },

  /**
   * Render "Test call" preview audio — the EXACT Piper voice a caller hears —
   * for a greeting/menu prompt. Returns a base64 `audio/wav` data URI (or
   * `audio: null` with a reason if TTS isn't configured, so the caller can fall
   * back to the device voice).
   */
  async previewAudio(text: string, voice?: string): Promise<IvrPreviewAudio> {
    const res = await apiClient.post<ApiResponse<IvrPreviewAudio>>('/ivr/preview-audio', {
      text,
      ...(voice ? { voice } : {}),
    });
    return res.data;
  },

  /** Upload a greeting recording; returns the stored audio key to save on the node. */
  async uploadPrompt(file: File): Promise<IvrUploadResult> {
    const fd = new FormData();
    fd.append('file', file);
    const res = await apiClient.upload<ApiResponse<IvrUploadResult>>('/ivr/prompts/upload', fd);
    return res.data;
  },

  /** Publish gate: what still needs to be true before this menu can go live. */
  async readiness(id: number): Promise<IvrReadiness> {
    const res = await apiClient.get<ApiResponse<IvrReadiness>>(`/ivr/${id}/readiness`);
    return res.data;
  },

  /** Dry-run: what would be written to the phone system (no changes made). */
  async preview(id: number): Promise<IvrPreview> {
    const res = await apiClient.get<ApiResponse<IvrPreview>>(`/ivr/${id}/preview`);
    return res.data;
  },

  /** Publish the menu live, optionally choosing which owned number answers it. */
  async publish(id: number, number?: string): Promise<IvrFlowRecord> {
    const res = await apiClient.post<ApiResponse<IvrFlowRecord>>(
      `/ivr/${id}/publish`,
      number ? { number } : {}
    );
    return res.data;
  },

  /** Take the menu offline. */
  async unpublish(id: number): Promise<IvrFlowRecord> {
    const res = await apiClient.post<ApiResponse<IvrFlowRecord>>(`/ivr/${id}/unpublish`, {});
    return res.data;
  },
};
