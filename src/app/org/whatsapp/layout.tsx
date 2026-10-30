'use client';

/**
 * /org/whatsapp/* shared layout — tabbed hub.
 *
 * One coherent surface for everything per-org WA management:
 *   • Numbers — assign each number to a group of agents
 *   • Groups  — bundles of agents that share numbers
 *   • Settings — Meta credentials, webhook URL, verification token
 *
 * The tab nav lives on the layout so switching tabs feels instant
 * (no full-page re-render of the chrome). Active tab is detected from
 * pathname so deep links land on the right tab automatically.
 */

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FiPhone, FiUsers, FiSettings, FiFileText, FiDollarSign } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';

interface Tab {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: Tab[] = [
  { label: 'Numbers', href: '/org/whatsapp/numbers', icon: FiPhone },
  { label: 'Groups', href: '/org/whatsapp/groups', icon: FiUsers },
  { label: 'Templates', href: '/org/whatsapp/templates', icon: FiFileText },
  { label: 'Billing', href: '/org/whatsapp/billing', icon: FiDollarSign },
  { label: 'Settings', href: '/org/whatsapp/settings', icon: FiSettings },
];

export default function OrgWhatsAppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <WhatsAppHubHeader pathname={pathname} />
      <div>{children}</div>
    </div>
  );
}

function WhatsAppHubHeader({ pathname }: { pathname: string | null }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <FaWhatsapp className="w-6 h-6 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">WhatsApp</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Connect Meta, share numbers across agents, keep every conversation sticky.
          </p>
        </div>
      </div>

      <nav
        role="tablist"
        aria-label="WhatsApp sections"
        className="flex items-center gap-1 border-b border-[var(--border)]"
      >
        {TABS.map((tab) => {
          const isActive = pathname?.startsWith(tab.href) ?? false;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              role="tab"
              aria-selected={isActive}
              className={`
                relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium
                transition-colors
                ${
                  isActive
                    ? 'text-[var(--foreground)]'
                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                }
              `}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {isActive && (
                <span
                  aria-hidden
                  className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[var(--primary)]"
                />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
