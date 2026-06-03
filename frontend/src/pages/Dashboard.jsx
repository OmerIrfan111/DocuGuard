import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api/axiosInstance';

export default function Dashboard() {
  const { user } = useAuth();
  const [health, setHealth] = useState(null);

  useEffect(() => {
    api.get('/health').then((r) => setHealth(r.data)).catch(() => setHealth(null));
  }, []);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-bold text-navy">Dashboard</h1>
        <p className="mt-1 text-slate-500">
          Signed in as <span className="font-medium">{user?.email}</span>
        </p>

        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-2 font-semibold text-slate-700">Phase 1 — Foundation</h2>
          <p className="text-sm text-slate-500">
            Authentication, storage, database and task queue are wired up. Document upload,
            OCR, classification, compliance and reporting arrive in Phases 2–4.
          </p>
          <div className="mt-4 text-sm">
            <span className="font-medium text-slate-600">API health: </span>
            {health ? (
              <span className={health.status === 'ok' ? 'text-green-600' : 'text-amber-600'}>
                {health.status} (mongo: {String(health.services?.mongodb)}, redis:{' '}
                {String(health.services?.redis)})
              </span>
            ) : (
              <span className="text-red-600">unreachable</span>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
