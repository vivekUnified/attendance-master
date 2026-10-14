/**
 * Attendance history: date-range filter + user search, with sync status per
 * record when API mode is enabled.
 */
import { useEffect, useMemo, useState } from 'react';
import { EmptyState, LoadingState } from '../components/EmptyState';
import { attendanceService } from '../services/attendanceService';
import { toLocalDateKey, formatDateTime } from '../utils/date';
import type { AttendanceRecord } from '../types';

export function HistoryPage() {
  const [records, setRecords] = useState<AttendanceRecord[] | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const todayKey = useMemo(() => toLocalDateKey(), []);

  useEffect(() => {
    let cancelled = false;
    setRecords(null);
    attendanceService
      .listHistory({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, search: search || undefined })
      .then((data) => {
        if (!cancelled) setRecords(data);
      });
    return () => {
      cancelled = true;
    };
  }, [dateFrom, dateTo, search]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Attendance History</h1>
        <p className="text-sm text-slate-400">Filter by date range or search by name / ID card number.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-slate-900 p-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="date-from" className="text-xs font-medium text-slate-400">
            From
          </label>
          <input
            id="date-from"
            type="date"
            value={dateFrom}
            max={todayKey}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="date-to" className="text-xs font-medium text-slate-400">
            To
          </label>
          <input
            id="date-to"
            type="date"
            value={dateTo}
            max={todayKey}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
          />
        </div>
        <div className="flex min-w-[200px] flex-1 flex-col gap-1">
          <label htmlFor="search" className="text-xs font-medium text-slate-400">
            Search
          </label>
          <input
            id="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or ID card number"
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
          />
        </div>
        {(dateFrom || dateTo || search) && (
          <button
            type="button"
            onClick={() => {
              setDateFrom('');
              setDateTo('');
              setSearch('');
            }}
            className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
          >
            Clear
          </button>
        )}
      </div>

      {records === null && <LoadingState label="Loading history…" />}
      {records && records.length === 0 && (
        <EmptyState title="No attendance records" description="Try adjusting your filters." />
      )}
      {records && records.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">ID card</th>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Time</th>
                <th className="px-4 py-2 font-medium">Source</th>
                <th className="px-4 py-2 font-medium">Sync</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {records.map((record) => (
                <tr key={record.id} className="bg-slate-950/40 text-slate-200">
                  <td className="px-4 py-2">{record.fullName}</td>
                  <td className="px-4 py-2 font-mono text-xs">{record.idCardNumber}</td>
                  <td className="px-4 py-2">{record.attendanceDate}</td>
                  <td className="px-4 py-2">{formatDateTime(record.timestamp)}</td>
                  <td className="px-4 py-2 capitalize">{record.source.replace('-', ' ')}</td>
                  <td className="px-4 py-2">
                    {record.synced ? (
                      <span className="text-emerald-400">Synced</span>
                    ) : (
                      <span className="text-amber-400">Pending</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
