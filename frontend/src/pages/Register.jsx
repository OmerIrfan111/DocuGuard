import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { registerUser } from '../api/auth';
import { useAuth } from '../context/AuthContext.jsx';

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: '', email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await registerUser(form);
      await login(form.email, form.password);
      toast.success('Account created!');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-xl bg-white p-8 shadow-lg">
        <h1 className="mb-1 text-2xl font-bold text-navy">Create account</h1>
        <p className="mb-6 text-sm text-slate-500">You will be registered as a reviewer</p>

        <label className="mb-1 block text-sm font-medium text-slate-700">Full name</label>
        <input
          required value={form.full_name} onChange={update('full_name')}
          className="mb-4 w-full rounded border border-slate-300 px-3 py-2 focus:border-accent focus:outline-none"
        />

        <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
        <input
          type="email" required value={form.email} onChange={update('email')}
          className="mb-4 w-full rounded border border-slate-300 px-3 py-2 focus:border-accent focus:outline-none"
        />

        <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
        <input
          type="password" required minLength={8} value={form.password} onChange={update('password')}
          className="mb-6 w-full rounded border border-slate-300 px-3 py-2 focus:border-accent focus:outline-none"
        />

        <button
          type="submit" disabled={submitting}
          className="w-full rounded bg-accent py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {submitting ? 'Creating…' : 'Create Account'}
        </button>

        <p className="mt-4 text-center text-sm text-slate-500">
          Already have an account? <Link to="/login" className="text-accent hover:underline">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
