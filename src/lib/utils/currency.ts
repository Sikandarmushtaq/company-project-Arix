/**
 * Platform Currency Formatter (PKR SSOT & Dual-Currency Presentation)
 *
 * All reporting and billing in ArixCall is denominated in PKR (Pakistani Rupee),
 * with USD maintained for Stripe payment gateway interactions.
 */

/**
 * Format a PKR minor amount (paisa/cents) to human-readable PKR display.
 * e.g. 1652000 -> "PKR 16,520" (or "PKR 16,520.50" if fractional paisa)
 */
export function fmtPkr(minorUnits: number | bigint | string | null | undefined): string {
  if (minorUnits === null || minorUnits === undefined) return 'PKR 0';
  const val = typeof minorUnits === 'string' ? parseFloat(minorUnits) : Number(minorUnits);
  if (isNaN(val)) return 'PKR 0';

  const major = val / 100;
  const hasDecimals = major % 1 !== 0;

  return `PKR ${major.toLocaleString('en-PK', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Format a USD minor amount (cents) to standard USD display ($59.00).
 */
export function fmtUsd(cents: number | bigint | string | null | undefined): string {
  if (cents === null || cents === undefined) return '$0.00';
  const val = typeof cents === 'string' ? parseFloat(cents) : Number(cents);
  if (isNaN(val)) return '$0.00';

  return `$${(val / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Format dual-currency presentation for Stripe rows where PKR is primary and
 * USD/Stripe conversion details are secondary.
 */
export function fmtDual(
  pkrMinor: number | bigint | string | null | undefined,
  usdCents?: number | bigint | string | null,
  exchangeRate?: number | string | null
): { primary: string; secondary?: string } {
  const primary = fmtPkr(pkrMinor);

  if (usdCents !== undefined && usdCents !== null && Number(usdCents) > 0) {
    const usdStr = fmtUsd(usdCents);
    const rateStr = exchangeRate ? ` @ ${Number(exchangeRate).toFixed(2)}` : '';
    return {
      primary,
      secondary: `Stripe: ${usdStr}${rateStr}`,
    };
  }

  return { primary };
}

/**
 * Frontend helper converting USD cents to PKR minor units using the active rate.
 */
export function convertUsdCentsToPkrMinor(usdCents: number, rate: number | string = 278.5): number {
  const rateNum = typeof rate === 'string' ? parseFloat(rate) : rate;
  return Math.round(usdCents * (rateNum || 278.5));
}

/**
 * Frontend helper converting PKR minor units to USD cents using the active rate.
 */
export function convertPkrMinorToUsdCents(pkrMinor: number, rate: number | string = 278.5): number {
  const rateNum = typeof rate === 'string' ? parseFloat(rate) : rate;
  return Math.round(pkrMinor / (rateNum || 278.5));
}
