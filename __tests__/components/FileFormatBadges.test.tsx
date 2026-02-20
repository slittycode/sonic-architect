import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import FileFormatBadges from '../../components/FileFormatBadges';

describe('FileFormatBadges', () => {
  it('renders all provided format badges', () => {
    const formats = ['WAV', 'MP3', 'FLAC'];
    render(<FileFormatBadges formats={formats} />);

    expect(screen.getByText('WAV')).toBeInTheDocument();
    expect(screen.getByText('MP3')).toBeInTheDocument();
    expect(screen.getByText('FLAC')).toBeInTheDocument();
  });

  it('renders with standard audio formats', () => {
    const formats = ['WAV', 'MP3', 'FLAC', 'OGG', 'AAC', 'M4A'];
    render(<FileFormatBadges formats={formats} />);

    formats.forEach((format) => {
      expect(screen.getByText(format)).toBeInTheDocument();
    });
  });

  it('renders empty when no formats provided', () => {
    const { container } = render(<FileFormatBadges formats={[]} />);
    const badges = container.querySelectorAll('span');
    expect(badges.length).toBe(0);
  });

  it('applies correct styling classes', () => {
    const formats = ['WAV'];
    const { container } = render(<FileFormatBadges formats={formats} />);

    const badge = screen.getByText('WAV');
    expect(badge).toHaveClass('px-2.5', 'py-1', 'bg-zinc-800', 'text-zinc-400', 'text-xs', 'rounded-full');
  });
});
