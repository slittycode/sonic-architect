import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /sonic architect/i })).toBeInTheDocument();
  });

  it('shows file size error when uploading a file that exceeds limit', async () => {
    render(<App />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();

    const oversizedFile = new File(['x'], 'big.mp3', { type: 'audio/mpeg' });
    Object.defineProperty(oversizedFile, 'size', { value: 101 * 1024 * 1024 });

    await userEvent.upload(fileInput as HTMLInputElement, oversizedFile);

    expect(screen.getByText(/file size exceeds limit/i)).toBeInTheDocument();
    expect(screen.getByText(/100MB/i)).toBeInTheDocument();
  });

  it('shows invalid file type error when uploading non-audio file', async () => {
    render(<App />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();

    const wrongTypeFile = new File(['x'], 'doc.pdf', { type: 'application/pdf' });

    fireEvent.change(fileInput!, { target: { files: [wrongTypeFile] } });

    expect(await screen.findByText(/invalid file type/i)).toBeInTheDocument();
  });

  it('toggles the AI chat panel from the toolbar', async () => {
    render(<App />);
    const toggle = screen.getByRole('button', { name: /toggle claude chat/i });

    expect(screen.queryByText(/Assistant/i)).not.toBeInTheDocument();
    await userEvent.click(toggle);
    expect(screen.getByText(/Assistant/i)).toBeInTheDocument();

    await userEvent.click(toggle);
    expect(screen.queryByText(/Assistant/i)).not.toBeInTheDocument();
  });
});
