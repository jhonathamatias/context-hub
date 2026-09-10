import { Link } from '@tanstack/react-router';
import {
  Home,
  Library,
  Search,
  Sparkles,
  Settings,
  Plus,
} from 'lucide-react';

const items = [
  { to: '/', label: 'Início', icon: Home, exact: true },
  { to: '/biblioteca', label: 'Biblioteca', icon: Library, exact: false },
  { to: '/buscar', label: 'Buscar', icon: Search, exact: false },
  { to: '/perguntar', label: 'Usar IA', icon: Sparkles, exact: false },
] as const;

const linkBase =
  'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground';

export function AppSidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-[15rem] shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-4 md:flex">
      <Link to="/" className="mb-5 px-2 pt-1">
        <span className="display-title block text-[1.05rem] leading-tight text-foreground">
          Context Hub
        </span>
        <span className="mt-0.5 block text-[11px] text-muted-foreground">
          Studio de aulas
        </span>
      </Link>

      <Link
        to="/importar"
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
      >
        <Plus className="size-4" /> Adicionar aula
      </Link>

      <nav className="flex flex-col gap-1">
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.exact }}
            className={linkBase}
            activeProps={{
              className: 'bg-sidebar-accent text-sidebar-accent-foreground',
            }}
          >
            <item.icon className="size-[1.05rem] shrink-0" />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-auto border-t border-sidebar-border pt-3">
        <Link
          to="/configuracoes"
          className={linkBase}
          activeProps={{
            className: 'bg-sidebar-accent text-sidebar-accent-foreground',
          }}
        >
          <Settings className="size-[1.05rem] shrink-0" />
          Configurações
        </Link>
      </div>
    </aside>
  );
}

export function MobileNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-sidebar-border bg-sidebar/95 px-2 py-2 backdrop-blur md:hidden">
      {[
        ...items,
        { to: '/configuracoes', label: 'Ajustes', icon: Settings, exact: false },
      ].map((item) => (
        <Link
          key={item.to}
          to={item.to}
          activeOptions={{ exact: item.exact }}
          className="flex min-w-0 flex-col items-center gap-1 rounded-lg px-3 py-1 text-[11px] text-muted-foreground"
          activeProps={{ className: 'text-primary' }}
        >
          <item.icon className="size-5" />
          <span className="truncate">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
