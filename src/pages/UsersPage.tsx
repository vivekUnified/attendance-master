/**
 * Registered users list with search and active/inactive status toggle.
 */
import { useEffect, useState } from 'react';
import { EmptyState, LoadingState } from '../components/EmptyState';
import { userRepository } from '../services/userRepository';
import { formatDateTime } from '../utils/date';
import type { User } from '../types';

export function UsersPage() {
  const [users, setUsers] = useState<User[] | null>(null);
  const [search, setSearch] = useState('');

  async function reload() {
    const all = await userRepository.listAll();
    setUsers(all);
  }

  useEffect(() => {
    void reload();
  }, []);

  const filtered = users?.filter(
    (u) =>
      u.fullName.toLowerCase().includes(search.toLowerCase()) ||
      u.idCardNumber.toLowerCase().includes(search.toLowerCase()),
  );

  async function toggleActive(user: User) {
    await userRepository.setActive(user.id, !user.active);
    void reload();
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Registered Users</h1>
        <p className="text-sm text-slate-400">Employees and students registered for face recognition.</p>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or ID card number"
        className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
      />

      {users === null && <LoadingState label="Loading users…" />}
      {filtered && filtered.length === 0 && (
        <EmptyState title="No users found" description="Register a new user to get started." />
      )}
      {filtered && filtered.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">ID card</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Registered</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.map((user) => (
                <tr key={user.id} className="bg-slate-950/40 text-slate-200">
                  <td className="px-4 py-2">{user.fullName}</td>
                  <td className="px-4 py-2 font-mono text-xs">{user.idCardNumber}</td>
                  <td className="px-4 py-2 capitalize">{user.userType}</td>
                  <td className="px-4 py-2">{formatDateTime(user.registeredAt)}</td>
                  <td className="px-4 py-2">
                    {user.active ? (
                      <span className="text-emerald-400">Active</span>
                    ) : (
                      <span className="text-slate-500">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => void toggleActive(user)}
                      className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700"
                    >
                      {user.active ? 'Deactivate' : 'Activate'}
                    </button>
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
