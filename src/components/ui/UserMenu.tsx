import React, { useState } from 'react';
import { LogIn, LogOut, PlayCircle, RefreshCw, ChevronDown } from 'lucide-react';
import { UserRole } from '../../types';
import { Avatar } from './Avatar';

const ROLE_LABEL: Record<UserRole, string> = {
  student: 'Student',
  technician: 'Maintenance staff',
  admin: 'Admin / Warden',
};

/**
 * Identity + account menu. Students get a route to staff sign-in; staff get a
 * clean sign-out. Admin-only demo tools live behind "Staff tools".
 */
export const UserMenu: React.FC<{
  name: string;
  role: UserRole;
  isStaff: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  onOpenTour?: () => void;
  onResetDemo?: () => void;
  isResetting?: boolean;
}> = ({ name, role, isStaff, onSignIn, onSignOut, onOpenTour, onResetDemo, isResetting = false }) => {
  const [open, setOpen] = useState(false);

  // The public student view has no account — it only offers staff sign-in.
  if (!isStaff) {
    return (
      <button
        type="button"
        onClick={onSignIn}
        className="inline-flex items-center gap-2 rounded-control border border-line bg-surface px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
      >
        <LogIn className="h-4 w-4 text-slate-400" aria-hidden="true" />
        Staff sign in
      </button>
    );
  }

  const isAdmin = role === 'admin';

  const item =
    'flex w-full items-center gap-2.5 rounded-control px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Account menu for ${name}`}
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-control border border-transparent px-1.5 py-1.5 hover:bg-slate-100 transition-colors"
      >
        <Avatar name={name} />
        <span className="hidden text-left leading-tight lg:block">
          <span className="block max-w-[9rem] truncate text-sm font-semibold text-slate-800">
            {name}
          </span>
          <span className="block text-xs text-slate-500">{ROLE_LABEL[role]}</span>
        </span>
        <ChevronDown className="hidden h-4 w-4 text-slate-400 lg:block" aria-hidden="true" />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close account menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
            tabIndex={-1}
          />
          <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-card border border-line bg-surface shadow-card-hover">
            <div className="flex items-center gap-3 border-b border-line px-4 py-3">
              <Avatar name={name} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{name}</p>
                <p className="text-xs text-slate-500">{ROLE_LABEL[role]}</p>
              </div>
            </div>
            <div className="p-1.5">
              {isStaff ? (
                <button
                  type="button"
                  className={item}
                  onClick={() => {
                    setOpen(false);
                    onSignOut();
                  }}
                >
                  <LogOut className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  Sign out
                </button>
              ) : (
                <button
                  type="button"
                  className={item}
                  onClick={() => {
                    setOpen(false);
                    onSignIn();
                  }}
                >
                  <LogIn className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  Staff sign in
                </button>
              )}

              {isAdmin && (onOpenTour || onResetDemo) && (
                <div className="mt-1.5 border-t border-line pt-1.5">
                  <p className="px-3 pt-1 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Staff tools
                  </p>
                  {onOpenTour && (
                    <button
                      type="button"
                      className={item}
                      onClick={() => {
                        setOpen(false);
                        onOpenTour();
                      }}
                    >
                      <PlayCircle className="h-4 w-4 text-slate-400" aria-hidden="true" />
                      Product tour
                    </button>
                  )}
                  {onResetDemo && (
                    <button
                      type="button"
                      className={item}
                      disabled={isResetting}
                      onClick={() => {
                        setOpen(false);
                        onResetDemo();
                      }}
                    >
                      <RefreshCw
                        className={`h-4 w-4 text-slate-400 ${isResetting ? 'animate-spin' : ''}`}
                        aria-hidden="true"
                      />
                      Reset sample data
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
