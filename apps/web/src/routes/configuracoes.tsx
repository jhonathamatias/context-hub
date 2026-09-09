import { Outlet, createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/configuracoes')({
  component: ConfiguracoesLayout,
});

/** Layout required so nested `/configuracoes/onedrive` can render via Outlet. */
function ConfiguracoesLayout() {
  return <Outlet />;
}
