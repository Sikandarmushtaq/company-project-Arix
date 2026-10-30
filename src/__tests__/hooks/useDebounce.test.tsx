/**
 * useDebounce Hook Tests
 *
 * Unit tests for the useDebounce custom hook.
 * Tests debouncing behavior with various value types and timing scenarios.
 *
 * @module __tests__/hooks/useDebounce
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from '@/lib/hooks/useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial value', () => {
    it('should return initial value immediately', () => {
      const { result } = renderHook(() => useDebounce('initial', 500));
      expect(result.current).toBe('initial');
    });

    it('should work with number values', () => {
      const { result } = renderHook(() => useDebounce(42, 500));
      expect(result.current).toBe(42);
    });

    it('should work with object values', () => {
      const obj = { foo: 'bar' };
      const { result } = renderHook(() => useDebounce(obj, 500));
      expect(result.current).toEqual({ foo: 'bar' });
    });

    it('should work with null values', () => {
      const { result } = renderHook(() => useDebounce(null, 500));
      expect(result.current).toBeNull();
    });

    it('should work with undefined values', () => {
      const { result } = renderHook(() => useDebounce(undefined, 500));
      expect(result.current).toBeUndefined();
    });
  });

  describe('debouncing behavior', () => {
    it('should not update value before delay', () => {
      const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
        initialProps: { value: 'initial', delay: 500 },
      });

      // Update the value
      rerender({ value: 'updated', delay: 500 });

      // Value should not have changed yet
      expect(result.current).toBe('initial');

      // Advance timers by less than delay
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Still should not have changed
      expect(result.current).toBe('initial');
    });

    it('should update value after delay', () => {
      const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
        initialProps: { value: 'initial', delay: 500 },
      });

      rerender({ value: 'updated', delay: 500 });

      // Advance timers past delay
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Now the value should have changed
      expect(result.current).toBe('updated');
    });

    it('should reset timer on rapid value changes', () => {
      const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
        initialProps: { value: 'initial', delay: 500 },
      });

      // Make multiple rapid changes
      rerender({ value: 'change1', delay: 500 });
      act(() => {
        vi.advanceTimersByTime(200);
      });

      rerender({ value: 'change2', delay: 500 });
      act(() => {
        vi.advanceTimersByTime(200);
      });

      rerender({ value: 'change3', delay: 500 });
      act(() => {
        vi.advanceTimersByTime(200);
      });

      // Value should still be initial (not enough time passed)
      expect(result.current).toBe('initial');

      // Now wait for full delay after last change
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Should have the final value
      expect(result.current).toBe('change3');
    });
  });

  describe('delay parameter', () => {
    it('should respect different delay values', () => {
      const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
        initialProps: { value: 'initial', delay: 1000 },
      });

      rerender({ value: 'updated', delay: 1000 });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current).toBe('initial');

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current).toBe('updated');
    });

    it('should work with zero delay', () => {
      const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
        initialProps: { value: 'initial', delay: 0 },
      });

      rerender({ value: 'updated', delay: 0 });

      act(() => {
        vi.advanceTimersByTime(0);
      });

      expect(result.current).toBe('updated');
    });

    it('should work with very short delay', () => {
      const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
        initialProps: { value: 'initial', delay: 10 },
      });

      rerender({ value: 'updated', delay: 10 });

      act(() => {
        vi.advanceTimersByTime(10);
      });

      expect(result.current).toBe('updated');
    });
  });

  describe('cleanup', () => {
    it('should cleanup timeout on unmount', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      const { unmount, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
        initialProps: { value: 'initial', delay: 500 },
      });

      // Trigger a value change to create a timeout
      rerender({ value: 'updated', delay: 500 });

      unmount();

      // clearTimeout should have been called
      expect(clearTimeoutSpy).toHaveBeenCalled();

      clearTimeoutSpy.mockRestore();
    });

    it('should cleanup previous timeout when value changes', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      const { rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
        initialProps: { value: 'initial', delay: 500 },
      });

      // Multiple value changes
      rerender({ value: 'change1', delay: 500 });
      rerender({ value: 'change2', delay: 500 });
      rerender({ value: 'change3', delay: 500 });

      // clearTimeout should be called for each previous timeout
      expect(clearTimeoutSpy.mock.calls.length).toBeGreaterThanOrEqual(2);

      clearTimeoutSpy.mockRestore();
    });
  });

  describe('TypeScript generics', () => {
    it('should preserve type for string values', () => {
      const { result } = renderHook(() => useDebounce('test', 500));
      // TypeScript should infer type as string
      const value: string = result.current;
      expect(typeof value).toBe('string');
    });

    it('should preserve type for complex objects', () => {
      interface User {
        id: number;
        name: string;
      }

      const user: User = { id: 1, name: 'John' };
      const { result } = renderHook(() => useDebounce(user, 500));

      expect(result.current.id).toBe(1);
      expect(result.current.name).toBe('John');
    });

    it('should preserve type for arrays', () => {
      const array = [1, 2, 3];
      const { result } = renderHook(() => useDebounce(array, 500));

      expect(Array.isArray(result.current)).toBe(true);
      expect(result.current).toHaveLength(3);
    });
  });
});
