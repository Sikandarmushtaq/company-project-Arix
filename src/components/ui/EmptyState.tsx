'use client';

import React from 'react';
import { cn } from '@/lib/utils/cn';
import {
  FiInbox,
  FiUsers,
  FiMessageSquare,
  FiPhone,
  FiVoicemail,
  FiDisc,
  FiSearch,
  FiFileText,
  FiAlertCircle,
} from 'react-icons/fi';

type EmptyStateVariant =
  | 'default'
  | 'contacts'
  | 'messages'
  | 'calls'
  | 'voicemail'
  | 'recordings'
  | 'search'
  | 'error'
  | 'documents';

interface EmptyStateProps {
  /**
   * Pre-defined variant with default icon and styling
   */
  variant?: EmptyStateVariant;

  /**
   * Custom icon to display
   */
  icon?: React.ReactNode;

  /**
   * Main title text
   */
  title: string;

  /**
   * Description text
   */
  description?: string;

  /**
   * Action button or element
   */
  action?: React.ReactNode;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Size variant
   */
  size?: 'sm' | 'md' | 'lg';
}

const variantIcons: Record<EmptyStateVariant, React.ReactNode> = {
  default: <FiInbox className="w-full h-full" />,
  contacts: <FiUsers className="w-full h-full" />,
  messages: <FiMessageSquare className="w-full h-full" />,
  calls: <FiPhone className="w-full h-full" />,
  voicemail: <FiVoicemail className="w-full h-full" />,
  recordings: <FiDisc className="w-full h-full" />,
  search: <FiSearch className="w-full h-full" />,
  error: <FiAlertCircle className="w-full h-full" />,
  documents: <FiFileText className="w-full h-full" />,
};

const variantColors: Record<EmptyStateVariant, string> = {
  default: 'text-[var(--muted-foreground)]',
  contacts: 'text-blue-500',
  messages: 'text-green-500',
  calls: 'text-purple-500',
  voicemail: 'text-amber-500',
  recordings: 'text-red-500',
  search: 'text-[var(--muted-foreground)]',
  error: 'text-red-500',
  documents: 'text-[var(--muted-foreground)]',
};

/**
 * Empty State Component
 *
 * Displays a friendly message when there's no content to show.
 * Includes pre-defined variants for common use cases.
 *
 * @example
 * ```tsx
 * // With variant
 * <EmptyState
 *   variant="contacts"
 *   title="No contacts yet"
 *   description="Add your first contact to get started"
 *   action={<Button>Add Contact</Button>}
 * />
 *
 * // With custom icon
 * <EmptyState
 *   icon={<MyIcon />}
 *   title="Custom empty state"
 *   description="Custom description here"
 * />
 * ```
 */
export function EmptyState({
  variant = 'default',
  icon,
  title,
  description,
  action,
  className,
  size = 'md',
}: EmptyStateProps) {
  const sizeClasses = {
    sm: {
      container: 'py-8 px-4',
      iconSize: 'w-10 h-10',
      iconBg: 'w-16 h-16',
      title: 'text-base',
      description: 'text-sm',
    },
    md: {
      container: 'py-12 px-6',
      iconSize: 'w-12 h-12',
      iconBg: 'w-20 h-20',
      title: 'text-lg',
      description: 'text-sm',
    },
    lg: {
      container: 'py-16 px-8',
      iconSize: 'w-16 h-16',
      iconBg: 'w-24 h-24',
      title: 'text-xl',
      description: 'text-base',
    },
  };

  const sizes = sizeClasses[size];
  const IconComponent = icon || variantIcons[variant];
  const iconColor = variantColors[variant];

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        sizes.container,
        className
      )}
      role="status"
      aria-label={title}
    >
      {/* Icon */}
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-[var(--muted)]',
          sizes.iconBg
        )}
      >
        <div className={cn(sizes.iconSize, iconColor)}>{IconComponent}</div>
      </div>

      {/* Title */}
      <h3 className={cn('mt-4 font-semibold text-[var(--foreground)]', sizes.title)}>{title}</h3>

      {/* Description */}
      {description && (
        <p className={cn('mt-2 text-[var(--muted-foreground)] max-w-sm', sizes.description)}>
          {description}
        </p>
      )}

      {/* Action */}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/**
 * Pre-configured empty states for common use cases
 */
export const EmptyStates = {
  NoContacts: (props: Partial<EmptyStateProps>) => (
    <EmptyState
      variant="contacts"
      title="No contacts yet"
      description="Add your first contact to start building your address book"
      {...props}
    />
  ),

  NoMessages: (props: Partial<EmptyStateProps>) => (
    <EmptyState
      variant="messages"
      title="No messages"
      description="Start a conversation by sending a message"
      {...props}
    />
  ),

  NoCallHistory: (props: Partial<EmptyStateProps>) => (
    <EmptyState
      variant="calls"
      title="No call history"
      description="Your recent calls will appear here"
      {...props}
    />
  ),

  NoVoicemail: (props: Partial<EmptyStateProps>) => (
    <EmptyState
      variant="voicemail"
      title="No voicemails"
      description="You don't have any voicemail messages"
      {...props}
    />
  ),

  NoRecordings: (props: Partial<EmptyStateProps>) => (
    <EmptyState
      variant="recordings"
      title="No recordings"
      description="Your call recordings will appear here"
      {...props}
    />
  ),

  NoSearchResults: (props: Partial<EmptyStateProps>) => (
    <EmptyState
      variant="search"
      title="No results found"
      description="Try adjusting your search or filters"
      {...props}
    />
  ),

  Error: (props: Partial<EmptyStateProps>) => (
    <EmptyState
      variant="error"
      title="Something went wrong"
      description="We couldn't load this content. Please try again."
      {...props}
    />
  ),
};

export default EmptyState;
