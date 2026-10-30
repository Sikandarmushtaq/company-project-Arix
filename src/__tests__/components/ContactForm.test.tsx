/**
 * ContactForm Component Tests
 *
 * Unit tests for the contact form component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ContactForm } from '@/components/forms/ContactForm';

// Mock the validation module
vi.mock('@/lib/validation', () => ({
  createContactSchema: {
    parse: vi.fn((data) => data),
  },
  CONTACT_VALIDATION: {
    name: {
      minLength: 2,
      maxLength: 100,
    },
    phone: {
      minDigits: 10,
      maxDigits: 15,
    },
    type: {
      options: ['personal', 'business', 'other'],
      default: 'personal',
    },
    notes: {
      max: 500,
    },
  },
}));

// Mock zod resolver to simply pass through values
vi.mock('@hookform/resolvers/zod', () => ({
  zodResolver: () => async (data: unknown) => ({
    values: data,
    errors: {},
  }),
}));

describe('ContactForm', () => {
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render submit and cancel buttons', () => {
    render(<ContactForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('should use custom submit label', () => {
    render(
      <ContactForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} submitLabel="Create Contact" />
    );

    expect(screen.getByRole('button', { name: 'Create Contact' })).toBeInTheDocument();
  });

  it('should call onCancel when cancel is clicked', () => {
    render(<ContactForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should display API error', () => {
    render(
      <ContactForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        apiError="A contact with this phone number already exists"
      />
    );

    expect(screen.getByText('A contact with this phone number already exists')).toBeInTheDocument();
  });

  it('should show loading state when submitting', () => {
    render(<ContactForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} isSubmitting={true} />);

    expect(screen.getByRole('button', { name: 'Saving...' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
  });

  it('should disable cancel button when submitting', () => {
    render(<ContactForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} isSubmitting={true} />);

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  it('should show placeholder text', () => {
    render(<ContactForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    expect(screen.getByPlaceholderText('e.g., John Smith')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g., (555) 123-4567')).toBeInTheDocument();
  });

  it('should render phone format hint', () => {
    render(<ContactForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    expect(screen.getByText(/Any format accepted/)).toBeInTheDocument();
  });

  it('should render required field indicators', () => {
    render(<ContactForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    expect(screen.getByText('Name *')).toBeInTheDocument();
    expect(screen.getByText('Phone Number *')).toBeInTheDocument();
  });

  it('should render Type label', () => {
    render(<ContactForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    expect(screen.getByText('Type')).toBeInTheDocument();
  });

  it('should have form element', () => {
    const { container } = render(<ContactForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    expect(container.querySelector('form')).toBeInTheDocument();
  });

  it('should render name input field', () => {
    render(<ContactForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    expect(screen.getByPlaceholderText('e.g., John Smith')).toHaveAttribute('name', 'name');
  });

  it('should render contact input field', () => {
    render(<ContactForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    expect(screen.getByPlaceholderText('e.g., (555) 123-4567')).toHaveAttribute('name', 'contact');
  });
});
