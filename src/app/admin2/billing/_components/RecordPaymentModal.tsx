'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { fmtPkr, fmtDual } from '@/lib/utils/currency';
import { FiImage, FiX } from 'react-icons/fi';
import { adminBillingApi } from '@/lib/api/services/admin-billing.api';
import { Modal, Btn, Field, fieldInput } from '../../_components/ui';

import type { OrgInvoice } from '@/lib/api/services/admin-billing.api';

const fmtUsd = (cents: number): string =>
  `$${((cents ?? 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function RecordPaymentModal({
  orgId,
  balanceCents,
  amountDueCents,
  paidSoFarCents,
  periodMonth,
  invoiceId,
  invoices,
  onClose,
  onSaved,
}: {
  orgId: number;
  /** Remaining balance for the cycle (the default amount). */
  balanceCents: number;
  /** Full charge for the cycle (for the "paid X of Y" line + Full/Half fills). */
  amountDueCents: number;
  /** Already collected this cycle. */
  paidSoFarCents: number;
  /** Service month this payment defaults to (YYYY-MM). */
  periodMonth?: string;
  invoiceId?: number;
  invoices?: OrgInvoice[];
  onClose: () => void;
  onSaved: () => void;
}) {
  // If an invoiceId was passed, find it; otherwise if there are unpaid/partially paid statements with open balances, pick the most recent one.
  const initialInvoice =
    (invoiceId ? invoices?.find((i) => i.id === invoiceId) : null) ||
    invoices?.find((i) => (i.status === 'unpaid' || i.status === 'partially_paid') && i.balanceCents > 0) ||
    null;

  const fxQuery = useQuery({
    queryKey: ['admin2', 'exchange-rate-current'],
    queryFn: () => adminBillingApi.getCurrentExchangeRate('USD', 'PKR'),
    staleTime: 60_000,
  });

  const activeOperationalRate = fxQuery.data?.operational?.rate
    ? Number(fxQuery.data.operational.rate).toFixed(2)
    : '278.50';

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(initialInvoice?.id ?? invoiceId ?? null);
  const initialBalanceCents = initialInvoice ? initialInvoice.balanceCents : balanceCents;
  const [amount, setAmount] = useState(((initialBalanceCents ?? 0) / 100).toFixed(2));
  const [currency, setCurrency] = useState('PKR');
  const [exchangeRate, setExchangeRate] = useState('278.50');
  const [pkrAmount, setPkrAmount] = useState(() => {
    const usd = parseFloat(amount) || 0;
    return (usd * 278.5).toFixed(0);
  });

  useEffect(() => {
    if (fxQuery.data?.operational?.rate) {
      const liveRate = Number(fxQuery.data.operational.rate).toFixed(2);
      setExchangeRate(liveRate);
      const usd = parseFloat(amount) || 0;
      setPkrAmount((usd * parseFloat(liveRate)).toFixed(0));
    }
  }, [fxQuery.data?.operational?.rate]);
  const [month, setMonth] = useState(
    initialInvoice ? initialInvoice.cycleStart.slice(0, 7) : periodMonth || new Date().toISOString().slice(0, 7)
  );
  const [actualPaymentDate, setActualPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [bankName, setBankName] = useState('');
  const [senderName, setSenderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [confirmOver, setConfirmOver] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (receiptPreview) URL.revokeObjectURL(receiptPreview);
    };
  }, [receiptPreview]);

  const updateUsd = (newUsd: string) => {
    setAmount(newUsd);
    setConfirmOver(false);
    const usdVal = parseFloat(newUsd);
    const rateVal = parseFloat(exchangeRate) || 280;
    if (!Number.isNaN(usdVal) && usdVal > 0) {
      setPkrAmount((usdVal * rateVal).toFixed(0));
    }
  };

  const bankValid = senderName.trim().length > 0 && bankName.trim().length > 0;

  const save = useMutation({
    mutationFn: () => {
      const cents = Math.round(parseFloat(amount) * 100);
      const isPkr = currency === 'PKR';
      const usdVal = parseFloat(amount) || 0;
      const rateVal = isPkr ? parseFloat(exchangeRate) || 280 : null;
      const pkrVal = isPkr ? parseFloat(pkrAmount) || (usdVal * (rateVal || 280)) : null;
      const pkrCents = pkrVal != null && pkrVal > 0 ? Math.round(pkrVal * 100) : null;

      return adminBillingApi.recordOrgPayment(orgId, {
        invoiceId: selectedInvoiceId,
        actualPaymentDate,
        amountCents: cents,
        currency,
        exchangeRate: rateVal,
        originalAmountCents: pkrCents,
        period: month ? `${month}-01` : null,
        method: 'bank_transfer',
        bankName: bankName.trim(),
        senderName: senderName.trim(),
        accountNumber: accountNumber.trim() || null,
        reference: reference.trim() || null,
        note: note.trim() || null,
        receiptFile,
      });
    },
    onSuccess: onSaved,
  });

  const currentInvoice = selectedInvoiceId
    ? invoices?.find((i) => i.id === selectedInvoiceId)
    : null;
  const effectiveDueCents = currentInvoice ? currentInvoice.totalDueCents : amountDueCents;
  const effectivePaidCents = currentInvoice ? currentInvoice.paidCents : paidSoFarCents;
  const effectiveBalanceCents = currentInvoice ? currentInvoice.balanceCents : balanceCents;

  const enteredCents = Math.round(parseFloat(amount) * 100);
  const amountValid = Number.isFinite(parseFloat(amount)) && parseFloat(amount) > 0;
  const isOver = amountValid && effectiveBalanceCents > 0 && enteredCents > effectiveBalanceCents;
  const setFill = (cents: number) => {
    updateUsd((cents / 100).toFixed(2));
  };

  return (
    <Modal title="Record payment" subtitle="Log an offline payment (bank transfer)" onClose={onClose}>
      <div className="space-y-4">
        {/* Where this cycle / invoice stands, so a partial payment is recorded knowingly. */}
        {effectiveDueCents > 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-950/40">
            <span className="font-semibold tabular-nums">{fmtUsd(effectivePaidCents)}</span>
            <span className="text-slate-500"> paid of </span>
            <span className="font-semibold tabular-nums">{fmtUsd(effectiveDueCents)}</span>
            <span className="text-slate-500"> · </span>
            <span className={`font-semibold tabular-nums ${effectiveBalanceCents > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {fmtUsd(effectiveBalanceCents)} left
            </span>
            {currentInvoice && (
              <span className="ml-2 font-mono text-xs text-slate-400">
                ({currentInvoice.invoiceNumber})
              </span>
            )}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Field label={currency === 'PKR' ? 'USD Credited ($)' : 'Amount (USD)'}>
              <input className={fieldInput} value={amount} onChange={(e) => updateUsd(e.target.value)} inputMode="decimal" />
              {effectiveBalanceCents > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Btn size="sm" onClick={() => setFill(effectiveBalanceCents)}>Full balance ({fmtUsd(effectiveBalanceCents)})</Btn>
                  <Btn size="sm" onClick={() => setFill(Math.round(effectiveBalanceCents / 2))}>Half ({fmtUsd(Math.round(effectiveBalanceCents / 2))})</Btn>
                </div>
              )}
            </Field>
          </div>
          <div>
            <Field label="Currency">
              <select
                className={fieldInput}
                value={currency}
                onChange={(e) => {
                  const newCurr = e.target.value;
                  setCurrency(newCurr);
                  if (newCurr === 'PKR') {
                    const usdVal = parseFloat(amount) || 0;
                    const rateVal = parseFloat(exchangeRate) || 280;
                    setPkrAmount((usdVal * rateVal).toFixed(0));
                  }
                }}
              >
                <option value="USD">USD ($)</option>
                <option value="PKR">PKR (Rs)</option>
              </select>
            </Field>
          </div>
        </div>

        {currency === 'PKR' && (
          <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 text-xs dark:border-emerald-950/60 dark:bg-emerald-950/20">
            <div className="flex items-center justify-between font-bold text-emerald-900 dark:text-emerald-200">
              <span>Pakistani Rupee (PKR) Conversion</span>
              <span className="text-[11px] font-normal text-emerald-700 dark:text-emerald-400">Auto-calculated</span>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <Field label="PKR Received (Rs)" hint="Rupees paid into bank">
                  <input
                    className={fieldInput}
                    value={pkrAmount}
                    onChange={(e) => {
                      const newPkr = e.target.value;
                      setPkrAmount(newPkr);
                      const pkrVal = parseFloat(newPkr);
                      const usdVal = parseFloat(amount);
                      if (!Number.isNaN(pkrVal) && !Number.isNaN(usdVal) && usdVal > 0) {
                        setExchangeRate((pkrVal / usdVal).toFixed(2));
                      }
                    }}
                    inputMode="decimal"
                    placeholder="e.g. 25000"
                  />
                </Field>
              </div>
              <div>
                <Field label="Exchange Rate (PKR/USD)" hint="Current market / bank rate">
                  <input
                    className={fieldInput}
                    value={exchangeRate}
                    onChange={(e) => {
                      const newRate = e.target.value;
                      setExchangeRate(newRate);
                      const rateVal = parseFloat(newRate);
                      const usdVal = parseFloat(amount);
                      if (!Number.isNaN(rateVal) && !Number.isNaN(usdVal) && usdVal > 0) {
                        setPkrAmount((usdVal * rateVal).toFixed(0));
                      }
                    }}
                    inputMode="decimal"
                    placeholder="280.00"
                  />
                </Field>
              </div>
            </div>
          </div>
        )}

        {invoices && invoices.length > 0 && (
          <div>
            <Field label="Target Billing Cycle / Invoice" hint="Select specific statement to reconcile">
              <select
                className={fieldInput}
                value={selectedInvoiceId ?? ''}
                onChange={(e) => {
                  const invId = e.target.value ? Number(e.target.value) : null;
                  setSelectedInvoiceId(invId);
                  if (invId) {
                    const targetInv = invoices.find((i) => i.id === invId);
                    if (targetInv) {
                      setMonth(targetInv.cycleStart.slice(0, 7));
                      updateUsd((targetInv.balanceCents / 100).toFixed(2));
                    }
                  } else {
                    setMonth(periodMonth || new Date().toISOString().slice(0, 7));
                    updateUsd(((balanceCents ?? 0) / 100).toFixed(2));
                  }
                }}
              >
                <option value="">Ad-hoc / Unlinked Payment</option>
                {invoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoiceNumber} — {inv.cycleStart} to {inv.cycleEnd} (Balance: {fmtUsd(inv.balanceCents)})
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Actual Payment Date *" hint="Value date on bank transfer slip">
            <input
              type="date"
              className={fieldInput}
              value={actualPaymentDate}
              onChange={(e) => setActualPaymentDate(e.target.value)}
              required
            />
          </Field>
          <Field label="For month">
            <input type="month" className={fieldInput} value={month} onChange={(e) => setMonth(e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Sender Name *" hint="Account title / payer">
            <input
              className={fieldInput}
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder="e.g. Muhammad Ali / Company"
            />
          </Field>
          <Field label="Bank Name *" hint="Sent from or received in">
            <input
              className={fieldInput}
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="e.g. Meezan Bank, Chase, HBL"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Account / IBAN" hint="Optional account number or IBAN">
            <input
              className={fieldInput}
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="e.g. PK00MEZN... or Account #"
            />
          </Field>
          <Field label="Reference" hint="Bank reference / txn id (optional)">
            <input
              className={fieldInput}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. TXN-12345"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3 items-start">
          <Field label="Note" hint="Internal note (optional)">
            <input
              className={fieldInput}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional notes..."
            />
          </Field>

          {/* Receipt attachment */}
          <Field label="Payment Receipt / Proof" hint="Upload image (JPG, PNG up to 10MB)">
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setReceiptFile(f);
                    if (f.type.startsWith('image/')) {
                      setReceiptPreview(URL.createObjectURL(f));
                    } else {
                      setReceiptPreview(null);
                    }
                  }
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <FiImage className="h-4 w-4" />
                {receiptFile ? 'Change' : 'Attach receipt'}
              </button>
              {receiptFile && (
                <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                  <span className="max-w-[90px] truncate">{receiptFile.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setReceiptFile(null);
                      setReceiptPreview(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="rounded p-0.5 text-slate-400 hover:text-red-500"
                  >
                    <FiX className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
            {receiptPreview && (
              <div className="mt-2 h-16 w-24 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
                <img src={receiptPreview} alt="Receipt preview" className="h-full w-full object-cover" />
              </div>
            )}
          </Field>
        </div>

        {isOver && (
          <label className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            <input
              type="checkbox"
              checked={confirmOver}
              onChange={(e) => setConfirmOver(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              This is more than the {fmtUsd(effectiveBalanceCents)} still owed this cycle — the account
              will show an overpayment (credit) of {fmtUsd(enteredCents - effectiveBalanceCents)}. Confirm
              the amount is correct.
            </span>
          </label>
        )}
        {save.isError && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">
            Could not record payment. Check the amount and try again.
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Btn variant="default" size="sm" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Btn>
          <Btn variant="primary" size="sm" onClick={() => save.mutate()} disabled={!amountValid || !bankValid || save.isPending || (isOver && !confirmOver)}>
            {save.isPending ? 'Saving…' : 'Record payment'}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
