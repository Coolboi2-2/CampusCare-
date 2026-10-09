import React, { useState } from 'react';
import { Shield, Mail, Lock, Eye, EyeOff, LogIn, AlertTriangle } from 'lucide-react';
import { AuthSession } from '../types';
import { apiFetch, readApiError } from '../lib/api';
import { Button } from './ui/Button';

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
    <div className="mx-auto max-w-md py-6 sm:py-10">
      <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
        <div className="flex items-center gap-3 border-b border-line px-6 py-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-brand-50 text-brand-700">
            <Shield className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">
              {isAdmin ? 'Admin / Warden sign-in' : 'Maintenance sign-in'}
            </h1>
            <p className="text-sm text-slate-500">
              {isAdmin
                ? 'Restricted operations console. Authorized staff only.'
                : 'Sign in to manage your assigned work orders.'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4 p-6">
          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="flex items-start gap-2 rounded-control border border-critical-200 bg-critical-50 px-3 py-2.5 text-sm font-medium text-critical-700"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label htmlFor="staff-email" className="mb-1.5 block text-sm font-semibold text-slate-700">
              Institutional email
            </label>
            <div className="relative">
              <Mail
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
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
                className="w-full rounded-control border border-line bg-surface py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
              />
            </div>
          </div>

          <div>
            <label htmlFor="staff-password" className="mb-1.5 block text-sm font-semibold text-slate-700">
              Password
            </label>
            <div className="relative">
              <Lock
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
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
                className="w-full rounded-control border border-line bg-surface py-2.5 pl-9 pr-10 text-sm text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-control p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            fullWidth
            size="lg"
            loading={isSubmitting}
            disabled={!email.trim() || !password}
          >
            {!isSubmitting && <LogIn className="h-4 w-4" aria-hidden="true" />}
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>

          <p className="text-center text-xs leading-relaxed text-slate-500">
            Accounts are provisioned by campus IT. There is no public sign-up for staff consoles.
          </p>
        </form>
      </div>
    </div>
  );
};
