/**
 * Sidebar Component Tests
 *
 * Unit tests for the sidebar navigation component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar, type NavItem } from '@/components/layout/Sidebar';
import { FiPhone, FiMessageSquare, FiUsers, FiSettings } from 'react-icons/fi';

// Mock next/navigation with vi.fn for usePathname
const mockUsePathname = vi.fn(() => '/phone');

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => mockUsePathname(),
  useSearchParams: () => new URLSearchParams(),
}));

const mockNavItems: NavItem[] = [
  { label: 'Phone', href: '/phone', icon: <FiPhone data-testid="phone-icon" /> },
  {
    label: 'Messages',
    href: '/phone/messages',
    icon: <FiMessageSquare data-testid="messages-icon" />,
    badge: 5,
  },
  { label: 'Contacts', href: '/phone/contacts', icon: <FiUsers data-testid="contacts-icon" /> },
  { label: 'Settings', href: '/phone/settings', icon: <FiSettings data-testid="settings-icon" /> },
];

describe('Sidebar', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/phone');
  });

  it('should render title', () => {
    render(<Sidebar items={mockNavItems} title="Test App" />);

    expect(screen.getByText('Test App')).toBeInTheDocument();
  });

  it('should render all navigation items', () => {
    render(<Sidebar items={mockNavItems} title="Test App" />);

    expect(screen.getByText('Phone')).toBeInTheDocument();
    expect(screen.getByText('Messages')).toBeInTheDocument();
    expect(screen.getByText('Contacts')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('should render navigation icons', () => {
    render(<Sidebar items={mockNavItems} title="Test App" />);

    expect(screen.getByTestId('phone-icon')).toBeInTheDocument();
    expect(screen.getByTestId('messages-icon')).toBeInTheDocument();
    expect(screen.getByTestId('contacts-icon')).toBeInTheDocument();
    expect(screen.getByTestId('settings-icon')).toBeInTheDocument();
  });

  it('should render badge when provided', () => {
    render(<Sidebar items={mockNavItems} title="Test App" />);

    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('should render logo when provided', () => {
    const logo = <div data-testid="custom-logo">Logo</div>;

    render(<Sidebar items={mockNavItems} title="Test App" logo={logo} />);

    expect(screen.getByTestId('custom-logo')).toBeInTheDocument();
  });

  it('should render footer when provided', () => {
    const footer = <div data-testid="sidebar-footer">Footer Content</div>;

    render(<Sidebar items={mockNavItems} title="Test App" footer={footer} />);

    expect(screen.getByTestId('sidebar-footer')).toBeInTheDocument();
  });

  it('should call onToggle when toggle button is clicked', () => {
    const onToggle = vi.fn();

    render(<Sidebar items={mockNavItems} title="Test App" onToggle={onToggle} />);

    const toggleButton = screen.getByRole('button');
    fireEvent.click(toggleButton);

    expect(onToggle).toHaveBeenCalled();
  });

  it('should not show title in collapsed state', () => {
    render(<Sidebar items={mockNavItems} title="Test App" collapsed={true} />);

    expect(screen.queryByText('Test App')).not.toBeInTheDocument();
  });

  it('should not show labels in collapsed state', () => {
    render(<Sidebar items={mockNavItems} title="Test App" collapsed={true} />);

    expect(screen.queryByText('Phone')).not.toBeInTheDocument();
    expect(screen.queryByText('Messages')).not.toBeInTheDocument();
  });

  it('should have correct width in collapsed state', () => {
    const { container } = render(
      <Sidebar items={mockNavItems} title="Test App" collapsed={true} />
    );

    const aside = container.querySelector('aside');
    expect(aside).toHaveClass('w-16');
  });

  it('should have correct width in expanded state', () => {
    const { container } = render(
      <Sidebar items={mockNavItems} title="Test App" collapsed={false} />
    );

    const aside = container.querySelector('aside');
    expect(aside).toHaveClass('w-64');
  });

  it('should handle empty items array', () => {
    render(<Sidebar items={[]} title="Test App" />);

    expect(screen.getByText('Test App')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('should not render toggle button when onToggle is not provided', () => {
    render(<Sidebar items={mockNavItems} title="Test App" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('should render aside element', () => {
    const { container } = render(<Sidebar items={mockNavItems} title="Test App" />);

    expect(container.querySelector('aside')).toBeInTheDocument();
  });

  it('should render nav element', () => {
    const { container } = render(<Sidebar items={mockNavItems} title="Test App" />);

    expect(container.querySelector('nav')).toBeInTheDocument();
  });

  it('should render links', () => {
    render(<Sidebar items={mockNavItems} title="Test App" />);

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(4);
  });
});
