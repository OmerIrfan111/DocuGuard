import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';

export default function AppLayout() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-5 py-7 lg:px-8 lg:py-9">
          <div className="mx-auto w-full max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

// Page heading used across pages.
export function PageHead({ eyebrow, title, sub, actions }) {
  return (
    <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="animate-fade-up">
        {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
        <h1 className="font-display text-[28px] font-semibold leading-tight text-ink">{title}</h1>
        {sub && <p className="mt-1 max-w-xl text-sm text-ink-soft">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
