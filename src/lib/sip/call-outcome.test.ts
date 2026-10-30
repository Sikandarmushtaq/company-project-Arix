import { describe, it, expect } from 'vitest';
import { callFailureOutcome } from './call-outcome';

describe('callFailureOutcome', () => {
  it('maps a dead number (404 / unallocated) to "Not in Service"', () => {
    expect(callFailureOutcome(404)).toBe('Not in Service');
    expect(callFailureOutcome(484)).toBe('Not in Service');
    expect(callFailureOutcome(604)).toBe('Not in Service');
    // reason-phrase fallback when the code varies by carrier
    expect(callFailureOutcome(500, 'Unallocated Number')).toBe('Not in Service');
    expect(callFailureOutcome(undefined, 'No route to destination')).toBe('Not in Service');
  });

  it('maps busy / decline / reject / no-answer / server errors', () => {
    expect(callFailureOutcome(486)).toBe('Busy');
    expect(callFailureOutcome(600)).toBe('Busy');
    expect(callFailureOutcome(603)).toBe('Declined');
    expect(callFailureOutcome(403)).toBe('Rejected');
    expect(callFailureOutcome(408)).toBe('No Answer');
    expect(callFailureOutcome(480)).toBe('No Answer');
    expect(callFailureOutcome(503)).toBe('Service Unavailable');
  });

  it('stays silent for user-cancel (487), success, and unknown codes', () => {
    expect(callFailureOutcome(487)).toBeNull();
    expect(callFailureOutcome(200)).toBeNull();
    expect(callFailureOutcome(undefined)).toBeNull();
    expect(callFailureOutcome(499)).toBeNull();
  });
});
