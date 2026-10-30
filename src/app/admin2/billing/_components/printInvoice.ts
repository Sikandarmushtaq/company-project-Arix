import type { ManualPayment, OrgBillingDetail } from '@/lib/api/services/admin-billing.api';

const fmtUsd = (cents: number): string =>
  `$${((cents ?? 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d?: string | null): string => {
  if (!d) return '—';
  try {
    const dt = new Date(d.includes('T') ? d : `${d}T00:00:00`);
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return d;
  }
};

const fmtMonth = (m?: string): string => {
  if (!m) return '—';
  try {
    const [y, mo] = m.split('-').map(Number);
    const dt = new Date(Date.UTC(y, mo - 1, 1));
    return dt.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  } catch {
    return m;
  }
};

export interface PrintInvoiceArgs {
  org: {
    id: number;
    name: string;
    slug?: string;
    contactName?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    createdAt?: string | null;
  };
  detail: OrgBillingDetail;
  docNumber: string;
  targetMonth: string;
  statusBadge: { label: string; bg?: string };
  cyclePayments: ManualPayment[];
  billedCents: number;
  paidCents: number;
  balanceCents: number;
  printedBy: string;
  printedAt: string;
}

export function generateInvoiceHtml(args: PrintInvoiceArgs): string {
  const {
    org,
    detail: d,
    docNumber,
    targetMonth,
    statusBadge,
    cyclePayments,
    billedCents,
    paidCents,
    balanceCents,
    printedBy,
    printedAt,
  } = args;

  const isPaid = balanceCents === 0 && billedCents > 0;
  const statusColor = isPaid ? '#059669' : balanceCents > 0 ? '#d97706' : '#2563eb';
  const statusBg = isPaid ? '#ecfdf5' : balanceCents > 0 ? '#fffbeb' : '#eff6ff';
  const statusBorder = isPaid ? '#a7f3d0' : balanceCents > 0 ? '#fde68a' : '#bfdbfe';

  const planUnitRate =
    d.customPlan && (d.customPlan.seats ?? 1) > 0
      ? fmtUsd(Math.round(d.itemization.planCents / (d.customPlan.seats ?? 1)))
      : fmtUsd(d.itemization.planCents);

  const numbersHtml = (d.itemization.numbers || [])
    .map(
      (num) => `
        <tr>
          <td>
            <div style="font-weight: 700; color: #1e293b;">
              Direct Inward Dialing Line (DID) — <span style="font-family: monospace; font-weight: 800;">${num.number}</span>
            </div>
            <div style="font-size: 10.5px; color: #64748b; margin-top: 2px;">
              ${num.included ? 'Plan-included primary line allowance ($0.00)' : 'Additional digital phone number standard recurring line fee ($5.00/mo)'}
            </div>
          </td>
          <td style="text-align: center; font-weight: 600;">1</td>
          <td style="text-align: right; font-weight: 600;">${num.included ? '$0.00' : '$5.00'}</td>
          <td style="text-align: right; font-weight: 900; color: #0f172a;">${fmtUsd(num.monthlyCents)}</td>
        </tr>`
    )
    .join('');

  const smsAddonsHtml = (d.itemization.smsAddons || [])
    .map(
      (addon) => `
        <tr>
          <td>
            <div style="font-weight: 700; color: #1e293b;">SMS Messaging Package — ${addon.name}</div>
            <div style="font-size: 10.5px; color: #64748b; margin-top: 2px;">
              ${addon.smsCount.toLocaleString()} SMS messages pool (${addon.isRecurring ? 'Monthly recurring' : 'One-time package'})
              ${addon.deviationPercent != null
                ? ` · Standard ${fmtUsd(addon.standardTotalCents ?? 0)} · <strong style="color: ${Math.abs(addon.deviationPercent) < 0.005 ? '#64748b' : addon.deviationPercent < 0 ? '#059669' : '#d97706'};">${Math.abs(addon.deviationPercent) < 0.005 ? '0.00% deviation' : `${Math.abs(addon.deviationPercent).toFixed(2)}% ${addon.deviationPercent < 0 ? 'discount' : 'premium'}`}</strong>`
                : ''}
            </div>
          </td>
          <td style="text-align: center; font-weight: 600;">1</td>
          <td style="text-align: right; font-weight: 600;">${fmtUsd(addon.priceCents)}</td>
          <td style="text-align: right; font-weight: 900; color: #0f172a;">${fmtUsd(addon.priceCents)}</td>
        </tr>`
    )
    .join('');

  const proratedSeatsHtml = (d.itemization.proratedSeatAddons || [])
    .map(
      (addon) => `
        <tr>
          <td>
            <div style="font-weight: 700; color: #1e293b;">
              Mid-Cycle Seat Addition — ${addon.seatsAdded} User License${addon.seatsAdded > 1 ? 's' : ''} (Prorated)
            </div>
            <div style="font-size: 10.5px; color: #64748b; margin-top: 2px;">
              Prorated Service Period: ${fmtDate(addon.cycleStart)} – ${fmtDate(addon.cycleEnd)} · Agreed Rate: ${fmtUsd(addon.unitPriceCents)}/seat/mo
              ${addon.notes ? ` · Note: ${addon.notes}` : ''}
            </div>
          </td>
          <td style="text-align: center; font-weight: 600;">${addon.seatsAdded}</td>
          <td style="text-align: right; font-weight: 600;">${fmtUsd(addon.unitPriceCents)}</td>
          <td style="text-align: right; font-weight: 900; color: #0f172a;">${fmtUsd(addon.proratedAmountCents)}</td>
        </tr>`
    )
    .join('');

  const bundleHtml = d.itemization.bundle
    ? `
        <tr>
          <td>
            <div style="font-weight: 700; color: #1e293b;">Voice & SMS Service Bundle — ${d.itemization.bundle.slug}</div>
            <div style="font-size: 10.5px; color: #64748b; margin-top: 2px;">
              ${d.itemization.bundle.minutes.toLocaleString()} minutes · ${d.itemization.bundle.sms.toLocaleString()} SMS pool
            </div>
          </td>
          <td style="text-align: center; font-weight: 600;">1</td>
          <td style="text-align: right; font-weight: 600;">${fmtUsd(d.itemization.bundle.monthlyCents)}</td>
          <td style="text-align: right; font-weight: 900; color: #0f172a;">${fmtUsd(d.itemization.bundle.monthlyCents)}</td>
        </tr>`
    : '';

  const paymentsHtml =
    cyclePayments.length === 0
      ? `<div style="border: 1px dashed #cbd5e1; border-radius: 8px; padding: 10px; font-size: 11px; color: #94a3b8;">
           No bank transfer payments recorded yet for this billing period.
         </div>`
      : `<div style="display: flex; flex-direction: column; gap: 6px;">` +
        cyclePayments
          .map(
            (p) => `
              <div style="border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 8px; padding: 8px 10px; font-size: 11px;">
                <div style="display: flex; justify-content: space-between; font-weight: 700;">
                  <span>Paid on ${fmtDate(p.paidAt)}</span>
                  <span style="color: #059669; font-weight: 900; font-family: monospace;">-${fmtUsd(p.amountCents)}</span>
                </div>
                <div style="font-size: 10px; color: #64748b; margin-top: 3px;">
                  ${p.senderName ? `Sender: <strong style="color: #334155;">${p.senderName}</strong> · ` : ''}
                  ${p.bankName ? `Bank: <strong style="color: #334155;">${p.bankName}</strong>` : ''}
                  ${p.accountNumber ? ` · A/C: ${p.accountNumber}` : ''}
                  ${p.reference ? `<br />Ref: <span style="font-family: monospace;">${p.reference}</span>` : ''}
                </div>
              </div>`
          )
          .join('') +
        `</div>`;

  const orgNameClean = org.name || `Org_${org.id}`;
  const cycleLabel = fmtMonth(targetMonth);
  const documentTitle = `${docNumber} - ${orgNameClean} - ${cycleLabel}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${documentTitle}</title>
  <style>
    @page {
      size: A4 portrait;
      /* A zero page margin prevents Chromium from reserving its automatic
         header/footer area, which otherwise prints the current admin URL. */
      margin: 0;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      /* Preserve the invoice's visual margins inside the document rather than
         using @page margins, so browser-generated URL/date footers stay out. */
      padding: 12mm 14mm 14mm 14mm;
      font-size: 11.5px;
      line-height: 1.45;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    .header-table {
      width: 100%;
      margin-bottom: 16px;
    }
    .brand-col {
      width: 58%;
      vertical-align: top;
    }
    .meta-box-col {
      width: 42%;
      vertical-align: top;
      text-align: right;
    }
    .statement-box {
      display: inline-block;
      text-align: left;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 12px 18px;
      width: 100%;
      max-width: 320px;
    }
    .audit-strip {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 6px 12px;
      margin-bottom: 20px;
      font-size: 10.5px;
      color: #475569;
    }
    .account-table {
      width: 100%;
      margin-bottom: 22px;
      border-top: 1px solid #e2e8f0;
      border-bottom: 1px solid #e2e8f0;
      padding: 14px 0;
    }
    .items-table {
      width: 100%;
      margin-bottom: 24px;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
    }
    .items-table th {
      background: #f8fafc;
      padding: 9px 12px;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #475569;
      border-bottom: 1px solid #e2e8f0;
    }
    .items-table td {
      padding: 9px 12px;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: top;
    }
    .summary-table {
      width: 100%;
      margin-bottom: 24px;
    }
    .footer-section {
      margin-top: 24px;
      border-top: 1px solid #e2e8f0;
      padding-top: 12px;
      font-size: 10px;
      color: #64748b;
    }
    .gradient-bar {
      height: 3px;
      background: linear-gradient(90deg, #FF6542, #FF8A65, #FFB547);
      border-radius: 2px;
      margin-bottom: 12px;
    }
  </style>
</head>
<body>
  <!-- HEADER -->
  <table class="header-table">
    <tr>
      <td class="brand-col">
        <div style="display: flex; align-items: center; gap: 12px;">
          <img src="/logo.png" alt="ArixCall" style="height: 48px; width: auto; object-fit: contain;" />
          <div>
            <div style="font-size: 20px; font-weight: 900; letter-spacing: -0.02em; color: #0f172a; line-height: 1.1;">ArixCall</div>
            <div style="font-size: 11px; font-weight: 600; color: #64748b;">Enterprise Cloud PBX & Communications System</div>
          </div>
        </div>
        <div style="margin-top: 10px; font-size: 11px; color: #64748b; line-height: 1.5;">
          Global Telephony Operations & Enterprise Carrier Services<br />
          support@arixcall.com · billing@arixcall.com · https://arixcall.com
        </div>
      </td>
      <td class="meta-box-col">
        <div class="statement-box">
          <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b;">Official Billing Statement</div>
          <div style="font-family: monospace; font-size: 17px; font-weight: 900; color: #0f172a; margin: 3px 0 8px 0;">${docNumber}</div>
          <table style="width: 100%; font-size: 11px; line-height: 1.55;">
            <tr>
              <td style="color: #64748b; width: 45%;">Date Issued:</td>
              <td style="font-weight: 700; text-align: right;">${fmtDate(d.billingCycle?.start ?? `${targetMonth}-01`)}</td>
            </tr>
            <tr>
              <td style="color: #64748b;">Due Date:</td>
              <td style="font-weight: 700; text-align: right;">${fmtDate(d.currentCycle?.dueDateIso ?? d.billingCycle?.start ?? `${targetMonth}-10`)}</td>
            </tr>
            <tr>
              <td style="color: #64748b;">Terms:</td>
              <td style="font-weight: 600; text-align: right;">Due Upon Receipt (Bank Transfer)</td>
            </tr>
            <tr>
              <td style="color: #64748b;">Status:</td>
              <td style="text-align: right;">
                <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-weight: 800; font-size: 10px; background: ${statusBg}; color: ${statusColor}; border: 1px solid ${statusBorder};">
                  ${statusBadge.label}
                </span>
              </td>
            </tr>
          </table>
        </div>
      </td>
    </tr>
  </table>

  <!-- AUDIT STRIP: PRINTED AT & PRINTED BY -->
  <div class="audit-strip">
    <div><strong>Printed At:</strong> ${printedAt}</div>
    <div><strong>Printed By:</strong> ${printedBy}</div>
    <div><strong>Environment:</strong> Platform Superadmin Portal</div>
    <div><strong>Statement Reference:</strong> ${docNumber}</div>
  </div>

  <!-- ACCOUNT & SERVICE WINDOW TABLE -->
  <table class="account-table">
    <tr>
      <td style="width: 50%; vertical-align: top; padding-right: 20px;">
        <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 3px;">Billed To Customer</div>
        <div style="font-size: 16px; font-weight: 900; color: #0f172a;">${org.name}</div>
        <div style="font-size: 11px; color: #475569; margin-top: 4px; line-height: 1.5;">
          ${org.contactName ? `<strong>${org.contactName}</strong><br />` : ''}
          ${org.contactEmail ? `${org.contactEmail}<br />` : ''}
          ${org.contactPhone ? `<span style="font-family: monospace;">${org.contactPhone}</span><br />` : ''}
          <span style="color: #64748b;">Account ID: #${org.id} ${org.slug ? `· ${org.slug}` : ''}</span>
          ${org.createdAt ? `<br /><span style="color: #64748b;">Customer Since: ${fmtDate(org.createdAt)}</span>` : ''}
        </div>
      </td>
      <td style="width: 50%; vertical-align: top; text-align: right; padding-left: 20px;">
        <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 3px;">Subscription & Service Window</div>
        <div style="font-size: 15px; font-weight: 800; color: #0f172a;">${d.customPlan?.label || d.planLabel || 'Custom Enterprise'} Plan</div>
        <div style="font-size: 11px; color: #475569; margin-top: 4px; line-height: 1.5;">
          Service Cycle: <strong>${fmtDate(d.billingCycle?.start ?? `${targetMonth}-01`)}</strong> – <strong>${fmtDate(d.billingCycle?.end ?? `${targetMonth}-30`)}</strong><br />
          Billing Anchor Day: <strong>${d.billingCycle?.anchorDay ?? 1}th of each month</strong><br />
          Payment Method: <strong>Direct Bank Transfer (Manual Clearance)</strong><br />
          Software Seats: <strong>${d.customPlan?.activeUsers ?? d.activeUsersCount ?? 1} of ${d.customPlan?.seats ?? 1} Seats</strong>
        </div>
      </td>
    </tr>
  </table>

  <!-- ITEMIZED LINE ITEMS -->
  <div style="margin-bottom: 8px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">
    Product Licences & Itemized Charges
  </div>
  <table class="items-table">
    <thead>
      <tr>
        <th style="text-align: left; width: 55%;">Product / Licence Description</th>
        <th style="text-align: center; width: 10%;">Qty</th>
        <th style="text-align: right; width: 17%;">Unit Rate</th>
        <th style="text-align: right; width: 18%;">Total Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>
          <div style="font-weight: 800; color: #0f172a;">${d.customPlan?.label ? `${d.customPlan.label} Plan` : `${d.planLabel} Cloud PBX`}</div>
          <div style="font-size: 10.5px; color: #64748b; margin-top: 2px;">
            ${
              d.customPlan
                ? `Includes ${d.customPlan.seats ?? 1} User Seat(s), ${d.customPlan.includedNumbers} direct phone number(s), 4,000 dialing mins, ${(d.customPlan.seats ?? 1) * 100} SMS pool, ${d.customPlan.devicesPerUser === 0 ? 'unlimited' : d.customPlan.devicesPerUser ?? 5} devices/seat`
                : 'Standard enterprise calling, SIP trunks, inbound routing, and WebRTC team dialer'
            }
            ${
              d.seatPriceDeviationCents != null
                ? `<div style="margin-top: 3px; font-weight: 700; color: ${d.seatPriceDeviationCents === 0 ? '#64748b' : d.seatPriceDeviationCents < 0 ? '#059669' : '#d97706'};">
                    Agreed Rate: ${fmtUsd(d.agreedSeatPriceCents ?? 8000)}/seat/mo (Standard: ${fmtUsd(d.standardSeatPriceCents ?? 8000)}/mo · ${d.seatPriceDeviationCents === 0 ? '0.00% deviation' : `${Math.abs(((d.agreedSeatPriceCents ?? 8000) - (d.standardSeatPriceCents ?? 8000)) / Math.max(1, d.standardSeatPriceCents ?? 8000) * 100).toFixed(2)}% ${(d.seatPriceDeviationCents ?? 0) < 0 ? 'discount' : 'premium'}`})
                  </div>`
                : ''
            }
          </div>
        </td>
        <td style="text-align: center; font-weight: 600;">${d.customPlan?.seats ?? 1}</td>
        <td style="text-align: right; font-weight: 600;">${d.agreedSeatPriceCents ? fmtUsd(d.agreedSeatPriceCents) : planUnitRate}</td>
        <td style="text-align: right; font-weight: 900; color: #0f172a;">${fmtUsd(d.itemization.planCents)}</td>
      </tr>
      ${proratedSeatsHtml}
      ${numbersHtml}
      ${smsAddonsHtml}
      ${bundleHtml}
    </tbody>
  </table>

  <!-- TOTALS & PAYMENTS APPLIED -->
  <table class="summary-table">
    <tr>
      <td style="width: 52%; vertical-align: top; padding-right: 18px;">
        <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 6px;">
          Payments Applied for ${fmtMonth(targetMonth)}
        </div>
        ${paymentsHtml}

        <!-- REMITTANCE INSTRUCTIONS -->
        <div style="margin-top: 12px; border: 1px solid #e2e8f0; background: #fafafa; border-radius: 8px; padding: 10px; font-size: 10.5px; color: #475569; line-height: 1.45;">
          <div style="font-weight: 800; color: #1e293b; margin-bottom: 3px;">
            Direct Bank Transfer Remittance
          </div>
          <div>Please remit outstanding balances to designated company bank accounts via wire / IBAN transfer. Mention <strong>${docNumber}</strong> in payment remarks for immediate automated reconciliation.</div>
        </div>
      </td>

      <td style="width: 48%; vertical-align: top; padding-left: 18px;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px; margin-bottom: 12px;">
          <table style="width: 100%; font-size: 11.5px; line-height: 1.8;">
            <tr>
              <td style="color: #64748b;">Gross Plan Charges (Standard):</td>
              <td style="text-align: right; font-family: monospace; font-weight: 700;">${fmtUsd((d.standardSeatPriceCents ?? 8000) * (d.customPlan?.seats ?? 1) + (d.itemization.numbersCents || 0) + (d.itemization.smsAddonCents || 0) + (d.itemization.bundleCents || 0))}</td>
            </tr>
            <tr>
              <td style="color: #64748b;">Contract Deviations / Adjustments:</td>
              <td style="text-align: right; font-family: monospace; font-weight: 600; color: ${(d.seatPriceDeviationCents || 0) < 0 ? '#059669' : (d.seatPriceDeviationCents || 0) > 0 ? '#d97706' : '#64748b'};">
                ${
                  d.seatPriceDeviationCents && d.seatPriceDeviationCents !== 0
                    ? `${d.seatPriceDeviationCents < 0 ? '-' : '+'}${fmtUsd(Math.abs(d.seatPriceDeviationCents * (d.customPlan?.seats ?? 1)))}`
                    : '$0.00'
                }
              </td>
            </tr>
            ${
              (d.itemization.proratedSeatCents || 0) > 0
                ? `<tr>
                     <td style="color: #64748b;">Prorated Seat Additions:</td>
                     <td style="text-align: right; font-family: monospace; font-weight: 700; color: #0f172a;">+${fmtUsd(d.itemization.proratedSeatCents || 0)}</td>
                   </tr>`
                : ''
            }
            <tr style="border-top: 1px solid #e2e8f0; font-weight: 800;">
              <td style="padding-top: 4px;">Total Billed (${fmtMonth(targetMonth)}):</td>
              <td style="text-align: right; font-family: monospace; padding-top: 4px;">${fmtUsd(billedCents)}</td>
            </tr>
            <tr style="color: #059669; font-weight: 700;">
              <td>Total Payments Applied:</td>
              <td style="text-align: right; font-family: monospace;">-${fmtUsd(paidCents)}</td>
            </tr>
          </table>
        </div>

        <!-- BALANCE DUE HIGHLIGHT BOX -->
        <div style="border: 2px solid ${statusBorder}; background: ${statusBg}; border-radius: 10px; padding: 14px 16px;">
          <table style="width: 100%;">
            <tr>
              <td style="vertical-align: middle;">
                <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: ${statusColor};">
                  ${balanceCents > 0 ? 'Total Outstanding Balance' : 'Account Settled in Full'}
                </div>
                <div style="font-size: 24px; font-weight: 900; color: #0f172a; margin-top: 2px; font-family: monospace;">
                  ${fmtUsd(balanceCents)}
                </div>
              </td>
              <td style="vertical-align: middle; text-align: right; font-size: 10.5px; color: #475569;">
                <div style="font-weight: 700; color: ${statusColor};">
                  ${balanceCents > 0 ? `Due: ${fmtDate(d.currentCycle?.dueDateIso)}` : 'Zero Balance'}
                </div>
                <div style="color: #64748b; margin-top: 2px;">Doc: ${docNumber}</div>
              </td>
            </tr>
          </table>
        </div>
      </td>
    </tr>
  </table>

  <!-- ARIX THEME FOOTER -->
  <div class="footer-section">
    <div class="gradient-bar"></div>
    <table style="width: 100%; font-size: 10.5px; margin-bottom: 6px;">
      <tr>
        <td style="vertical-align: middle;">
          <strong style="color: #0f172a;">ArixCall™ Cloud Communications Platform</strong>
        </td>
        <td style="vertical-align: middle; text-align: right; color: #64748b;">
          Global Support: support@arixcall.com · Billing: billing@arixcall.com
        </td>
      </tr>
    </table>
    <div style="text-align: center; font-size: 9.5px; color: #94a3b8; line-height: 1.4;">
      This is an official computer-generated statement issued by ArixCall. No physical signature required.<br />
      Document Ref: <strong>${docNumber}</strong> · Customer ID: <strong>#${org.id} (${org.name})</strong> · Printed At: <strong>${printedAt}</strong> by <strong>${printedBy}</strong>
    </div>
  </div>
</body>
</html>`;
}

export function printInvoice(args: PrintInvoiceArgs): void {
  const orgNameClean = args.org.name || `Org_${args.org.id}`;
  const cycleLabel = fmtMonth(args.targetMonth);
  const documentTitle = `${args.docNumber} - ${orgNameClean} - ${cycleLabel}`;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    const originalTitle = document.title;
    document.title = documentTitle;
    window.print();
    document.title = originalTitle;
    return;
  }

  const html = generateInvoiceHtml(args);
  doc.open();
  doc.write(html);
  doc.close();

  let printed = false;
  const triggerPrint = () => {
    if (printed) return;
    printed = true;

    const originalTitle = document.title;
    try {
      // Set document.title so browser uses this for default PDF save filename
      document.title = documentTitle;
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      console.error('Print failed', err);
    } finally {
      // Restore parent document title after print dialog closes
      setTimeout(() => {
        document.title = originalTitle;
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 2000);
    }
  };

  if (iframe.contentWindow) {
    iframe.contentWindow.onload = triggerPrint;
    // Fallback only if onload never fires in certain browser configurations
    setTimeout(() => {
      if (!printed) triggerPrint();
    }, 500);
  } else {
    triggerPrint();
  }
}
