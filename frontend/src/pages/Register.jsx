import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { registerUser } from '../api/auth';
import { useAuth } from '../context/AuthContext.jsx';
import AuthShell from '../components/AuthShell.jsx';
import Logo from '../components/ui/Logo.jsx';
import Button from '../components/ui/Button.jsx';

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: '', email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await registerUser(form); await login(form.email, form.password);
      toast.success('Account created'); navigate('/dashboard', { replace: true });
    } catch (err) { toast.error(err.response?.data?.detail || 'Registration failed'); } finally { setSubmitting(false); }
  };

  const field = 'w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-brass focus:outline-none focus:ring-4 focus:ring-brass/10 transition';

  return (
    <AuthShell>
      <motion.form initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} onSubmit={submit} className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5 lg:hidden">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-brass-soft"><Logo size={20} /></span>
          <span className="font-display text-xl font-semibold text-ink">DocuGuard</span>
        </div>
        <div className="eyebrow mb-2">Get started</div>
        <h1 className="mb-1 font-display text-3xl font-semibold text-ink">Create account</h1>
        <p className="mb-7 text-sm text-ink-soft">You'll join as a <span className="font-medium text-brass">reviewer</span>.</p>

        <label className="eyebrow mb-1.5 block">Full name</label>
        <input required value={form.full_name} onChange={update('full_name')} className={field + ' mb-4'} placeholder="Jordan Lee" />
        <label className="eyebrow mb-1.5 block">Email</label>
        <input type="email" required value={form.email} onChange={update('email')} className={field + ' mb-4'} placeholder="you@company.com" />
        <label className="eyebrow mb-1.5 block">Password</label>
        <input type="password" required minLength={8} value={form.password} onChange={update('password')} className={field + ' mb-6'} placeholder="At least 8 characters" />

        <Button variant="brass" size="lg" type="submit" loading={submitting} className="w-full">Create account <ArrowRight size={16} /></Button>
        <p className="mt-5 text-center text-sm text-ink-soft">Already registered? <Link to="/login" className="font-medium text-brass hover:underline">Sign in</Link></p>
      </motion.form>
    </AuthShell>
  );
}
