import React from 'react';
import { FiLoader, FiSearch } from 'react-icons/fi';
import { AvailableNumberItem } from './types';
import { AvailableNumberCard } from './AvailableNumberCard';

interface AvailableNumberListProps {
  numbers: AvailableNumberItem[];
  isLoading: boolean;
  hasSearched: boolean;
  selectedNumber: AvailableNumberItem | null;
  onSelectNumber: (number: AvailableNumberItem) => void;
}

export function AvailableNumberList({
  numbers,
  isLoading,
  hasSearched,
  selectedNumber,
  onSelectNumber,
}: AvailableNumberListProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-sm text-[var(--muted-foreground)]">
        <FiLoader className="w-6 h-6 animate-spin text-[var(--primary)] mb-2" />
        <span>Searching provider inventory...</span>
      </div>
    );
  }

  if (!hasSearched) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-sm text-[var(--muted-foreground)] border border-dashed border-[var(--border)] rounded-xl">
        <FiSearch className="w-7 h-7 mb-2 text-[var(--muted-foreground)]/60" />
        <span className="font-medium text-[var(--foreground)]">Find available phone numbers</span>
        <span className="text-xs text-[var(--muted-foreground)] mt-0.5">
          Select a city or area code above to search inventory.
        </span>
      </div>
    );
  }

  if (numbers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-sm text-[var(--muted-foreground)] border border-dashed border-[var(--border)] rounded-xl">
        <FiSearch className="w-7 h-7 mb-2 text-[var(--muted-foreground)]/60" />
        <span className="font-medium text-[var(--foreground)]">No numbers available</span>
        <span className="text-xs text-[var(--muted-foreground)] mt-0.5 max-w-xs">
          No inventory found matching your criteria. Try another city, area code, or remove digit
          filters.
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
      {numbers.map((num) => (
        <AvailableNumberCard
          key={num.phoneNumber}
          number={num}
          isSelected={selectedNumber?.phoneNumber === num.phoneNumber}
          onSelect={onSelectNumber}
        />
      ))}
    </div>
  );
}
