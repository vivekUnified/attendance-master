import { useEffect, useId, useState } from 'react';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isInstallPrompt(event: Event): event is InstallPromptEvent {
  return 'prompt' in event && typeof event.prompt === 'function' && 'userChoice' in event;
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && navigator.standalone === true);
}

export function InstallAppButton() {
  const [installed, setInstalled] = useState(isStandalone);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [error, setError] = useState('');
  const helpId = useId();
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  useEffect(() => {
    const displayMode = window.matchMedia('(display-mode: standalone)');
    function capturePrompt(event: Event) {
      if (!isInstallPrompt(event)) return;
      event.preventDefault();
      setInstallPrompt(event);
      setError('');
      setShowHelp(false);
    }
    function markInstalled() {
      setInstalled(true);
      setInstallPrompt(null);
      setShowHelp(false);
    }
    function updateDisplayMode() {
      setInstalled(isStandalone());
    }
    window.addEventListener('beforeinstallprompt', capturePrompt);
    window.addEventListener('appinstalled', markInstalled);
    displayMode.addEventListener('change', updateDisplayMode);
    return () => {
      window.removeEventListener('beforeinstallprompt', capturePrompt);
      window.removeEventListener('appinstalled', markInstalled);
      displayMode.removeEventListener('change', updateDisplayMode);
    };
  }, []);

  async function install() {
    if (!installPrompt) {
      setShowHelp((visible) => !visible);
      return;
    }
    setInstalling(true);
    setError('');
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
    } catch (cause) {
      console.error('PWA installation failed', cause);
      setError('Unable to open the install prompt. Try installing from your browser menu.');
      setShowHelp(true);
    } finally {
      // A deferred prompt can only be used once, even when dismissed.
      setInstallPrompt(null);
      setInstalling(false);
    }
  }

  if (installed) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => void install()}
        disabled={installing}
        aria-expanded={showHelp}
        aria-controls={showHelp ? helpId : undefined}
        className="rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
      >
        {installing ? 'Installing...' : 'Install app'}
      </button>
      {showHelp && (
        <div
          id={helpId}
          className="absolute right-0 top-full z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm font-normal text-slate-200 shadow-xl"
        >
          <p className="mb-2 font-semibold">Install Attendance Master</p>
          {error && <p role="alert" className="mb-2 text-red-300">{error}</p>}
          <p>
            {isIOS
              ? 'On iPhone or iPad, open this page in Safari, tap Share, then Add to Home Screen and Add.'
              : 'Open your browser menu and choose Install app or Add to Home screen. If unavailable, use Chrome or Edge and wait for the page to finish loading.'}
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Installation requires HTTPS (or localhost). The install option depends on your browser.
          </p>
          <button
            type="button"
            onClick={() => setShowHelp(false)}
            className="mt-3 rounded px-2 py-1 text-cyan-300 hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
