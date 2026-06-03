import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav className="flex items-center justify-between bg-navy px-6 py-3 text-white shadow">
      <div className="text-lg font-bold tracking-wide">DocuGuard</div>
      <div className="flex items-center gap-4 text-sm">
        {user && (
          <>
            <span className="text-blue-200">
              {user.full_name} · <span className="uppercase">{user.role}</span>
            </span>
            <button
              onClick={handleLogout}
              className="rounded bg-white/10 px-3 py-1 hover:bg-white/20"
            >
              Logout
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
