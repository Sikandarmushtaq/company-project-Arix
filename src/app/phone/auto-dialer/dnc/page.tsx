'use client';

/**
 * DNC (Do Not Call) List Management Page
 *
 * Flush, on-theme layout matching the reskinned phone pages.
 *
 * @module app/phone/auto-dialer/dnc/page
 */

import React, { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { FiArrowLeft, FiPlus, FiTrash2, FiShield, FiSearch, FiX } from 'react-icons/fi';
import { Button, Input, Pagination } from '@/components/ui';
import { PageTransition } from '@/components/phone';
import { useDncList, useAddDnc, useRemoveDnc } from '@/lib/hooks/useCampaigns';
import { usePagination } from '@/lib/hooks';

export default function DncPage() {
  const pagination = usePagination({ initialPageSize: 50 });
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newNumbers, setNewNumbers] = useState('');
  const [newReason, setNewReason] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      pagination.goToPage(1);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pagination.goToPage is stable
  }, [search]);

  const { data, isLoading } = useDncList({
    page: pagination.page,
    limit: pagination.pageSize,
    search: debouncedSearch || undefined,
  });
  const addDnc = useAddDnc();
  const removeDnc = useRemoveDnc();

  const entries = data?.entries || [];

  useEffect(() => {
    if (data?.total !== undefined) pagination.setTotalItems(data.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pagination.setTotalItems is stable
  }, [data?.total]);

  const handleAdd = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const numbers = newNumbers
        .split(/[\n,]+/)
        .map((n) => n.trim())
        .filter(Boolean);
      if (numbers.length === 0) return;
      await addDnc.mutateAsync({ phoneNumbers: numbers, reason: newReason || undefined });
      setNewNumbers('');
      setNewReason('');
      setShowAdd(false);
    },
    [newNumbers, newReason, addDnc]
  );

  const handleRemoveSelected = useCallback(async () => {
    if (selected.size === 0) return;
    if (!confirm(`Remove ${selected.size} number(s) from DNC list?`)) return;
    await removeDnc.mutateAsync(Array.from(selected));
    setSelected(new Set());
  }, [selected, removeDnc]);

  const toggleSelect = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allSelected = entries.length > 0 && entries.every((en) => selected.has(en.id));

  return (
    <PageTransition className="absolute inset-0 overflow-hidden">
      <div className="flex h-full min-h-0 flex-col bg-[var(--card)]">
        {/* Header region */}
        <div className="shrink-0 border-b border-[var(--border)]">
          <div className="flex items-center justify-between gap-3 px-5 pt-3.5 pb-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <Link
                href="/phone/auto-dialer"
                aria-label="Back to campaigns"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
              >
                <FiArrowLeft className="h-4 w-4" />
              </Link>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--primary-50)] text-[var(--foreground)] dark:bg-[var(--primary-900)]/30">
                <FiShield className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-black text-[var(--foreground)]">
                  Do Not Call List
                </h1>
                <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">
                  {data?.total !== undefined
                    ? `${data.total.toLocaleString()} blocked number${data.total === 1 ? '' : 's'}`
                    : 'Numbers blocked from AI campaigns'}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {selected.size > 0 && (
                <Button variant="secondary" size="sm" onClick={handleRemoveSelected}>
                  <FiTrash2 className="mr-2 h-4 w-4 text-red-500" />
                  Remove {selected.size}
                </Button>
              )}
              <Button size="sm" onClick={() => setShowAdd(true)}>
                <FiPlus className="mr-2 h-4 w-4" />
                Add Numbers
              </Button>
            </div>
          </div>

          {/* search */}
          <div className="border-t border-[var(--border)] px-5 py-2.5">
            <div className="flex h-10 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 text-[var(--muted-foreground)] transition-colors focus-within:border-[var(--primary-500)]">
              <FiSearch className="h-4 w-4 shrink-0" />
              <input
                type="text"
                placeholder="Search phone numbers…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search DNC numbers"
                className="nx-search-input w-full bg-transparent text-[13.5px] text-[var(--foreground)] outline-none"
              />
              {search && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setSearch('')}
                  title="Clear search"
                  aria-label="Clear search"
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                >
                  <FiX className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Scroll area */}
        <div className="min-h-0 flex-1 overflow-auto">
          {isLoading && entries.length === 0 ? (
            <div className="space-y-2 px-5 py-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-[var(--muted)]/30" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="grid place-items-center px-6 py-20 text-center">
              <div>
                <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[var(--muted)]">
                  <FiShield className="h-7 w-7 text-[var(--muted-foreground)]" />
                </div>
                <h3 className="mb-1 text-base font-bold text-[var(--foreground)]">
                  {debouncedSearch ? 'No matching numbers' : 'DNC list is empty'}
                </h3>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Add numbers that should never be called by AI campaigns.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-[var(--card)]/95 backdrop-blur-sm">
                    <tr className="border-b border-[var(--border)] text-left text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                      <th className="w-10 py-2 pl-5 pr-2">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={(e) =>
                            e.target.checked
                              ? setSelected(new Set(entries.map((en) => en.id)))
                              : setSelected(new Set())
                          }
                          className="rounded border-[var(--border)]"
                          aria-label="Select all"
                        />
                      </th>
                      <th className="px-3 py-2">Phone Number</th>
                      <th className="px-3 py-2">Reason</th>
                      <th className="px-3 py-2">Source</th>
                      <th className="px-3 py-2 pr-5">Added</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr
                        key={entry.id}
                        className="border-b border-[var(--border)]/60 transition-colors hover:bg-[var(--muted)]/40"
                      >
                        <td className="py-2.5 pl-5 pr-2">
                          <input
                            type="checkbox"
                            checked={selected.has(entry.id)}
                            onChange={() => toggleSelect(entry.id)}
                            className="rounded border-[var(--border)]"
                            aria-label={`Select ${entry.phoneNumber}`}
                          />
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[var(--foreground)]">
                          {entry.phoneNumber}
                        </td>
                        <td className="px-3 py-2.5 text-[var(--muted-foreground)]">
                          {entry.reason || '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="rounded bg-[var(--muted)] px-2 py-0.5 text-[11px] font-bold text-[var(--muted-foreground)]">
                            {entry.source}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 pr-5 text-[var(--muted-foreground)]">
                          {new Date(entry.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination — inside the scroll */}
              <div className="border-t border-[var(--border)] px-5 py-3">
                <Pagination
                  page={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.totalItems}
                  pageSize={pagination.pageSize}
                  hasNextPage={pagination.hasNextPage}
                  hasPreviousPage={pagination.hasPreviousPage}
                  pageRange={pagination.pageRange}
                  onPageChange={pagination.goToPage}
                  showTotalItems={true}
                />
              </div>
            </>
          )}
        </div>

        {/* Add Numbers Modal */}
        {showAdd && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => setShowAdd(false)}
          >
            <div
              className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="mb-4 text-lg font-bold text-[var(--foreground)]">Add to DNC List</h2>
              <form onSubmit={handleAdd} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-bold text-[var(--foreground)]">
                    Phone Numbers{' '}
                    <span className="font-normal text-[var(--muted-foreground)]">
                      (one per line or comma-separated)
                    </span>
                  </label>
                  <textarea
                    required
                    rows={5}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 font-mono text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary-500)]"
                    value={newNumbers}
                    onChange={(e) => setNewNumbers(e.target.value)}
                    placeholder={'12164281997\n13125551234\n14155559999'}
                  />
                </div>
                <Input
                  label="Reason (optional)"
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  placeholder="Customer requested no calls"
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="secondary" onClick={() => setShowAdd(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={addDnc.isPending}>
                    Add to DNC
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
