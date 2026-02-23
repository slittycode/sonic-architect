import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import SessionMusician from '../../components/SessionMusician';

describe('SessionMusician', () => {
  it('renders without crashing given a valid midiResult prop and default state', () => {
    const mockResult = {
      notes: [
        { midi: 60, name: 'C4', frequency: 261.63, startTime: 0, duration: 0.5, velocity: 100, confidence: 1 },
        { midi: 62, name: 'D4', frequency: 293.66, startTime: 0.5, duration: 0.5, velocity: 100, confidence: 1 },
        { midi: 64, name: 'E4', frequency: 329.63, startTime: 1.0, duration: 0.5, velocity: 100, confidence: 1 },
      ],
      confidence: 0.9,
      duration: 2.0,
      bpm: 120
    };
    
    render(<SessionMusician result={mockResult} detecting={false} error={null} fileName="test.wav" />);
    
    const downloadBtn = screen.getByText(/Download \.mid/i);
    expect(downloadBtn).toBeInTheDocument();
  });
});
