import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BlueprintNavigation from '../../components/BlueprintNavigation';

describe('BlueprintNavigation', () => {
  it('renders all five navigation sections', () => {
    const onNavigate = vi.fn();
    render(<BlueprintNavigation onNavigate={onNavigate} />);

    expect(screen.getByLabelText(/navigate to telemetry/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/navigate to arrangement/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/navigate to instruments/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/navigate to fx/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/navigate to secret sauce/i)).toBeInTheDocument();
  });

  it('calls onNavigate with correct section id when clicked', () => {
    const onNavigate = vi.fn();
    render(<BlueprintNavigation onNavigate={onNavigate} />);

    const telemetryButton = screen.getByLabelText(/navigate to telemetry/i);
    fireEvent.click(telemetryButton);

    expect(onNavigate).toHaveBeenCalledWith('telemetry');
  });

  it('highlights the active section', () => {
    const onNavigate = vi.fn();
    render(<BlueprintNavigation onNavigate={onNavigate} />);

    const telemetryButton = screen.getByLabelText(/navigate to telemetry/i);
    
    // Telemetry should be active by default
    expect(telemetryButton).toHaveClass('bg-blue-600');
  });

  it('updates active section when different section is clicked', () => {
    const onNavigate = vi.fn();
    render(<BlueprintNavigation onNavigate={onNavigate} />);

    const fxButton = screen.getByLabelText(/navigate to fx/i);
    fireEvent.click(fxButton);

    expect(onNavigate).toHaveBeenCalledWith('fx');
    expect(fxButton).toHaveClass('bg-blue-600');
  });

  it('has minimum 44px tap targets for mobile accessibility', () => {
    const onNavigate = vi.fn();
    render(<BlueprintNavigation onNavigate={onNavigate} />);

    const buttons = screen.getAllByRole('button');
    buttons.forEach((button) => {
      expect(button).toHaveClass('min-h-[44px]');
    });
  });

  it('displays section labels on larger screens', () => {
    const onNavigate = vi.fn();
    render(<BlueprintNavigation onNavigate={onNavigate} />);

    // Labels should be hidden on mobile (hidden) and shown on sm+ (sm:inline)
    const telemetryLabel = screen.getByText('Telemetry');
    expect(telemetryLabel).toHaveClass('hidden', 'sm:inline');
  });
});
