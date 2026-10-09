import React from 'react';
import { GraduationCap, Wrench, Shield } from 'lucide-react';
import { AppNotification, UserRole } from '../types';
import { NotificationBell } from './ui/NotificationBell';
import { UserMenu } from './ui/UserMenu';

interface NavbarProps {
  currentRole: UserRole;
  currentUserName: string;
  isStaff: boolean;
  notifications: AppNotification[];
  unreadCount: number;
  onOpenTicket: (ticketId: string) => void;
  onMarkNotificationsRead: () => void;
  onOpenStaffSignIn: () => void;
  onSignOut: () => void;
  onOpenDemoWalkthrough: () => void;
  onResetDemo: () => void;
  isResetting: boolean;
}

const WORKSPACE: Record<UserRole, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  student: { label: 'My issues', icon: GraduationCap },
  technician: { label: 'Work orders', icon: Wrench },
  admin: { label: 'Dashboard', icon: Shield },
};

export const Navbar: React.FC<NavbarProps> = ({
  currentRole,
  currentUserName,
  isStaff,
  notifications,
  unreadCount,
  onOpenTicket,
  onMarkNotificationsRead,
  onOpenStaffSignIn,
  onSignOut,
  onOpenDemoWalkthrough,
  onResetDemo,
  isResetting,
}) => {
  const { label, icon: Icon } = WORKSPACE[currentRole];

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1100px] items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <img
            src="/logo.png"
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 shrink-0 rounded-control object-contain"
          />
          <div className="min-w-0">
            <p className="text-base font-bold leading-tight tracking-tight text-slate-900">
              CampusCare
            </p>
            <p className="hidden text-xs text-slate-500 sm:block">Campus maintenance service</p>
          </div>
        </div>

        <nav aria-label="Primary navigation" className="hidden items-center md:flex">
          <span
            aria-current="page"
            className="inline-flex items-center gap-2 rounded-control bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700"
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </span>
        </nav>

        <div className="flex items-center gap-1">
          {isStaff && (
            <NotificationBell
              notifications={notifications}
              unreadCount={unreadCount}
              onOpenTicket={onOpenTicket}
              onMarkAllRead={onMarkNotificationsRead}
            />
          )}
          <UserMenu
            name={currentUserName}
            role={currentRole}
            isStaff={isStaff}
            onSignIn={onOpenStaffSignIn}
            onSignOut={onSignOut}
            onOpenTour={currentRole === 'admin' ? onOpenDemoWalkthrough : undefined}
            onResetDemo={currentRole === 'admin' ? onResetDemo : undefined}
            isResetting={isResetting}
          />
        </div>
      </div>
    </header>
  );
};
