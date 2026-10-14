import { NavLink } from 'react-router-dom';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { InstallAppButton } from './InstallAppButton';

const LINKS = [
  { to: '/', label: 'Attendance' },
  { to: '/register', label: 'Register' },
  { to: '/history', label: 'History' },
  { to: '/users', label: 'Users' },
  { to: '/settings', label: 'Settings' },
];

export function NavBar() {
  const online = useOnlineStatus();
  const { pendingCount } = useSyncStatus();

  return (
    <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2 text-slate-100">
          <span className="text-lg font-semibold">Attendance Master</span>
        </div>

        <nav className="flex flex-wrap gap-1 text-sm">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                `rounded-lg px-3 py-1.5 font-medium transition-colors ${
                  isActive
                    ? 'bg-cyan-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2 text-xs font-medium">
          <InstallAppButton />
          <span
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
              online ? 'bg-emerald-900/50 text-emerald-300' : 'bg-amber-900/50 text-amber-300'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${online ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            {online ? 'Online' : 'Offline'}
          </span>
          {pendingCount > 0 && (
            <span className="rounded-full bg-sky-900/50 px-2.5 py-1 text-sky-300">
              {pendingCount} pending sync
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
