import { describe, it, expect } from 'vitest';
import { fmtPkr, fmtUsd, fmtDual } from './currency';

describe('Frontend Currency Utilities', () => {
  describe('fmtPkr', () => {
    it('formats whole PKR minor amounts cleanly without fractional zeros', () => {
      expect(fmtPkr(1652000)).toBe('PKR 16,520');
      expect(fmtPkr('1652000')).toBe('PKR 16,520');
    });

    it('formats fractional PKR paisa with 2 decimal places when non-zero', () => {
      expect(fmtPkr(1652050)).toBe('PKR 16,520.50');
    });

    it('handles zero, null, undefined and invalid values gracefully', () => {
      expect(fmtPkr(0)).toBe('PKR 0');
      expect(fmtPkr(null)).toBe('PKR 0');
      expect(fmtPkr(undefined)).toBe('PKR 0');
      expect(fmtPkr('invalid')).toBe('PKR 0');
    });
  });

  describe('fmtUsd', () => {
    it('formats USD cents to standard dollar string with 2 decimals', () => {
      expect(fmtUsd(5900)).toBe('$59.00');
      expect(fmtUsd('12000')).toBe('$120.00');
      expect(fmtUsd(0)).toBe('$0.00');
    });
  });

  describe('fmtDual', () => {
    it('returns primary PKR with secondary Stripe USD when USD amount provided', () => {
      const dual = fmtDual(1652000, 5900, 280);
      expect(dual.primary).toBe('PKR 16,520');
      expect(dual.secondary).toBe('Stripe: $59.00 @ 280.00');
    });

    it('returns only primary PKR when USD cents is not provided or zero', () => {
      const dual = fmtDual(1652000);
      expect(dual.primary).toBe('PKR 16,520');
      expect(dual.secondary).toBeUndefined();
    });
  });
});

