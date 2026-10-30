'use client';

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  createContext,
  useContext,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  FiSearch,
  FiPhone,
  FiMessageSquare,
  FiClock,
  FiUsers,
  FiMic,
  FiSettings,
  FiVoicemail,
  FiShield,
  FiActivity,
  FiDatabase,
  FiUser,
  FiLogOut,
  FiCommand,
  FiArrowRight,
} from 'react-icons/fi';
import { Modal } from './Modal';
import { useKeyboardShortcuts, formatShortcut } from '@/lib/hooks/useKeyboardShortcuts';
import { useAuthStore } from '@/lib/stores/auth';

// ============================================================================
// Types
// ============================================================================

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  shortcut?: { key: string; ctrl?: boolean; shift?: boolean; alt?: boolean };
  section: string;
  keywords?: string[];
  onSelect: () => void;
  disabled?: boolean;
}

interface CommandPaletteContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  registerCommands: (commands: CommandItem[]) => () => void;
}

// ============================================================================
// Context
// ============================================================================

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

export function useCommandPalette(): CommandPaletteContextValue {
  const context = useContext(CommandPaletteContext);
  if (!context) {
    throw new Error('useCommandPalette must be used within a CommandPaletteProvider');
  }
  return context;
}

// ============================================================================
// Provider
// ============================================================================

interface CommandPaletteProviderProps {
  children: React.ReactNode;
}

export function CommandPaletteProvider({ children }: CommandPaletteProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [registeredCommands, setRegisteredCommands] = useState<CommandItem[]>([]);
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  // Register commands from child components
  const registerCommands = useCallback((commands: CommandItem[]) => {
    setRegisteredCommands((prev) => [...prev, ...commands]);
    return () => {
      setRegisteredCommands((prev) => prev.filter((c) => !commands.includes(c)));
    };
  }, []);

  // Ctrl+K to open command palette
  useKeyboardShortcuts([
    {
      key: 'k',
      ctrl: true,
      handler: toggle,
      description: 'Open command palette',
      category: 'Navigation',
      ignoreInputs: false,
    },
  ]);

  // Default navigation commands
  const defaultCommands = useMemo<CommandItem[]>(() => {
    const isAdmin = user?.role === 'admin';
    const commands: CommandItem[] = [
      // Phone section
      {
        id: 'nav-phone',
        label: 'Go to Phone',
        description: 'Open the dialpad',
        icon: <FiPhone className="w-4 h-4" />,
        section: 'Navigation',
        keywords: ['dialpad', 'call', 'dial'],
        onSelect: () => {
          router.push('/phone');
          close();
        },
      },
      {
        id: 'nav-messages',
        label: 'Go to Messages',
        description: 'View SMS conversations',
        icon: <FiMessageSquare className="w-4 h-4" />,
        section: 'Navigation',
        keywords: ['sms', 'text', 'chat'],
        onSelect: () => {
          router.push('/phone/messages');
          close();
        },
      },
      {
        id: 'nav-history',
        label: 'Go to Call History',
        description: 'View recent calls',
        icon: <FiClock className="w-4 h-4" />,
        section: 'Navigation',
        keywords: ['calls', 'recent', 'log'],
        onSelect: () => {
          router.push('/phone/history');
          close();
        },
      },
      {
        id: 'nav-contacts',
        label: 'Go to Contacts',
        description: 'Manage your contacts',
        icon: <FiUsers className="w-4 h-4" />,
        section: 'Navigation',
        keywords: ['people', 'address book'],
        onSelect: () => {
          router.push('/phone/contacts');
          close();
        },
      },
      {
        id: 'nav-recordings',
        label: 'Go to Recordings',
        description: 'View call recordings',
        icon: <FiMic className="w-4 h-4" />,
        section: 'Navigation',
        keywords: ['audio', 'record'],
        onSelect: () => {
          router.push('/phone/recordings');
          close();
        },
      },
      {
        id: 'nav-voicemail',
        label: 'Go to Voicemail',
        description: 'Check voicemail messages',
        icon: <FiVoicemail className="w-4 h-4" />,
        section: 'Navigation',
        keywords: ['voice', 'inbox'],
        onSelect: () => {
          router.push('/phone/voicemail');
          close();
        },
      },
      {
        id: 'nav-settings',
        label: 'Go to Settings',
        description: 'Configure your preferences',
        icon: <FiSettings className="w-4 h-4" />,
        section: 'Navigation',
        keywords: ['preferences', 'config'],
        onSelect: () => {
          router.push('/phone/settings');
          close();
        },
      },
    ];

    // Admin commands
    if (isAdmin) {
      commands.push(
        {
          id: 'admin-dashboard',
          label: 'Admin Dashboard',
          description: 'View admin overview',
          icon: <FiActivity className="w-4 h-4" />,
          section: 'Admin',
          keywords: ['overview', 'stats'],
          onSelect: () => {
            router.push('/admin');
            close();
          },
        },
        {
          id: 'admin-users',
          label: 'Manage Users',
          description: 'User administration',
          icon: <FiUser className="w-4 h-4" />,
          section: 'Admin',
          keywords: ['accounts', 'members'],
          onSelect: () => {
            router.push('/admin/users');
            close();
          },
        },
        {
          id: 'admin-permissions',
          label: 'Permissions',
          description: 'Manage user permissions',
          icon: <FiShield className="w-4 h-4" />,
          section: 'Admin',
          keywords: ['roles', 'access'],
          onSelect: () => {
            router.push('/admin/permissions');
            close();
          },
        },
        {
          id: 'admin-health',
          label: 'System Health',
          description: 'Monitor system status',
          icon: <FiDatabase className="w-4 h-4" />,
          section: 'Admin',
          keywords: ['status', 'monitoring'],
          onSelect: () => {
            router.push('/admin/health');
            close();
          },
        }
      );
    }

    // Account commands
    commands.push({
      id: 'action-logout',
      label: 'Sign Out',
      description: 'Log out of your account',
      icon: <FiLogOut className="w-4 h-4" />,
      section: 'Account',
      keywords: ['logout', 'exit'],
      onSelect: () => {
        logout();
        router.push('/login');
        close();
      },
    });

    return commands;
  }, [user?.role, router, close, logout]);

  // Combine default and registered commands
  const allCommands = useMemo(
    () => [...defaultCommands, ...registeredCommands],
    [defaultCommands, registeredCommands]
  );

  const contextValue = useMemo(
    () => ({
      isOpen,
      open,
      close,
      toggle,
      registerCommands,
    }),
    [isOpen, open, close, toggle, registerCommands]
  );

  return (
    <CommandPaletteContext.Provider value={contextValue}>
      {children}
      <CommandPaletteModal isOpen={isOpen} onClose={close} commands={allCommands} />
    </CommandPaletteContext.Provider>
  );
}

// ============================================================================
// Modal Component
// ============================================================================

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  commands: CommandItem[];
}

function CommandPaletteModal({ isOpen, onClose, commands }: CommandPaletteModalProps) {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter commands based on search
  const filteredCommands = useMemo(() => {
    if (!search.trim()) return commands;

    const query = search.toLowerCase();
    return commands.filter((cmd) => {
      if (cmd.disabled) return false;
      if (cmd.label.toLowerCase().includes(query)) return true;
      if (cmd.description?.toLowerCase().includes(query)) return true;
      if (cmd.keywords?.some((kw) => kw.toLowerCase().includes(query))) return true;
      return false;
    });
  }, [commands, search]);

  // Group commands by section
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    for (const cmd of filteredCommands) {
      if (!groups[cmd.section]) {
        groups[cmd.section] = [];
      }
      groups[cmd.section].push(cmd);
    }
    return groups;
  }, [filteredCommands]);

  // Flatten for keyboard navigation
  const flatCommands = useMemo(() => {
    const flat: CommandItem[] = [];
    for (const section of Object.keys(groupedCommands)) {
      flat.push(...groupedCommands[section]);
    }
    return flat;
  }, [groupedCommands]);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.querySelector('[data-selected="true"]');
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, flatCommands.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (flatCommands[selectedIndex]) {
            flatCommands[selectedIndex].onSelect();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [flatCommands, selectedIndex, onClose]
  );

  // Track current index for rendering
  let currentIndex = -1;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" title="">
      <div className="flex flex-col max-h-[70vh]">
        {/* Search Input */}
        <div className="relative">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--muted-foreground)]" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search..."
            className="w-full pl-12 pr-4 py-4 text-lg bg-transparent border-b border-[var(--border)] focus:outline-none focus:border-[var(--border)] text-[var(--foreground)]"
            aria-label="Command palette search"
            aria-controls="command-list"
            aria-activedescendant={
              flatCommands[selectedIndex] ? `cmd-${flatCommands[selectedIndex].id}` : undefined
            }
          />
        </div>

        {/* Keyboard hint */}
        <div className="px-4 py-2 text-xs text-[var(--muted-foreground)] flex items-center gap-4 border-b border-[var(--border)]">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-[var(--muted)] rounded text-[10px]">↑↓</kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-[var(--muted)] rounded text-[10px]">↵</kbd>
            Select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-[var(--muted)] rounded text-[10px]">Esc</kbd>
            Close
          </span>
        </div>

        {/* Command List */}
        <div
          ref={listRef}
          id="command-list"
          role="listbox"
          aria-label="Commands"
          className="flex-1 overflow-y-auto py-2"
        >
          {flatCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-[var(--muted-foreground)]">
              <FiCommand className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No commands found</p>
              <p className="text-sm mt-1">Try a different search term</p>
            </div>
          ) : (
            Object.entries(groupedCommands).map(([section, items]) => (
              <div key={section} className="mb-2">
                <div className="px-4 py-2 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                  {section}
                </div>
                {items.map((cmd) => {
                  currentIndex++;
                  const isSelected = currentIndex === selectedIndex;
                  return (
                    <CommandItemRow
                      key={cmd.id}
                      command={cmd}
                      isSelected={isSelected}
                      onSelect={() => cmd.onSelect()}
                      onHover={() => setSelectedIndex(currentIndex)}
                      index={currentIndex}
                    />
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}

// ============================================================================
// Command Item Component
// ============================================================================

interface CommandItemRowProps {
  command: CommandItem;
  isSelected: boolean;
  onSelect: () => void;
  onHover: () => void;
  index: number;
}

const CommandItemRow = React.memo(function CommandItemRow({
  command,
  isSelected,
  onSelect,
  onHover,
  index,
}: CommandItemRowProps) {
  return (
    <div
      id={`cmd-${command.id}`}
      role="option"
      aria-selected={isSelected}
      data-selected={isSelected}
      className={`
        flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors
        ${isSelected ? 'bg-[var(--primary-100)] dark:bg-[var(--primary-900)]' : 'hover:bg-[var(--muted)]'}
        ${command.disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
      onClick={command.disabled ? undefined : onSelect}
      onMouseEnter={onHover}
    >
      {/* Icon */}
      <div
        className={`
        flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center
        ${isSelected ? 'bg-[var(--primary-600)] text-white' : 'bg-[var(--muted)] text-[var(--muted-foreground)]'}
      `}
      >
        {command.icon || <FiArrowRight className="w-4 h-4" />}
      </div>

      {/* Label & Description */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-[var(--foreground)]">{command.label}</div>
        {command.description && (
          <div className="text-sm text-[var(--muted-foreground)] truncate">
            {command.description}
          </div>
        )}
      </div>

      {/* Shortcut */}
      {command.shortcut && (
        <div className="flex-shrink-0 text-xs text-[var(--muted-foreground)]">
          <kbd className="px-2 py-1 bg-[var(--muted)] rounded">
            {formatShortcut(command.shortcut)}
          </kbd>
        </div>
      )}
    </div>
  );
});

export default CommandPaletteProvider;
