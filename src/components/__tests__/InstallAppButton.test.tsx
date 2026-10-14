import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InstallAppButton } from '../InstallAppButton';

let standalone = false;
let displayMode: EventTarget;

function offerInstall(outcome: 'accepted' | 'dismissed' = 'accepted', fail = false) {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  const prompt = fail
    ? vi.fn().mockRejectedValue(new Error('Prompt unavailable'))
    : vi.fn().mockResolvedValue(undefined);
  Object.defineProperties(event, {
    prompt: { value: prompt },
    userChoice: { value: Promise.resolve({ outcome }) },
  });
  act(() => { window.dispatchEvent(event); });
  return { event, prompt };
}

beforeEach(() => {
  standalone = false;
  displayMode = Object.defineProperty(new EventTarget(), 'matches', {
    get() { return standalone; },
  });
  vi.stubGlobal('matchMedia', vi.fn(() => displayMode));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('InstallAppButton', () => {
  it('opens the deferred native prompt and hides after installation', async () => {
    render(<InstallAppButton />);
    const { event, prompt } = offerInstall();
    expect(event.defaultPrevented).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Install app' }));
    await waitFor(() => expect(prompt).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Install app' })).toBeEnabled());
    act(() => { window.dispatchEvent(new Event('appinstalled')); });
    expect(screen.queryByRole('button', { name: 'Install app' })).not.toBeInTheDocument();
  });

  it('does not reuse a dismissed prompt and can accept a new one', async () => {
    render(<InstallAppButton />);
    const first = offerInstall('dismissed');
    fireEvent.click(screen.getByRole('button', { name: 'Install app' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Install app' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Install app' }));
    expect(first.prompt).toHaveBeenCalledOnce();
    expect(screen.getByText(/Open your browser menu/)).toBeInTheDocument();
    const second = offerInstall();
    fireEvent.click(screen.getByRole('button', { name: 'Install app' }));
    await waitFor(() => expect(second.prompt).toHaveBeenCalledOnce());
  });

  it('shows and closes manual installation instructions', () => {
    render(<InstallAppButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Install app' }));
    expect(screen.getByText(/Open your browser menu/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Install app' })).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText(/Open your browser menu/)).not.toBeInTheDocument();
  });

  it('shows Safari instructions on iPhone', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('iPhone');
    render(<InstallAppButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Install app' }));
    expect(screen.getByText(/Safari, tap Share, then Add to Home Screen/)).toBeInTheDocument();
  });

  it('hides when already installed in standalone mode', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => Object.assign(new EventTarget(), { matches: true })));
    render(<InstallAppButton />);
    expect(screen.queryByRole('button', { name: 'Install app' })).not.toBeInTheDocument();
  });

  it('reacts to entering standalone mode', () => {
    render(<InstallAppButton />);
    standalone = true;
    act(() => { displayMode.dispatchEvent(new Event('change')); });
    expect(screen.queryByRole('button', { name: 'Install app' })).not.toBeInTheDocument();
  });

  it('reports prompt failures and provides manual installation instructions', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<InstallAppButton />);
    offerInstall('accepted', true);
    fireEvent.click(screen.getByRole('button', { name: 'Install app' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to open the install prompt');
    expect(screen.getByText(/Open your browser menu/)).toBeInTheDocument();
    expect(log).toHaveBeenCalled();
  });
});
