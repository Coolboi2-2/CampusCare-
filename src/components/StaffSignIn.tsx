import React, { useState } from 'react';
import { Shield, Mail, Lock, Eye, EyeOff, LogIn, AlertTriangle } from 'lucide-react';
import { AuthSession } from '../types';
import { apiFetch, readApiError } from '../lib/api';

interface StaffSignInProps {
  /** The role this sign-in screen is allowed to enter. */
  expectedRole: 'admin' | 'technician';
  onSignedIn: (session: AuthSession) => void;
}

/**
 * Dedicated staff sign-in experience (Admin / Warden and Maintenance).
 * There is no public registration; accounts are provisioned server-side.
 */
export const StaffSignIn: React.FC<StaffSignInProps> = ({ expectedRole, onSignedIn }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = expectedRole === 'admin';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!res.ok) {
        setError(await readApiError(res, 'Unable to sign in. Please check your credentials.'));
        return;
      }
      const session = (await res.json()) as AuthSession;
      if (session.user.role !== expectedRole) {
        // Invalidate the just-issued session: this account does not belong here.
        await apiFetch('/api/auth/logout', { method: 'POST', csrfToken: session.csrfToken });
        setError(
          isAdmin
            ? 'This account does not have administrator access.'
            : 'This account is not a maintenance account.'
        );
        return;
      }
      setPassword('');
      onSignedIn(session);
    } catch {
      setError('Could not reach the CampusCare server. Check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-10 sm:py-16">
      <div className="bg-surface rounded-card border border-line shadow-card overflow-hidden">
        <div className="bg-navy-900 px-6 py-6 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-card bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-white" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                {isAdmin ? 'Admin / Warden sign-in' : 'Maintenance sign-in'}
              </h1>
              <p className="text-xs text-navy-100">
                {isAdmin
                  ? 'Restricted operations console. Authorized staff only.'
                  : 'Sign in to manage assigned work orders.'}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-4">
          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="flex items-start gap-2 rounded-control border border-critical-200 bg-critical-50 px-3 py-2.5 text-xs text-critical-700 font-medium"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label htmlFor="staff-email" className="block text-xs font-bold text-slate-700 mb-1.5">
              Institutional email
            </label>
            <div className="relative">
              <Mail
                className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="staff-email"
                name="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isAdmin ? 'warden@campus.edu' : 'technician@campus.edu'}
                className="w-full text-sm pl-9 pr-3 py-2.5 bg-surface-muted border border-line rounded-control focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:border-brand-400"
              />
            </div>
          </div>

          <div>
            <label htmlFor="staff-password" className="block text-xs font-bold text-slate-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock
                className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="staff-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-sm pl-9 pr-10 py-2.5 bg-surface-muted border border-line rounded-control focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:border-brand-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-control text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !email.trim() || !password}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-control bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold shadow-card transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <LogIn className="w-4 h-4" aria-hidden="true" />
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="text-[11px] text-slate-500 text-center leading-relaxed">
            Accounts are provisioned by campus IT. There is no public sign-up for staff consoles.
          </p>
        </form>
      </div>
    </div>
  );
};
