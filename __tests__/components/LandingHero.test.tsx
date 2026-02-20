import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LandingHero from '../../components/LandingHero';

describe('LandingHero', () => {
  it('renders in expanded state when isMinimized is false', () => {
    const onDismiss = vi.fn();
    render(<LandingHero isMinimized={false} onDismiss={onDismiss} />);

    expect(screen.getByText(/Deconstruct Any Track into an/i)).toBeInTheDocument();
    expect(screen.getByText(/Ableton Live Blueprint/i)).toBeInTheDocument();
    expect(screen.getByText(/Local Analysis/i)).toBeInTheDocument();
    expect(screen.getByText(/MIDI Transcription/i)).toBeInTheDocument();
    expect(screen.getByText(/Ableton Blueprint/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument();
  });

  it('renders in minimized state when isMinimized is true', () => {
    const onDismiss = vi.fn();
    render(<LandingHero isMinimized={true} onDismiss={onDismiss} />);

    expect(screen.getByText(/Deconstruct Any Track into an Ableton Live Blueprint/i)).toBeInTheDocument();
    expect(screen.queryByText(/Local Analysis/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /get started/i })).not.toBeInTheDocument();
  });

  it('toggles between expanded and minimized states', () => {
    const onDismiss = vi.fn();
    const { rerender } = render(<LandingHero isMinimized={false} onDismiss={onDismiss} />);

    // Initially expanded
    expect(screen.getByText(/Local Analysis/i)).toBeInTheDocument();

    // Click minimize button
    const minimizeButton = screen.getByLabelText(/minimize hero section/i);
    fireEvent.click(minimizeButton);

    // Should still show expanded content (component manages its own state)
    expect(screen.queryByText(/Local Analysis/i)).not.toBeInTheDocument();

    // Click expand button
    const expandButton = screen.getByLabelText(/expand hero section/i);
    fireEvent.click(expandButton);

    // Should show expanded content again
    expect(screen.getByText(/Local Analysis/i)).toBeInTheDocument();
  });

  it('displays all three feature highlights in expanded state', () => {
    const onDismiss = vi.fn();
    render(<LandingHero isMinimized={false} onDismiss={onDismiss} />);

    expect(screen.getByText(/Local Analysis/i)).toBeInTheDocument();
    expect(screen.getByText(/No API keys, works offline/i)).toBeInTheDocument();

    expect(screen.getByText(/MIDI Transcription/i)).toBeInTheDocument();
    expect(screen.getByText(/Audio to MIDI conversion/i)).toBeInTheDocument();

    expect(screen.getByText(/Ableton Blueprint/i)).toBeInTheDocument();
    expect(screen.getByText(/Complete device chain reconstruction/i)).toBeInTheDocument();
  });

  it('has accessible expand/minimize buttons', () => {
    const onDismiss = vi.fn();
    const { rerender } = render(<LandingHero isMinimized={false} onDismiss={onDismiss} />);

    const minimizeButton = screen.getByLabelText(/minimize hero section/i);
    expect(minimizeButton).toBeInTheDocument();

    fireEvent.click(minimizeButton);

    const expandButton = screen.getByLabelText(/expand hero section/i);
    expect(expandButton).toBeInTheDocument();
  });

  it('updates when isMinimized prop changes', () => {
    const onDismiss = vi.fn();
    const { rerender } = render(<LandingHero isMinimized={false} onDismiss={onDismiss} />);

    expect(screen.getByText(/Local Analysis/i)).toBeInTheDocument();

    rerender(<LandingHero isMinimized={true} onDismiss={onDismiss} />);

    expect(screen.queryByText(/Local Analysis/i)).not.toBeInTheDocument();
  });
});
