import React, { useState } from 'react';
import {
  Shield,
  Wrench,
  GraduationCap,
  PlusCircle,
  PlayCircle,
  RefreshCw,
  Building2,
  Menu,
  X,
} from 'lucide-react';
import { UserRole, User } from '../types';

interface NavbarProps {
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  currentUser: User;
  onOpenReport: () => void;
  onOpenDemoWalkthrough: () => void;
  onResetDemo: () => void;
  isResetting: boolean;
}

const PORTALS: {
  role: UserRole;
  label: string;
  short: string;
  icon: React.ComponentType<{ className?: string }>;
  active: string;
}[] = [
  {
    role: 'student',
    label: 'Student Portal',
    short: 'Student',
    icon: GraduationCap,
    active: 'bg-white text-brand-700 shadow-xs',
  },
  {
    role: 'technician',
    label: 'Maintenance Portal',
    short: 'Maintenance',
    icon: Wrench,
    active: 'bg-white text-amber-700 shadow-xs',
  },
  {
    role: 'admin',
    label: 'Admin / Warden',
    short: 'Admin / Warden',
    icon: Shield,
    active: 'bg-white text-accent-700 shadow-xs',
  },
];

export const Navbar: React.FC<NavbarProps> = ({
  currentRole,
  setCurrentRole,
  currentUser,
  onOpenReport,
  onOpenDemoWalkthrough,
  onResetDemo,
  isResetting,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const selectRole = (role: UserRole) => {
    setCurrentRole(role);
    setIsMenuOpen(false);
  };

  const ResetButton = ({ withLabel = false }: { withLabel?: boolean }) => (
    <button
      onClick={onResetDemo}
      disabled={isResetting}
      aria-label="Reset sample tickets to the fresh demo state"
      title="Reset sample tickets to fresh demo state"
      className={`inline-flex items-center justify-center gap-2 rounded-control text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors disabled:opacity-50 ${
        withLabel ? 'px-3 py-2 text-xs font-semibold w-full' : 'p-2'
      }`}
    >
      <RefreshCw className={`w-4 h-4 ${isResetting ? 'animate-spin text-brand-600' : ''}`} />
      {withLabel && <span>Reset demo data</span>}
    </button>
  );

  return (
    <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur-md border-b border-line shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-card bg-gradient-to-tr from-brand-700 via-brand-600 to-accent-600 flex items-center justify-center text-white shadow-md shadow-brand-500/20 shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-slate-900 tracking-tight">CampusCare</span>
                <span className="hidden lg:inline text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-brand-100 text-brand-800 border border-brand-200">
                  AI Issue Resolution
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block font-medium truncate">
                Report it. Route it. Resolve it. Verify it.
              </p>
            </div>
          </div>

          {/* Desktop portal switcher */}
          <nav aria-label="Portal navigation" className="hidden md:flex items-center bg-slate-100 p-1 rounded-card border border-line">
            {PORTALS.map(({ role, label, icon: Icon, active }) => {
              const isActive = currentRole === role;
              return (
                <button
                  key={role}
                  onClick={() => selectRole(role)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-control text-xs font-semibold transition-colors ${
                    isActive ? active : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onOpenDemoWalkthrough}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-gradient-to-r from-brand-600 to-accent-600 hover:from-brand-700 hover:to-accent-700 text-white text-xs font-bold shadow-xs hover:shadow-md transition-all active:scale-95"
              title="Launch the guided 90-second interactive demo"
            >
              <PlayCircle className="w-4 h-4" />
              <span className="hidden lg:inline">90s Demo Tour</span>
              <span className="lg:hidden">90s Demo</span>
            </button>

            <button
              onClick={onOpenReport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-xs transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Report Issue</span>
              <span className="sm:hidden">Report</span>
            </button>

            <div className="hidden md:block">
              <ResetButton />
            </div>

            <button
              onClick={() => setIsMenuOpen((v) => !v)}
              aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={isMenuOpen}
              aria-controls="mobile-menu"
              className="md:hidden p-2 rounded-control text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            >
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div id="mobile-menu" className="md:hidden pb-4 pt-1 border-t border-line space-y-1">
            <p className="px-2 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Switch portal
            </p>
            {PORTALS.map(({ role, short, icon: Icon }) => {
              const isActive = currentRole === role;
              return (
                <button
                  key={role}
                  onClick={() => selectRole(role)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-control text-sm font-semibold transition-colors ${
                    isActive
                      ? 'bg-brand-50 text-brand-700 border border-brand-200'
                      : 'text-slate-700 hover:bg-slate-100 border border-transparent'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{short}</span>
                  {isActive && (
                    <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-brand-600">
                      Active
                    </span>
                  )}
                </button>
              );
            })}

            <div className="pt-2 border-t border-line space-y-1">
              <button
                onClick={() => {
                  onOpenDemoWalkthrough();
                  setIsMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-control text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <PlayCircle className="w-4 h-4 text-accent-600" />
                <span>90-second demo tour</span>
              </button>
              <ResetButton withLabel />
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
