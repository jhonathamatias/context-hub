import { Link, NavLink, Outlet } from 'react-router-dom';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded px-3 py-2 text-sm ${
    isActive
      ? 'bg-stone-900 text-white'
      : 'text-stone-700 hover:bg-stone-200'
  }`;

export function AppShell() {
  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-6">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-stone-300 pb-4">
        <Link to="/" className="text-lg font-semibold tracking-tight">
          Context Hub
        </Link>
        <nav className="flex gap-2">
          <NavLink to="/" end className={navClass}>
            Biblioteca
          </NavLink>
          <NavLink to="/upload" className={navClass}>
            Upload
          </NavLink>
          <NavLink to="/chat" className={navClass}>
            Chat
          </NavLink>
        </nav>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
