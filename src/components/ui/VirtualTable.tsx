'use client';

import React, { useRef, useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils/cn';

interface Column<T> {
  /**
   * Unique key for the column
   */
  key: string;

  /**
   * Column header label
   */
  header: React.ReactNode;

  /**
   * Width of the column (px, %, or 'auto')
   */
  width?: string | number;

  /**
   * Min width of the column
   */
  minWidth?: number;

  /**
   * Render cell content
   */
  cell: (row: T, rowIndex: number) => React.ReactNode;

  /**
   * Alignment
   */
  align?: 'left' | 'center' | 'right';

  /**
   * Whether the column is sortable
   */
  sortable?: boolean;

  /**
   * Additional header CSS classes
   */
  headerClassName?: string;

  /**
   * Additional cell CSS classes
   */
  cellClassName?: string;
}

interface VirtualTableProps<T> {
  /**
   * Array of data to display
   */
  data: T[];

  /**
   * Column definitions
   */
  columns: Column<T>[];

  /**
   * Height of each row in pixels
   * @default 52
   */
  rowHeight?: number;

  /**
   * Height of the table container
   * @default 600
   */
  height?: number;

  /**
   * Key function to get unique key for each row
   */
  getRowKey: (row: T, index: number) => string | number;

  /**
   * Callback when a row is clicked
   */
  onRowClick?: (row: T, index: number) => void;

  /**
   * Additional CSS class for the container
   */
  className?: string;

  /**
   * Whether to show loading state
   */
  isLoading?: boolean;

  /**
   * Number of skeleton rows to show when loading
   * @default 10
   */
  loadingRows?: number;

  /**
   * Empty state content
   */
  emptyState?: React.ReactNode;

  /**
   * Current sort column key
   */
  sortColumn?: string;

  /**
   * Sort direction
   */
  sortDirection?: 'asc' | 'desc';

  /**
   * Callback when sort changes
   */
  onSort?: (columnKey: string, direction: 'asc' | 'desc') => void;

  /**
   * Whether rows are selectable
   */
  selectable?: boolean;

  /**
   * Selected row keys
   */
  selectedKeys?: Set<string | number>;

  /**
   * Callback when selection changes
   */
  onSelectionChange?: (keys: Set<string | number>) => void;

  /**
   * Whether to show row numbers
   */
  showRowNumbers?: boolean;

  /**
   * Overscan count for virtualization
   * @default 5
   */
  overscan?: number;
}

/**
 * Virtual Table Component
 *
 * High-performance table that only renders visible rows using virtualization.
 * Ideal for tables with 100+ rows.
 *
 * @example
 * ```tsx
 * <VirtualTable
 *   data={users}
 *   columns={[
 *     { key: 'name', header: 'Name', cell: (row) => row.name },
 *     { key: 'email', header: 'Email', cell: (row) => row.email },
 *   ]}
 *   getRowKey={(row) => row.id}
 *   height={500}
 * />
 * ```
 */
export function VirtualTable<T>({
  data,
  columns,
  rowHeight = 52,
  height = 600,
  getRowKey,
  onRowClick,
  className,
  isLoading,
  loadingRows = 10,
  emptyState,
  sortColumn,
  sortDirection,
  onSort,
  selectable,
  selectedKeys,
  onSelectionChange,
  showRowNumbers,
  overscan = 5,
}: VirtualTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Build column list with optional row numbers
  const allColumns = useMemo(() => {
    const cols = [...columns];

    if (showRowNumbers) {
      cols.unshift({
        key: '_rowNumber',
        header: '#',
        width: 50,
        cell: (_: T, index: number) => index + 1,
        align: 'center',
      });
    }

    if (selectable) {
      cols.unshift({
        key: '_selection',
        header: (
          <input
            type="checkbox"
            checked={selectedKeys?.size === data.length && data.length > 0}
            onChange={(e) => {
              if (e.target.checked) {
                onSelectionChange?.(new Set(data.map((row, i) => getRowKey(row, i))));
              } else {
                onSelectionChange?.(new Set());
              }
            }}
            className="w-4 h-4 rounded border-[var(--border)]"
            aria-label="Select all rows"
          />
        ),
        width: 40,
        cell: (row: T, index: number) => {
          const key = getRowKey(row, index);
          return (
            <input
              type="checkbox"
              checked={selectedKeys?.has(key)}
              onChange={(e) => {
                e.stopPropagation();
                const newSelection = new Set(selectedKeys);
                if (e.target.checked) {
                  newSelection.add(key);
                } else {
                  newSelection.delete(key);
                }
                onSelectionChange?.(newSelection);
              }}
              className="w-4 h-4 rounded border-[var(--border)]"
              aria-label={`Select row ${index + 1}`}
            />
          );
        },
        align: 'center',
      });
    }

    return cols;
  }, [columns, showRowNumbers, selectable, selectedKeys, data, getRowKey, onSelectionChange]);

  // Initialize virtualizer
  const rowVirtualizer = useVirtualizer({
    count: isLoading ? loadingRows : data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan,
  });

  // Handle sort click
  const handleSort = useCallback(
    (columnKey: string) => {
      if (!onSort) return;

      if (sortColumn === columnKey) {
        onSort(columnKey, sortDirection === 'asc' ? 'desc' : 'asc');
      } else {
        onSort(columnKey, 'asc');
      }
    },
    [sortColumn, sortDirection, onSort]
  );

  // Alignment classes
  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  // Loading skeleton
  const renderSkeleton = (colIndex: number) => (
    <div
      className="h-4 bg-[var(--muted)] rounded animate-pulse"
      style={{ width: colIndex === 0 ? '60%' : '80%' }}
    />
  );

  // Empty state
  if (!isLoading && data.length === 0) {
    return (
      <div className={cn('rounded-xl border border-[var(--border)] bg-[var(--card)]', className)}>
        {/* Header */}
        <div className="border-b border-[var(--border)] bg-[var(--muted)]/50">
          <div className="flex">
            {allColumns.map((col) => (
              <div
                key={col.key}
                className={cn(
                  'px-4 py-3 text-sm font-semibold text-[var(--muted-foreground)]',
                  alignClasses[col.align || 'left'],
                  col.headerClassName
                )}
                style={{
                  width: col.width,
                  minWidth: col.minWidth,
                  flex: col.width ? undefined : 1,
                }}
              >
                {col.header}
              </div>
            ))}
          </div>
        </div>

        {/* Empty state */}
        <div className="flex items-center justify-center py-16">
          {emptyState || <p className="text-[var(--muted-foreground)]">No data to display</p>}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="border-b border-[var(--border)] bg-[var(--muted)]/50 sticky top-0 z-10">
        <div className="flex" role="row">
          {allColumns.map((col) => (
            <div
              key={col.key}
              role="columnheader"
              className={cn(
                'px-4 py-3 text-sm font-semibold text-[var(--muted-foreground)]',
                alignClasses[col.align || 'left'],
                col.sortable && 'cursor-pointer hover:text-[var(--foreground)] transition-colors',
                col.headerClassName
              )}
              style={{
                width: col.width,
                minWidth: col.minWidth,
                flex: col.width ? undefined : 1,
              }}
              onClick={col.sortable ? () => handleSort(col.key) : undefined}
            >
              <span className="inline-flex items-center gap-1">
                {col.header}
                {col.sortable && sortColumn === col.key && (
                  <span aria-hidden="true">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Virtual body */}
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ height: height - 48 }} // Subtract header height
        role="rowgroup"
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = data[virtualRow.index];
            const isSelected = !isLoading && selectedKeys?.has(getRowKey(row, virtualRow.index));

            return (
              <div
                key={virtualRow.key}
                role="row"
                className={cn(
                  'absolute top-0 left-0 w-full flex border-b border-[var(--border)] last:border-0',
                  !isLoading && onRowClick && 'cursor-pointer hover:bg-[var(--muted)]/50',
                  isSelected && 'bg-[var(--primary-50)] dark:bg-[var(--primary-900)]/20'
                )}
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                onClick={
                  !isLoading && onRowClick ? () => onRowClick(row, virtualRow.index) : undefined
                }
              >
                {allColumns.map((col) => (
                  <div
                    key={col.key}
                    role="cell"
                    className={cn(
                      'px-4 flex items-center text-sm text-[var(--foreground)]',
                      alignClasses[col.align || 'left'],
                      col.cellClassName
                    )}
                    style={{
                      width: col.width,
                      minWidth: col.minWidth,
                      flex: col.width ? undefined : 1,
                    }}
                  >
                    {isLoading
                      ? renderSkeleton(allColumns.indexOf(col))
                      : col.cell(row, virtualRow.index)}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default VirtualTable;
