/**
 * Application settings: recognition threshold, duplicate-attendance rule,
 * registration password, and data mode (sqlite/api) configuration.
 */
import { useEffect, useState } from 'react';
import { StatusBanner } from '../components/StatusBanner';
import { LoadingState } from '../components/EmptyState';
import { settingsRepository } from '../services/settingsRepository';
import { syncService } from '../services/syncService';
import { resetDb, flushDb } from '../db/sqlite';
import type { AppSettings } from '../types';

export function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void settingsRepository.get().then(setSettings);
  }, []);

  async function save(partial: Partial<AppSettings>) {
    const updated = await settingsRepository.update(partial);
    setSettings(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    if (updated.dataMode === 'api') void syncService.runSync();
  }

  async function handleReset() {
    const confirmed = window.confirm(
      'This permanently deletes all registered users, attendance history, and settings on this device. Continue?',
    );
    if (!confirmed) return;
    await flushDb();
    await resetDb();
    window.location.reload();
  }

  if (!settings) return <LoadingState label="Loading settings…" />;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Settings</h1>
        <p className="text-sm text-slate-400">
          Configure attendance validation rules, recognition sensitivity, and data mode.
        </p>
      </div>

      {saved && <StatusBanner kind="success">Settings saved.</StatusBanner>}

      <section className="flex flex-col gap-3 rounded-2xl bg-slate-900 p-5">
        <h2 className="text-lg font-medium text-white">Recognition</h2>
        <label className="flex flex-col gap-1 text-sm text-slate-200">
          Minimum descriptor match score: {Math.round(settings.recognitionThreshold * 100)}%
          <input
            type="range"
            min={0.75}
            max={0.99}
            step={0.01}
            value={settings.recognitionThreshold}
            onChange={(e) => setSettings({ ...settings, recognitionThreshold: Number(e.target.value) })}
            onMouseUp={() => void save({ recognitionThreshold: settings.recognitionThreshold })}
            onTouchEnd={() => void save({ recognitionThreshold: settings.recognitionThreshold })}
          />
          <span className="text-xs text-slate-500">
            Higher values require a closer match, reducing false accepts but increasing false rejects.
            This score is not a probability. The default 75% allows a descriptor distance of at most 0.5.
          </span>
        </label>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl bg-slate-900 p-5">
        <h2 className="text-lg font-medium text-white">Attendance rules</h2>
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={settings.allowMultipleAttendancePerDay}
            onChange={(e) => void save({ allowMultipleAttendancePerDay: e.target.checked })}
          />
          Allow multiple attendance entries per user per day
        </label>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl bg-slate-900 p-5">
        <h2 className="text-lg font-medium text-white">Registration password</h2>
        <PasswordField
          current={settings.registrationPassword}
          onSave={(value) => void save({ registrationPassword: value })}
        />
        <p className="text-xs text-amber-400">
          Development-only credential. Replace with a secure authentication system before production use.
        </p>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl bg-slate-900 p-5">
        <h2 className="text-lg font-medium text-white">Data mode</h2>
        <label className="flex flex-col gap-1 text-sm text-slate-200">
          Mode
          <select
            value={settings.dataMode}
            onChange={(e) => void save({ dataMode: e.target.value as AppSettings['dataMode'] })}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
          >
            <option value="sqlite">SQLite (offline-first, local only)</option>
            <option value="api">API (sync to backend when online)</option>
          </select>
        </label>
        {settings.dataMode === 'api' && (
          <label className="flex flex-col gap-1 text-sm text-slate-200">
            API base URL
            <input
              value={settings.apiBaseUrl ?? ''}
              onChange={(e) => setSettings({ ...settings, apiBaseUrl: e.target.value })}
              onBlur={() => void save({ apiBaseUrl: settings.apiBaseUrl })}
              placeholder="https://api.example.com"
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
            />
          </label>
        )}
        <p className="text-xs text-slate-500">
          All data is always written to the local offline database first. In API mode, records are queued
          and synchronized to the backend automatically when connectivity is available.
        </p>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl bg-slate-900 p-5">
        <h2 className="text-lg font-medium text-white">Danger zone</h2>
        <p className="text-sm text-slate-400">
          Permanently deletes every registered user, attendance record, and setting stored on this device.
        </p>
        <button
          type="button"
          onClick={() => void handleReset()}
          className="self-start rounded-lg bg-rose-900/60 px-4 py-2 text-sm font-medium text-rose-200 hover:bg-rose-900"
        >
          Reset local database
        </button>
      </section>
    </div>
  );
}

function PasswordField({ current, onSave }: { current: string; onSave: (value: string) => void }) {
  const [value, setValue] = useState(current);
  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
      />
      <button
        type="button"
        onClick={() => onSave(value)}
        className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500"
      >
        Save
      </button>
    </div>
  );
}
