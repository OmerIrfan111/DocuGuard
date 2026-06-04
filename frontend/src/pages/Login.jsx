import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import AuthShell from '../components/AuthShell.jsx';
import Logo from '../components/ui/Logo.jsx';
import Button from '../components/ui/Button.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const from = location.state?.from?.pathname || '/dashboard';

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try { await login(email, password); toast.success('Welcome back'); navigate(from, { replace: true }); }
    catch (err) { toast.error(err.response?.data?.detail || 'Login failed'); } finally { setSubmitting(false); }
  };

  const field = 'w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-brass focus:outline-none focus:ring-4 focus:ring-brass/10 transition';

  return (
    <AuthShell>
      <motion.form initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} onSubmit={submit} className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5 lg:hidden">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-brass-soft"><Logo size={20} /></span>
          <span className="font-display text-xl font-semibold text-ink">DocuGuard</span>
        </div>
        <div className="eyebrow mb-2">Secure access</div>
        <h1 className="mb-1 font-display text-3xl font-semibold text-ink">Sign in</h1>
        <p className="mb-7 text-sm text-ink-soft">Continue to your compliance workspace.</p>

        <label className="eyebrow mb-1.5 block">Email</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={field + ' mb-4'} placeholder="you@company.com" />
        <label className="eyebrow mb-1.5 block">Password</label>
        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={field + ' mb-6'} placeholder="••••••••" />

        <Button variant="brass" size="lg" type="submit" loading={submitting} className="w-full">Sign in <ArrowRight size={16} /></Button>
        <p className="mt-5 text-center text-sm text-ink-soft">No account? <Link to="/register" className="font-medium text-brass hover:underline">Create one</Link></p>
      </motion.form>
    </AuthShell>
  );
}
