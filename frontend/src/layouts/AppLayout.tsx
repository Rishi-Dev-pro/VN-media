import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { pathToView } from '../types/navigation';

/** Wraps every in-app page with the persistent application shell. */
export default function AppLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const view = pathToView(pathname);

  return (
    <AppShell
      view={view}
      onNavigate={(v) => navigate(v === 'home' ? '/' : `/${v}`)}
    >
      <div className="page-enter" key={pathname}>
        <Outlet />
      </div>
    </AppShell>
  );
}
