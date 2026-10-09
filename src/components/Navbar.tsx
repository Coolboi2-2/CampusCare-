import React from 'react';
import {
  Shield,
  Wrench,
  GraduationCap,
  Sparkles,
  PlusCircle,
  PlayCircle,
  RefreshCw,
  Building2,
  CheckCircle2,
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

export const Navbar: React.FC<NavbarProps> = ({
  currentRole,
  setCurrentRole,
  currentUser,
  onOpenReport,
  onOpenDemoWalkthrough,
  onResetDemo,
  isResetting,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Tagline */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-slate-900 tracking-tight">CampusCare</span>
                <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                  AI Issue Resolution
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block font-medium">
                Report it. Route it. Resolve it. Verify it.
              </p>
            </div>
          </div>

          {/* Three Role-Based Portals Switcher */}
          <nav className="hidden md:flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80">
            <button
              onClick={() => setCurrentRole('student')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentRole === 'student'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GraduationCap className="w-4 h-4 text-blue-600" />
              <span>Student Portal</span>
            </button>

            <button
              onClick={() => setCurrentRole('technician')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentRole === 'technician'
                  ? 'bg-white text-amber-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Wrench className="w-4 h-4 text-amber-600" />
              <span>Maintenance Portal</span>
            </button>

            <button
              onClick={() => setCurrentRole('admin')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentRole === 'admin'
                  ? 'bg-white text-purple-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Shield className="w-4 h-4 text-purple-600" />
              <span>Admin / Warden</span>
            </button>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* 90-Second Demo Guided Tour */}
            <button
              onClick={onOpenDemoWalkthrough}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-bold shadow-xs hover:shadow-md transition-all active:scale-95"
              title="Launch guided 90-second interactive demo for judges"
            >
              <PlayCircle className="w-4 h-4 text-white" />
              <span className="hidden sm:inline">90s Demo Tour</span>
              <span className="sm:hidden">90s Demo</span>
            </button>

            {/* Quick Report Button */}
            <button
              onClick={onOpenReport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Report Issue</span>
              <span className="sm:hidden">Report</span>
            </button>

            {/* Reset Demo State Button */}
            <button
              onClick={onResetDemo}
              disabled={isResetting}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              title="Reset sample tickets to fresh demo state"
            >
              <RefreshCw className={`w-4 h-4 ${isResetting ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Mobile Portal Navigation Bar */}
        <div className="md:hidden flex items-center justify-around py-2 border-t border-slate-100 text-xs">
          <button
            onClick={() => setCurrentRole('student')}
            className={`flex items-center gap-1 py-1 px-2.5 rounded-lg font-semibold ${
              currentRole === 'student' ? 'bg-blue-50 text-blue-700' : 'text-slate-600'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Student</span>
          </button>
          <button
            onClick={() => setCurrentRole('technician')}
            className={`flex items-center gap-1 py-1 px-2.5 rounded-lg font-semibold ${
              currentRole === 'technician' ? 'bg-amber-50 text-amber-700' : 'text-slate-600'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Technician</span>
          </button>
          <button
            onClick={() => setCurrentRole('admin')}
            className={`flex items-center gap-1 py-1 px-2.5 rounded-lg font-semibold ${
              currentRole === 'admin' ? 'bg-purple-50 text-purple-700' : 'text-slate-600'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Warden</span>
          </button>
        </div>
      </div>
    </header>
  );
};
