import React, { useState } from 'react';
import { Bell, CheckCheck, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { AppNotification } from '../../types';
import { formatRelative } from '../../lib/status';

const TONE_ICON = {
  info: <Info className="h-4 w-4 text-brand-600" aria-hidden="true" />,
  action: <AlertTriangle className="h-4 w-4 text-warning-600" aria-hidden="true" />,
  success: <CheckCircle2 className="h-4 w-4 text-success-600" aria-hidden="true" />,
} as const;

/**
 * In-app notification bell. Notifications are derived from ticket activity,
 * so the badge always reflects real, actionable work.
 */
export const NotificationBell: React.FC<{
  notifications: AppNotification[];
  unreadCount: number;
  onOpenTicket: (ticketId: string) => void;
  onMarkAllRead: () => void;
}> = ({ notifications, unreadCount, onOpenTicket, onMarkAllRead }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={open}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-control text-slate-600 hover:bg-slate-100 transition-colors"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-critical-600 px-1 text-[11px] font-semibold leading-5 text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close notifications"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
            tabIndex={-1}
          />
          <div className="absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-card border border-line bg-surface shadow-card-hover">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-800">Notifications</h2>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={onMarkAllRead}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800"
                >
                  <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  Mark all read
                </button>
              )}
            </div>
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">
                You&rsquo;re all caught up.
              </p>
            ) : (
              <ul className="max-h-80 divide-y divide-line overflow-y-auto">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (n.ticketId) onOpenTicket(n.ticketId);
                        setOpen(false);
                      }}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                    >
                      <span className="mt-0.5 shrink-0">{TONE_ICON[n.tone]}</span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-800">{n.title}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">{n.body}</span>
                        <span className="mt-1 block text-xs text-slate-400">
                          {formatRelative(n.createdAt)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
};
