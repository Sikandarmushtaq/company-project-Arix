'use client';

/**
 * AI Agents Management Page
 *
 * CRUD interface for AI voice agents.
 *
 * @module app/phone/auto-dialer/agents/page
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  FiArrowLeft,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiCpu,
  FiVolume2,
  FiStopCircle,
  FiCheck,
  FiMic,
  FiZap,
} from 'react-icons/fi';
import { Card, CardContent, Button, Input } from '@/components/ui';
import { PageTransition } from '@/components/phone';
import {
  useAgents,
  useCreateAgent,
  useUpdateAgent,
  useDeleteAgent,
  useVoices,
} from '@/lib/hooks/useCampaigns';
import type { AiAgent, AiAgentStatus, CreateAgentRequest, AiVoice } from '@/lib/api';

const statusConfig: Record<AiAgentStatus, { label: string; bg: string; text: string }> = {
  draft: { label: 'Draft', bg: 'bg-gray-500/10', text: 'text-gray-400' },
  active: { label: 'Active', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  archived: { label: 'Archived', bg: 'bg-red-500/10', text: 'text-red-400' },
};

const defaultForm: CreateAgentRequest = {
  name: '',
  voiceId: '',
  prompt: '',
  firstMessage: 'Hi there! How can I help you today?',
  language: 'en',
  llm: 'gpt-4o-mini',
  temperature: 0.7,
  maxTokens: 500,
  maxDurationSeconds: 300,
};

export default function AgentsPage() {
  const [showModal, setShowModal] = useState(false);
  const [editAgent, setEditAgent] = useState<AiAgent | null>(null);
  const [form, setForm] = useState<CreateAgentRequest>(defaultForm);
  const [step, setStep] = useState<1 | 2>(1); // 1 = voice, 2 = config
  const [personaName, setPersonaName] = useState('');

  const { data, isLoading } = useAgents();
  const createAgent = useCreateAgent();
  const updateAgentMut = useUpdateAgent();
  const deleteAgent = useDeleteAgent();

  const agents = data?.agents || [];

  const openCreate = useCallback(() => {
    setForm(defaultForm);
    setEditAgent(null);
    setPersonaName('');
    setStep(1);
    setShowModal(true);
  }, []);

  const openEdit = useCallback((agent: AiAgent) => {
    setForm({
      name: agent.name,
      voiceId: agent.voiceId,
      voiceName: agent.voiceName || undefined,
      prompt: agent.prompt,
      firstMessage: agent.firstMessage || undefined,
      language: agent.language,
      llm: agent.llm,
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
      transferPhone: agent.transferPhone || undefined,
      voicemailMessage: agent.voicemailMessage || undefined,
      maxDurationSeconds: agent.maxDurationSeconds,
    });
    setEditAgent(agent);
    // Try to extract persona name from the prompt ("You are Sarah, a...")
    const nameMatch = agent.prompt.match(/^You are (\w+),/);
    setPersonaName(nameMatch ? nameMatch[1] : agent.name);
    setStep(2); // skip voice selection when editing
    setShowModal(true);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (editAgent) {
        await updateAgentMut.mutateAsync({ agentId: editAgent.id, data: form });
      } else {
        await createAgent.mutateAsync(form);
      }
      setShowModal(false);
    },
    [form, editAgent, createAgent, updateAgentMut]
  );

  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null);

  const handleDelete = useCallback(async () => {
    if (!deleteConfirm) return;
    await deleteAgent.mutateAsync(deleteConfirm.id);
    setDeleteConfirm(null);
  }, [deleteConfirm, deleteAgent]);

  const updateField = useCallback(
    <K extends keyof CreateAgentRequest>(key: K, value: CreateAgentRequest[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  return (
    <PageTransition className="absolute inset-0 overflow-hidden">
      <div className="flex h-full min-h-0 flex-col bg-[var(--card)]">
        {/* Header region */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] px-5 pt-3.5 pb-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <Link
              href="/phone/auto-dialer"
              aria-label="Back to campaigns"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            >
              <FiArrowLeft className="h-4 w-4" />
            </Link>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--primary-50)] text-[var(--foreground)] dark:bg-[var(--primary-900)]/30">
              <FiCpu className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-black text-[var(--foreground)]">AI Agents</h1>
              <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">
                Create and manage AI voice agents for your campaigns
              </p>
            </div>
          </div>
          <Button size="sm" onClick={openCreate}>
            <FiPlus className="mr-2 h-4 w-4" />
            New Agent
          </Button>
        </div>

        {/* Scroll area */}
        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
        {/* Agent List */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-36 bg-muted rounded-lg" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : agents.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
                <FiCpu className="h-8 w-8 text-[var(--foreground)]" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No agents yet</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                Create an AI agent with a voice, personality, and script to power your calling
                campaigns.
              </p>
              <Button onClick={openCreate}>
                <FiPlus className="mr-2 h-4 w-4" />
                Create Your First Agent
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => {
              const status = statusConfig[agent.status];
              return (
                <Card
                  key={agent.id}
                  className="group hover:border-primary/30 transition-all duration-200"
                >
                  <CardContent className="p-5">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base truncate">{agent.name}</h3>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full ${status.bg} ${status.text}`}
                          >
                            {status.label}
                          </span>
                          {agent.voiceName && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                              <FiMic className="h-3 w-3" />
                              {agent.voiceName}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          className="p-1.5 rounded-md hover:bg-muted transition-colors"
                          onClick={() => openEdit(agent)}
                          title="Edit"
                        >
                          <FiEdit2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        <button
                          className="p-1.5 rounded-md hover:bg-red-500/10 transition-colors"
                          onClick={() => setDeleteConfirm({ id: agent.id, name: agent.name })}
                          title="Delete"
                        >
                          <FiTrash2 className="h-3.5 w-3.5 text-red-400" />
                        </button>
                      </div>
                    </div>

                    {/* Prompt preview */}
                    <p className="text-xs text-muted-foreground line-clamp-3 mb-4 leading-relaxed">
                      {agent.prompt.slice(0, 200)}
                      {agent.prompt.length > 200 ? '...' : ''}
                    </p>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5">
                      <span className="px-2 py-0.5 text-[10px] font-medium bg-muted rounded-md">
                        {agent.llm}
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-medium bg-muted rounded-md">
                        {agent.language.toUpperCase()}
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-medium bg-muted rounded-md">
                        {Math.floor(agent.maxDurationSeconds / 60)}m max
                      </span>
                      {agent.transferPhone && (
                        <span className="px-2 py-0.5 text-[10px] font-medium bg-blue-500/10 text-blue-400 rounded-md">
                          Transfer
                        </span>
                      )}
                      {agent.voicemailMessage && (
                        <span className="px-2 py-0.5 text-[10px] font-medium bg-purple-500/10 text-purple-400 rounded-md">
                          Voicemail
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
        </div>
        {/* end scroll area */}

        {/* Create/Edit Modal */}
        {showModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          >
            <div
              className="bg-background border rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90dvh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    {editAgent ? 'Edit Agent' : 'Create AI Agent'}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {step === 1
                      ? 'Step 1: Choose a voice for your agent'
                      : 'Step 2: Configure agent behavior'}
                  </p>
                </div>
                {!editAgent && step === 2 && (
                  <button
                    type="button"
                    className="text-xs text-[var(--foreground)] hover:underline"
                    onClick={() => setStep(1)}
                  >
                    Change voice
                  </button>
                )}
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto">
                {step === 1 ? (
                  <VoicePicker
                    selectedVoiceId={form.voiceId}
                    onSelect={(voice) => {
                      updateField('voiceId', voice.voiceId);
                      updateField('voiceName', voice.name);
                    }}
                    onNext={() => setStep(2)}
                  />
                ) : (
                  <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Selected voice indicator */}
                    {form.voiceName && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
                        <FiMic className="h-4 w-4 text-[var(--foreground)]" />
                        <span className="text-sm">
                          Voice: <strong>{form.voiceName}</strong>
                        </span>
                      </div>
                    )}

                    {/* Agent Name + Persona Name */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Agent Label *</label>
                        <p className="text-xs text-muted-foreground mb-2">
                          Internal name for your dashboard.
                        </p>
                        <input
                          type="text"
                          required
                          className="w-full rounded-lg border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                          value={form.name}
                          onChange={(e) => updateField('name', e.target.value)}
                          placeholder="e.g., Main Receptionist"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Persona Name *</label>
                        <p className="text-xs text-muted-foreground mb-2">
                          The human name callers hear.
                        </p>
                        <input
                          type="text"
                          required
                          className="w-full rounded-lg border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                          value={personaName}
                          onChange={(e) => setPersonaName(e.target.value)}
                          placeholder="e.g., Sarah"
                        />
                      </div>
                    </div>

                    {/* Prompt — with AI Generator */}
                    <PromptBuilder
                      value={form.prompt}
                      agentName={personaName || form.name}
                      onChange={(val) => updateField('prompt', val)}
                      onFirstMessageGenerated={(msg) => {
                        if (!form.firstMessage || form.firstMessage === defaultForm.firstMessage) {
                          updateField('firstMessage', msg);
                        }
                      }}
                    />

                    {/* First Message */}
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Opening Line</label>
                      <p className="text-xs text-muted-foreground mb-2">
                        What the agent says first when the call connects.
                      </p>
                      <input
                        type="text"
                        className="w-full rounded-lg border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                        value={form.firstMessage || ''}
                        onChange={(e) => updateField('firstMessage', e.target.value)}
                        placeholder="Hi there! Thanks for calling. How can I help you?"
                      />
                    </div>

                    {/* Transfer & Duration row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1.5">
                          Transfer To (optional)
                        </label>
                        <p className="text-xs text-muted-foreground mb-2">
                          Phone for warm transfer to human.
                        </p>
                        <input
                          type="text"
                          className="w-full rounded-lg border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                          value={form.transferPhone || ''}
                          onChange={(e) => updateField('transferPhone', e.target.value)}
                          placeholder="+12164281997"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">
                          Max Call Duration
                        </label>
                        <p className="text-xs text-muted-foreground mb-2">
                          In seconds (300 = 5 min).
                        </p>
                        <input
                          type="number"
                          className="w-full rounded-lg border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                          value={form.maxDurationSeconds}
                          onChange={(e) =>
                            updateField('maxDurationSeconds', Number(e.target.value))
                          }
                        />
                      </div>
                    </div>

                    {/* Voicemail */}
                    <div>
                      <label className="block text-sm font-medium mb-1.5">
                        Voicemail Message (optional)
                      </label>
                      <p className="text-xs text-muted-foreground mb-2">
                        If voicemail is detected, the agent leaves this message. Leave blank to hang
                        up.
                      </p>
                      <textarea
                        rows={2}
                        className="w-full rounded-lg border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none"
                        value={form.voicemailMessage || ''}
                        onChange={(e) => updateField('voicemailMessage', e.target.value)}
                        placeholder="Hi, this is Sarah from Acme Plumbing. We tried reaching you — please call us back at..."
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-3 border-t">
                      <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={createAgent.isPending || updateAgentMut.isPending}
                      >
                        {createAgent.isPending || updateAgentMut.isPending
                          ? 'Saving...'
                          : editAgent
                            ? 'Save Changes'
                            : 'Create Agent'}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setDeleteConfirm(null)}
          >
            <div
              className="bg-background border rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <FiTrash2 className="h-6 w-6 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-center mb-2">Delete Agent</h3>
              <p className="text-sm text-muted-foreground text-center mb-6">
                Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? This will
                also remove it from the voice platform. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setDeleteConfirm(null)}
                >
                  Cancel
                </Button>
                <button
                  className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                  onClick={handleDelete}
                  disabled={deleteAgent.isPending}
                >
                  {deleteAgent.isPending ? 'Deleting...' : 'Delete Agent'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}

// ─── Voice Picker Component ──────────────────────────────────────────

function VoicePicker({
  selectedVoiceId,
  onSelect,
  onNext,
}: {
  selectedVoiceId: string;
  onSelect: (voice: AiVoice) => void;
  onNext: () => void;
}) {
  const { data: voices, isLoading } = useVoices();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const togglePlay = useCallback(
    (voiceId: string, previewUrl: string) => {
      if (playingId === voiceId) {
        audioRef.current?.pause();
        setPlayingId(null);
        return;
      }

      audioRef.current?.pause();
      const audio = new Audio(previewUrl);
      audio.onended = () => setPlayingId(null);
      audio.onerror = () => setPlayingId(null);
      audio.play().catch(() => setPlayingId(null));
      audioRef.current = audio;
      setPlayingId(voiceId);
    },
    [playingId]
  );

  const filtered = (voices || []).filter((v) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      v.name.toLowerCase().includes(q) ||
      (v.labels?.accent || '').toLowerCase().includes(q) ||
      (v.labels?.gender || '').toLowerCase().includes(q) ||
      (v.description || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-6 py-3 border-b">
        <input
          type="text"
          className="w-full rounded-lg border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          placeholder="Search voices by name, accent, or gender..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Voice List */}
      <div className="flex-1 overflow-y-auto px-6 py-3" style={{ maxHeight: '400px' }}>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse h-16 bg-muted rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            {search ? 'No voices match your search' : 'No voices available'}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((v) => {
              const isSelected = selectedVoiceId === v.voiceId;
              const isPlaying = playingId === v.voiceId;

              return (
                <div
                  key={v.voiceId}
                  className={`flex items-center gap-4 px-4 py-3 rounded-lg border cursor-pointer transition-all duration-150 ${
                    isSelected
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-transparent hover:border-border hover:bg-muted/50'
                  }`}
                  onClick={() => onSelect(v)}
                >
                  {/* Play Button */}
                  <button
                    type="button"
                    className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full transition-all duration-150 ${
                      isPlaying
                        ? 'bg-primary text-primary-foreground shadow-md'
                        : 'bg-muted hover:bg-primary/20 hover:text-[var(--foreground)]'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (v.previewUrl) togglePlay(v.voiceId, v.previewUrl);
                    }}
                    title={isPlaying ? 'Stop preview' : 'Play preview'}
                    disabled={!v.previewUrl}
                  >
                    {isPlaying ? (
                      <FiStopCircle className="h-4.5 w-4.5" />
                    ) : (
                      <FiVolume2 className="h-4.5 w-4.5" />
                    )}
                  </button>

                  {/* Voice Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{v.name}</span>
                      {v.labels?.gender && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted font-medium text-muted-foreground uppercase tracking-wide">
                          {v.labels.gender}
                        </span>
                      )}
                      {v.labels?.accent && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted font-medium text-muted-foreground capitalize">
                          {v.labels.accent}
                        </span>
                      )}
                      {v.labels?.age && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted font-medium text-muted-foreground capitalize">
                          {v.labels.age}
                        </span>
                      )}
                    </div>
                    {v.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {v.description}
                      </p>
                    )}
                  </div>

                  {/* Selected Check */}
                  {isSelected && (
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <FiCheck className="h-3.5 w-3.5 text-primary-foreground" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {filtered.length} voice{filtered.length !== 1 ? 's' : ''} available
          {selectedVoiceId && ' — voice selected'}
        </p>
        <Button onClick={onNext} disabled={!selectedVoiceId}>
          Continue
        </Button>
      </div>
    </div>
  );
}

// ─── Prompt Builder Component ────────────────────────────────────────

const AGENT_TYPES = [
  {
    key: 'receptionist',
    label: 'Receptionist / Front Desk',
    icon: '📞',
    desc: 'Answer calls, book appointments, route inquiries',
  },
  {
    key: 'sales',
    label: 'Sales / Outbound',
    icon: '💼',
    desc: 'Qualify leads, pitch services, book meetings',
  },
  {
    key: 'support',
    label: 'Customer Support',
    icon: '🛠',
    desc: 'Resolve issues, troubleshoot, escalate',
  },
  {
    key: 'survey',
    label: 'Survey / Feedback',
    icon: '📋',
    desc: 'Ask questions, collect data, gather opinions',
  },
  {
    key: 'reminder',
    label: 'Appointment Reminder',
    icon: '⏰',
    desc: 'Confirm appointments, offer rescheduling',
  },
  {
    key: 'collector',
    label: 'Payment Collection',
    icon: '💳',
    desc: 'Payment reminders, collect card info, arrange plans',
  },
];

function PromptBuilder({
  value,
  agentName,
  onChange,
  onFirstMessageGenerated,
}: {
  value: string;
  agentName: string;
  onChange: (prompt: string) => void;
  onFirstMessageGenerated: (msg: string) => void;
}) {
  const [mode, setMode] = useState<'generate' | 'manual'>(value ? 'manual' : 'generate');
  const [selectedType, setSelectedType] = useState('');
  const [biz, setBiz] = useState({ name: '', industry: '', services: '', hours: '' });
  const [goal, setGoal] = useState('');
  const [tone, setTone] = useState<'friendly' | 'professional' | 'casual'>('friendly');
  const [extras, setExtras] = useState({ objections: '', faq: '', qualification: '' });

  const generatePrompt = useCallback(() => {
    const rawName = agentName || 'Alex';
    const n = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    const c = biz.name.charAt(0).toUpperCase() + biz.name.slice(1) || 'the company';
    const ind = biz.industry || 'services';
    const toneDesc =
      tone === 'friendly'
        ? 'warm, approachable, and genuinely helpful'
        : tone === 'professional'
          ? 'polished, confident, and courteous'
          : 'relaxed, easygoing, and down-to-earth';

    const sections: string[] = [];
    let firstMsg = '';

    // ── PERSONALITY ──
    const roleMap: Record<string, string> = {
      receptionist: 'front desk receptionist',
      sales: 'sales representative',
      support: 'customer support specialist',
      survey: 'research associate',
      reminder: 'scheduling coordinator',
      collector: 'accounts specialist',
    };
    sections.push(
      `# Personality\n\nYou are ${n}, a ${toneDesc} ${roleMap[selectedType] || 'assistant'} at ${c}. You're the kind of person people enjoy talking to on the phone — ${tone === 'casual' ? "you sound like you're chatting with a friend" : tone === 'friendly' ? 'you make people feel heard and taken care of' : "you're efficient but never cold"}. You never sound scripted or robotic.`
    );

    // ── ENVIRONMENT ──
    let env = `# Environment\n\nYou work at ${c}`;
    if (biz.industry) env += `, a ${ind} company`;
    env += '.';
    if (biz.services) env += ` ${biz.services}`;
    if (biz.hours) env += `\nBusiness hours: ${biz.hours}.`;
    env += `\nIf someone asks something you don't know, say: "Let me find that out and get back to you" — never make up information.`;
    sections.push(env);

    // ── TONE (with examples) ──
    let toneSection = `# Tone\n\n`;
    switch (tone) {
      case 'friendly':
        toneSection += `- Warm and natural: "Hey! Thanks for calling ${c}"\n- Encouraging: "Yeah absolutely, we can totally help with that"\n- Empathetic: "Oh I hear you, that's frustrating. Let's get it sorted out"\n- When confirming: "Perfect, so I've got [detail] — sound right?"\n- When ending: "You're all set! Have a great rest of your day"`;
        break;
      case 'professional':
        toneSection += `- Confident and clear: "Good ${new Date().getHours() < 12 ? 'morning' : 'afternoon'}, ${c}, this is ${n}"\n- Efficient: "Sure, I can help with that. Let me pull that up"\n- Reassuring: "You're in good hands, let me take care of this"\n- When confirming: "Just to confirm — [detail]. Is that correct?"\n- When ending: "Thank you for calling ${c}. Have a great day"`;
        break;
      case 'casual':
        toneSection += `- Relaxed opener: "Hey! What's going on?"\n- Natural reactions: "Oh yeah, for sure", "No worries at all", "Gotcha"\n- Relatable: "Yeah that happens sometimes, super easy fix though"\n- When confirming: "Cool, so [detail] — we good?"\n- When ending: "Alright, you're all good! Take it easy"`;
        break;
    }
    sections.push(toneSection);

    // ── GOAL / CALL FLOW ──
    switch (selectedType) {
      case 'receptionist':
        sections.push(
          `# Goal\n\nOn every call:\n1. Greet warmly. If they give their name, use it.\n2. Identify what they need: appointment, question, or to speak with someone.\n3. **Booking**: Collect name, phone number, preferred date/time, and service needed. Confirm everything back before ending.\n4. **Questions**: Answer from your knowledge. If unsure: "Let me find that out and have someone call you right back."\n5. **Transfer**: "Let me connect you with the right person. One moment." (The system handles the transfer.)\n6. **Always confirm** before hanging up: "So that's [name], [date] at [time] for [service] — did I get everything right?"\n\nCapture: caller name, phone number, reason for calling, and any appointment details.`
        );
        firstMsg = `Hi, thanks for calling ${c}! This is ${n}. How can I help you?`;
        break;

      case 'sales':
        sections.push(
          `# Goal\n\n${goal || `Qualify the lead and book a meeting/demo.`}\n\nCall flow:\n1. Quick intro — one sentence, then ask a question immediately.\n2. Discovery: "What's your biggest challenge with [${ind}] right now?"\n3. Listen. Ask 1-2 follow-up questions based on their answer.\n4. Once you understand their problem, briefly explain how ${c} helps (2 sentences max).\n5. Close: "Would it make sense to set up a quick 15-minute call with our team to walk you through it?"\n6. If yes: collect name, email, preferred time.\n7. If no: "Totally fair. Mind if I text you a quick summary so you have it when the timing's right?"\n8. If hostile/annoyed: "No worries at all, sorry to bother you. Have a great day!" — end immediately.${extras.qualification ? `\n\nA qualified lead: ${extras.qualification}` : ''}${extras.objections ? `\n\nObjection handling:\n${extras.objections}` : ''}`
        );
        firstMsg = `Hey! This is ${n} from ${c}. We help ${ind} companies with ${goal || 'getting better results'}. Got 30 seconds?`;
        break;

      case 'support':
        sections.push(
          `# Goal\n\nResolve the customer's issue or escalate with full context.\n\nCall flow:\n1. "What seems to be going on?" — let them explain fully.\n2. Confirm: "OK, so [restate the issue]. Is that right?"\n3. Troubleshoot one step at a time. After each step: "Did that work?"\n4. If resolved: "Awesome, you should be all set now. Anything else?"\n5. If stuck: "This one needs a specialist. I'm going to connect you with someone who can dig deeper. One moment."\n\nWhen escalating, pass along: customer name, issue description, and what you already tried.${extras.faq ? `\n\nKnown issues and fixes:\n${extras.faq}` : ''}`
        );
        firstMsg = `Hi, this is ${n} with ${c} support. What can I help you with?`;
        break;

      case 'survey':
        sections.push(
          `# Goal\n\nComplete a brief survey. Be respectful of their time.\n\nCall flow:\n1. Explain: "It's just 3 quick questions, takes about 2 minutes."\n2. If they agree, ask questions ONE at a time.\n3. After each answer: "Got it, thank you." Then ask the next.\n4. If they want to stop: "No problem at all, really appreciate your time!"\n5. When done: "That's everything! Thanks so much for the feedback."\n\n${goal ? `Questions to ask:\n${goal}` : 'Ask: How would they rate the service (1-10)? What could be improved? Would they recommend to a friend?'}`
        );
        firstMsg = `Hi! This is ${n} from ${c}. We're gathering some quick feedback to improve our service — would you have about 2 minutes?`;
        break;

      case 'reminder':
        sections.push(
          `# Goal\n\nConfirm the appointment or reschedule if needed. Keep it short.\n\nCall flow:\n1. "Hi, I'm calling to confirm your [appointment/visit] at ${c}."\n2. State the date, time, and service.\n3. "Does that still work for you?"\n4. If yes: "Perfect, we'll see you then!"\n5. If no: "No problem. When would work better?" — collect new date/time and confirm.\n6. End quickly. Don't keep them on the phone.`
        );
        firstMsg = `Hi! This is ${n} from ${c}. I'm calling to confirm your upcoming appointment — is now a good time?`;
        break;

      case 'collector':
        sections.push(
          `# Goal\n\nCollect payment or arrange a payment plan. Stay firm but respectful.\n\nCall flow:\n1. "I'm calling about your account with ${c}."\n2. Reference the balance amount if available.\n3. "Are you able to take care of this today?"\n4. If yes: guide them through the payment process.\n5. If no: "I understand. Would it help to break this into smaller payments?"\n6. If they dispute: "I hear you. Let me note that and have our billing team review it. They'll reach out within 48 hours."\n7. Never threaten, pressure, or raise your voice.`
        );
        firstMsg = `Hi, this is ${n} from ${c}. I'm reaching out about your account. Do you have a moment?`;
        break;

      default:
        sections.push(`# Goal\n\n${goal || 'Help the caller with whatever they need.'}`);
        firstMsg = `Hi! This is ${n} from ${c}. How can I help you?`;
    }

    // ── GUARDRAILS ──
    let guardrails = `# Guardrails\n\n- Never share internal company information, pricing formulas, or employee personal details.\n- If someone asks something outside your scope, say "I'll need to check on that and get back to you" — never guess.\n- If someone is abusive or threatening, calmly say "I'm not able to help with that. Have a good day." and end the call.`;
    if (selectedType === 'collector') {
      guardrails += `\n- Never threaten legal action or make claims about credit reporting.\n- Follow all FDCPA guidelines — identify yourself, state the purpose, respect their right to dispute.`;
    }
    if (selectedType === 'support') {
      guardrails += `\n- Never ask for or store passwords. Walk them through self-service password reset.\n- If the issue sounds like a security incident, escalate immediately.`;
    }
    sections.push(guardrails);

    // ── VOICE & DELIVERY (the critical phone rules) ──
    sections.push(
      `# Voice & Delivery (CRITICAL)\n\n- **Max 2 sentences** per response. Then STOP and let them talk.\n- **One question at a time.** Never stack questions.\n- **Natural fillers**: "Sure thing", "Got it", "Yeah absolutely", "Mm-hmm", "Right right"\n- **Banned phrases**: "I apologize", "I understand your concern", "Thank you for your patience", "As an AI" — these instantly sound robotic.\n- **Interruptions**: If they start talking, STOP immediately and listen.\n- **Phone numbers**: Read in groups — "two one six... four two eight... one nine nine seven"\n- **Pauses are OK**: Don't rush to fill silence. Let them think.\n- **Energy**: Natural and steady. Not overly enthusiastic. Not monotone.\n- **Ending**: "Have a great rest of your day!" or "Take care!" — keep it short.`
    );

    onChange(sections.join('\n\n'));
    onFirstMessageGenerated(firstMsg);
    setMode('manual');
  }, [selectedType, biz, goal, tone, extras, agentName, onChange, onFirstMessageGenerated]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium">Agent Script *</label>
        <div className="flex rounded-lg border overflow-hidden">
          <button
            type="button"
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${mode === 'generate' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:text-foreground'}`}
            onClick={() => setMode('generate')}
          >
            <FiZap className="inline mr-1 h-3 w-3" />
            Generate
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 text-xs font-medium border-l transition-colors ${mode === 'manual' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:text-foreground'}`}
            onClick={() => setMode('manual')}
          >
            Write manually
          </button>
        </div>
      </div>

      {mode === 'generate' ? (
        <div className="space-y-4 p-5 rounded-lg border bg-muted/20">
          {/* Step 1: Agent Type */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              What will this agent do?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {AGENT_TYPES.map(({ key, label, icon, desc }) => (
                <button
                  key={key}
                  type="button"
                  className={`flex items-start gap-3 text-left p-3 rounded-lg border transition-all ${
                    selectedType === key
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border hover:border-primary/30'
                  }`}
                  onClick={() => setSelectedType(key)}
                >
                  <span className="text-lg mt-0.5">{icon}</span>
                  <div>
                    <div className="text-sm font-medium">{label}</div>
                    <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                      {desc}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {selectedType && (
            <>
              {/* Step 2: Business Info */}
              <div className="pt-2 border-t">
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  About the business
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">
                      Company name *
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      value={biz.name}
                      onChange={(e) => setBiz((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Acme Plumbing"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Industry *</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      value={biz.industry}
                      onChange={(e) => setBiz((p) => ({ ...p, industry: e.target.value }))}
                      placeholder="plumbing, dental, SaaS"
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-xs text-muted-foreground mb-1">
                    What does the company do? (services, products — helps the agent answer
                    questions)
                  </label>
                  <textarea
                    rows={2}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    value={biz.services}
                    onChange={(e) => setBiz((p) => ({ ...p, services: e.target.value }))}
                    placeholder="We provide 24/7 emergency plumbing, drain cleaning, water heater installation..."
                  />
                </div>
                <div className="mt-3">
                  <label className="block text-xs text-muted-foreground mb-1">
                    Business hours (optional)
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    value={biz.hours}
                    onChange={(e) => setBiz((p) => ({ ...p, hours: e.target.value }))}
                    placeholder="Mon-Fri 8am-6pm, Sat 9am-2pm"
                  />
                </div>
              </div>

              {/* Step 3: Goal + Tone */}
              <div className="pt-2 border-t">
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Goal & tone
                </label>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">
                    {selectedType === 'sales'
                      ? 'What should the agent try to achieve?'
                      : selectedType === 'survey'
                        ? 'What questions should be asked?'
                        : 'Primary goal (optional)'}
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    placeholder={
                      selectedType === 'sales'
                        ? 'Book a demo call'
                        : selectedType === 'survey'
                          ? 'Rate satisfaction 1-5, what could improve, would they recommend'
                          : 'Book appointments'
                    }
                  />
                </div>
                <div className="mt-3">
                  <label className="block text-xs text-muted-foreground mb-1.5">
                    Conversation tone
                  </label>
                  <div className="flex gap-2">
                    {[
                      {
                        key: 'friendly' as const,
                        label: 'Friendly & Warm',
                        desc: 'Like a helpful neighbor',
                      },
                      {
                        key: 'professional' as const,
                        label: 'Professional',
                        desc: 'Polished but not stiff',
                      },
                      {
                        key: 'casual' as const,
                        label: 'Casual & Relaxed',
                        desc: 'Like talking to a friend',
                      },
                    ].map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        className={`flex-1 text-left p-2.5 rounded-lg border text-xs transition-all ${tone === t.key ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}
                        onClick={() => setTone(t.key)}
                      >
                        <div className="font-medium">{t.label}</div>
                        <div className="text-muted-foreground mt-0.5">{t.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Step 4: Advanced (optional, collapsed by type) */}
              {(selectedType === 'sales' || selectedType === 'support') && (
                <div className="pt-2 border-t">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Advanced (optional — makes the agent smarter)
                  </label>
                  {selectedType === 'sales' && (
                    <>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">
                          What makes a qualified lead?
                        </label>
                        <input
                          type="text"
                          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                          value={extras.qualification}
                          onChange={(e) =>
                            setExtras((p) => ({ ...p, qualification: e.target.value }))
                          }
                          placeholder="Has budget, decision maker, needs the service within 30 days"
                        />
                      </div>
                      <div className="mt-3">
                        <label className="block text-xs text-muted-foreground mb-1">
                          Common objections & how to handle them
                        </label>
                        <textarea
                          rows={2}
                          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                          value={extras.objections}
                          onChange={(e) => setExtras((p) => ({ ...p, objections: e.target.value }))}
                          placeholder={
                            '"Too expensive" → "I totally get that. Most of our clients felt the same way until they saw the ROI..."'
                          }
                        />
                      </div>
                    </>
                  )}
                  {selectedType === 'support' && (
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">
                        Common issues & solutions (the agent will use these)
                      </label>
                      <textarea
                        rows={3}
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                        value={extras.faq}
                        onChange={(e) => setExtras((p) => ({ ...p, faq: e.target.value }))}
                        placeholder={
                          "Can't log in → Ask them to clear browser cache and try again\nPayment failed → Check if card is expired, try a different card"
                        }
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Generate */}
              <Button
                type="button"
                onClick={generatePrompt}
                disabled={!biz.name || !biz.industry}
                className="w-full"
              >
                <FiZap className="mr-2 h-4 w-4" />
                Generate Professional Script
              </Button>
              {(!biz.name || !biz.industry) && (
                <p className="text-[11px] text-muted-foreground text-center">
                  Fill in company name and industry to generate
                </p>
              )}
            </>
          )}
        </div>
      ) : (
        <div>
          <p className="text-xs text-muted-foreground mb-2">
            This is what the AI follows during every call. Edit freely — or switch to Generate for a
            template.
          </p>
          <textarea
            required
            rows={10}
            className="w-full rounded-lg border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-y font-mono text-xs leading-relaxed"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={
              'You are Sarah, a friendly receptionist at Acme Plumbing.\n\nAbout Acme Plumbing:\nWe provide 24/7 emergency plumbing, drain cleaning, and water heater installation.\nBusiness hours: Mon-Fri 8am-6pm, Sat 9am-2pm\n\nYour job on every call:\n1. Greet warmly\n2. Find out what they need\n3. Book appointment or take message\n\nPhone call rules:\n- NEVER more than 2 sentences at a time\n- Ask ONE question, then wait\n- Sound like a real person, not a script'
            }
          />
          {value && (
            <button
              type="button"
              className="mt-2 text-xs text-[var(--foreground)] hover:underline"
              onClick={() => setMode('generate')}
            >
              <FiZap className="inline mr-1 h-3 w-3" />
              Regenerate from template
            </button>
          )}
        </div>
      )}
    </div>
  );
}
