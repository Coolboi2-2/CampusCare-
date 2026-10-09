import React, { useEffect, useMemo, useState } from 'react';
import { UserRole, User, Ticket, Department, AuthSession, AppNotification } from './types';
import { Navbar } from './components/Navbar';
import { StudentPortal } from './components/StudentPortal';
import { MaintenancePortal } from './components/MaintenancePortal';
import { AdminDashboard } from './components/AdminDashboard';
import { StaffSignIn } from './components/StaffSignIn';
import { StudentReportModal } from './components/StudentReportModal';
import { TicketDetailModal } from './components/TicketDetailModal';
import { RepairCompletionModal } from './components/RepairCompletionModal';
import { StudentResolutionModal } from './components/StudentResolutionModal';
import { DemoWalkthroughModal } from './components/DemoWalkthroughModal';
import { Button } from './components/ui/Button';
import { ToastProvider, useToast } from './components/ui/Toast';
import { apiFetch } from './lib/api';
import { estimateFixTime } from './lib/status';
import { PlusCircle, RefreshCw, WifiOff, ShieldCheck } from 'lucide-react';

/**
 * Notifications are derived from real ticket state so they are never stale.
 * Only signed-in staff get notifications — the public student view has no
 * account, so it shows none.
 */
function deriveNotifications(tickets: Ticket[], role: UserRole): AppNotification[] {
  const items: AppNotification[] = [];
  for (const t of tickets) {
    if (role === 'technician') {
      if (t.status === 'assigned' || t.status === 'in_progress' || t.status === 'reopened') {
        items.push({
          id: `${t.id}:work`,
          title: `Work order ${t.id}`,
          body: `${t.aiAssessment.title} · ${t.location.building}`,
          ticketId: t.id,
          createdAt: t.updatedAt,
          tone: 'info',
        });
      }
    } else if (t.status === 'escalated' || t.aiAssessment?.needsHumanReview) {
      items.push({
        id: `${t.id}:review`,
        title: `${t.id} needs review`,
        body: 'Flagged for human review before it can proceed.',
        ticketId: t.id,
        createdAt: t.updatedAt,
        tone: 'action',
      });
    }
  }
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);
}

function AppShell() {
  const toast = useToast();

  const [currentRole, setCurrentRole] = useState<UserRole>('student');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const [isRepairModalOpen, setIsRepairModalOpen] = useState(false);
  const [repairTargetTicket, setRepairTargetTicket] = useState<Ticket | null>(null);

  const [isResolutionModalOpen, setIsResolutionModalOpen] = useState(false);
  const [resolutionMode, setResolutionMode] = useState<'confirm' | 'reopen'>('confirm');
  const [resolutionTargetTicket, setResolutionTargetTicket] = useState<Ticket | null>(null);

  const [isDemoWalkthroughOpen, setIsDemoWalkthroughOpen] = useState(false);

  const [staffSession, setStaffSession] = useState<AuthSession | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [staffSignInRole, setStaffSignInRole] = useState<'admin' | 'technician' | null>(null);

  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(new Set());

  const currentUser: User | null = staffSession
    ? {
        id: staffSession.user.id,
        name: staffSession.user.name,
        email: staffSession.user.email,
        role: staffSession.user.role,
        department: staffSession.user.department as Department | undefined,
      }
    : null;

  const notifications = useMemo(
    () => (staffSession ? deriveNotifications(tickets, staffSession.user.role) : []),
    [tickets, staffSession]
  );
  const unreadCount = notifications.filter((n) => !readNotificationIds.has(n.id)).length;

  const fetchTickets = async () => {
    setLoadError(false);
    try {
      const res = await fetch('/api/tickets');
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      setTickets(await res.json());
    } catch (e) {
      console.error('Error fetching tickets:', e);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
    (async () => {
      try {
        const res = await apiFetch('/api/auth/session');
        if (res.ok) {
          const session = (await res.json()) as AuthSession;
          setStaffSession(session);
          setCurrentRole(session.user.role);
        }
      } catch {
        /* no active staff session */
      } finally {
        setSessionChecked(true);
      }
    })();
  }, []);

  const handleSignedIn = (session: AuthSession) => {
    setStaffSession(session);
    setCurrentRole(session.user.role);
    setStaffSignInRole(null);
    toast(`Signed in as ${session.user.name}.`, 'success');
  };

  const handleSignOut = async () => {
    try {
      if (staffSession) {
        await apiFetch('/api/auth/logout', {
          method: 'POST',
          csrfToken: staffSession.csrfToken,
        });
      }
    } catch {
      /* network failure on logout still clears local state below */
    }
    setStaffSession(null);
    setCurrentRole('student');
    setStaffSignInRole(null);
    toast('Signed out.', 'info');
  };

  const handleResetDemo = async () => {
    if (staffSession?.user.role !== 'admin') return;
    setIsResetting(true);
    try {
      await apiFetch('/api/demo/reset', { method: 'POST', csrfToken: staffSession.csrfToken });
      await fetchTickets();
      toast('Sample data reset.', 'success');
    } catch (e) {
      console.error(e);
      toast('Could not reset sample data.', 'error');
    } finally {
      setIsResetting(false);
    }
  };

  const handleStartWork = async (ticketId: string) => {
    try {
      const res = await apiFetch(`/api/tickets/${ticketId}/status`, {
        method: 'PUT',
        csrfToken: staffSession?.csrfToken,
        body: JSON.stringify({
          status: 'in_progress',
          actor: currentUser?.name ?? '',
          role: currentRole,
          notes: 'Technician arrived at site and commenced maintenance work.',
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        if (selectedTicket?.id === updated.id) setSelectedTicket(updated);
        toast(`Work started on ${updated.id}.`, 'success');
      }
    } catch (e) {
      console.error(e);
      toast('Could not start work. Please try again.', 'error');
    }
  };

  const handleReassignTicket = async (ticket: Ticket, newDept: Department) => {
    if (staffSession?.user.role !== 'admin') return;
    try {
      const res = await apiFetch(`/api/tickets/${ticket.id}/assign`, {
        method: 'PUT',
        csrfToken: staffSession.csrfToken,
        body: JSON.stringify({ department: newDept }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        toast(`${updated.id} reassigned to ${newDept}.`, 'success');
      }
    } catch (e) {
      console.error(e);
      toast('Could not reassign the ticket.', 'error');
    }
  };

  const openTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setIsDetailModalOpen(true);
  };

  const handleOpenTicketById = (ticketId: string) => {
    const found = tickets.find((t) => t.id === ticketId);
    if (found) openTicket(found);
    const notif = notifications.find((n) => n.ticketId === ticketId);
    if (notif) {
      setReadNotificationIds((prev) => new Set(prev).add(notif.id));
    }
  };

  const handleJumpToTicket = (ticketId: string, role: UserRole) => {
    setCurrentRole(role);
    const found = tickets.find((t) => t.id === ticketId);
    if (found) openTicket(found);
    setIsDemoWalkthroughOpen(false);
  };

  const showStaffSignIn = staffSignInRole !== null;

  return (
    <div className="flex min-h-screen flex-col bg-canvas font-sans">
      <Navbar
        currentRole={currentRole}
        currentUserName={currentUser?.name ?? ''}
        isStaff={Boolean(staffSession)}
        notifications={notifications}
        unreadCount={unreadCount}
        onOpenTicket={handleOpenTicketById}
        onMarkNotificationsRead={() =>
          setReadNotificationIds(new Set(notifications.map((n) => n.id)))
        }
        onOpenStaffSignIn={() => setStaffSignInRole('admin')}
        onSignOut={handleSignOut}
        onOpenDemoWalkthrough={() => setIsDemoWalkthroughOpen(true)}
        onResetDemo={handleResetDemo}
        isResetting={isResetting}
      />

      {showStaffSignIn ? (
        <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 py-8 sm:px-6">
          <div className="mb-2 flex justify-center">
            <div
              role="tablist"
              aria-label="Staff area"
              className="inline-flex rounded-control border border-line bg-surface p-1 shadow-card"
            >
              {(['admin', 'technician'] as const).map((role) => (
                <button
                  key={role}
                  type="button"
                  role="tab"
                  aria-selected={staffSignInRole === role}
                  onClick={() => setStaffSignInRole(role)}
                  className={`rounded-control px-4 py-2 text-sm font-semibold transition-colors ${
                    staffSignInRole === role
                      ? 'bg-brand-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {role === 'admin' ? 'Warden / Admin' : 'Maintenance'}
                </button>
              ))}
            </div>
          </div>
          <StaffSignIn expectedRole={staffSignInRole} onSignedIn={handleSignedIn} />
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setStaffSignInRole(null)}
              className="text-sm font-semibold text-slate-500 hover:text-slate-700"
            >
              Back to student view
            </button>
          </div>
        </main>
      ) : (
        <>
          <main
            className={`mx-auto w-full max-w-[1100px] flex-1 px-4 pt-8 sm:px-6 ${
              currentRole === 'student' ? 'pb-28 sm:pb-12' : 'pb-12'
            }`}
          >
            {loading ? (
              <div className="flex flex-col gap-5" aria-busy="true">
                <div className="h-28 animate-pulse rounded-card border border-line bg-surface" />
                <div className="h-40 animate-pulse rounded-card border border-line bg-surface" />
                <div className="h-40 animate-pulse rounded-card border border-line bg-surface" />
                <span className="sr-only">Loading issues…</span>
              </div>
            ) : loadError ? (
              <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-critical-50 text-critical-600">
                  <WifiOff className="h-6 w-6" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-slate-800">
                    Couldn&rsquo;t load your issues
                  </h2>
                  <p className="mt-1 max-w-md text-sm text-slate-500">
                    Check your connection, then try again. Nothing you submitted has been lost.
                  </p>
                </div>
                <Button onClick={fetchTickets}>
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Try again
                </Button>
              </div>
            ) : currentRole === 'student' ? (
              <StudentPortal
                tickets={tickets}
                onOpenReport={() => setIsReportModalOpen(true)}
                onSelectTicket={openTicket}
                onOpenConfirmModal={(t) => {
                  setResolutionTargetTicket(t);
                  setResolutionMode('confirm');
                  setIsResolutionModalOpen(true);
                }}
                onOpenReopenModal={(t) => {
                  setResolutionTargetTicket(t);
                  setResolutionMode('reopen');
                  setIsResolutionModalOpen(true);
                }}
              />
            ) : currentRole === 'technician' ? (
              staffSession && staffSession.user.role === 'technician' ? (
                <MaintenancePortal
                  tickets={tickets}
                  onSelectTicket={openTicket}
                  onStartWork={handleStartWork}
                  onOpenRepairModal={(t) => {
                    setRepairTargetTicket(t);
                    setIsRepairModalOpen(true);
                  }}
                />
              ) : (
                <StaffSignIn
                  expectedRole="technician"
                  onSignedIn={handleSignedIn}
                />
              )
            ) : !staffSession || staffSession.user.role !== 'admin' ? (
              sessionChecked ? (
                <StaffSignIn expectedRole="admin" onSignedIn={handleSignedIn} />
              ) : (
                <div className="flex items-center justify-center gap-3 py-24 text-slate-500">
                  <span className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
                  <span className="text-sm font-medium">Checking your session…</span>
                </div>
              )
            ) : (
              <AdminDashboard
                tickets={tickets}
                csrfToken={staffSession.csrfToken}
                onSelectTicket={openTicket}
                onReassignTicket={handleReassignTicket}
                onRefresh={fetchTickets}
                onOpenTour={() => setIsDemoWalkthroughOpen(true)}
              />
            )}
          </main>

          {currentRole === 'student' && (
            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 p-3 backdrop-blur sm:hidden">
              <Button
                fullWidth
                size="lg"
                onClick={() => setIsReportModalOpen(true)}
                aria-label="Report an issue"
              >
                <PlusCircle className="h-5 w-5" aria-hidden="true" />
                Report an issue
              </Button>
            </div>
          )}
        </>
      )}

      <footer className="mt-8 border-t border-line bg-surface py-8">
        <div className="mx-auto flex max-w-[1100px] flex-col items-center justify-between gap-3 px-4 text-sm text-slate-500 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand-600" aria-hidden="true" />
            <span className="font-semibold text-slate-700">CampusCare</span>
            <span className="hidden sm:inline">· Campus maintenance service</span>
          </div>
          <p>Photos are only used to resolve your issue.</p>
        </div>
      </footer>

      <StudentReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onTicketCreated={(newTicket) => {
          setTickets((prev) => [newTicket, ...prev]);
          setIsReportModalOpen(false);
          openTicket(newTicket);
          toast(
            `Got it! Ticket ${newTicket.id} sent to ${newTicket.department}. ${estimateFixTime(newTicket)}.`,
            'success'
          );
        }}
      />

      <TicketDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        ticket={selectedTicket}
        currentRole={currentRole}
        onConfirmResolution={(t) => {
          setResolutionTargetTicket(t);
          setResolutionMode('confirm');
          setIsResolutionModalOpen(true);
        }}
        onReopenTicket={(t) => {
          setResolutionTargetTicket(t);
          setResolutionMode('reopen');
          setIsResolutionModalOpen(true);
        }}
        onOpenRepairModal={(t) => {
          setRepairTargetTicket(t);
          setIsRepairModalOpen(true);
        }}
        onStartWork={handleStartWork}
      />

      <RepairCompletionModal
        isOpen={isRepairModalOpen}
        onClose={() => setIsRepairModalOpen(false)}
        ticket={repairTargetTicket}
        role={currentRole}
        onRepairCompleted={(updated) => {
          setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
          setSelectedTicket(updated);
          setIsDetailModalOpen(true);
          toast(`${updated.id} repair submitted for verification.`, 'success');
        }}
      />

      <StudentResolutionModal
        isOpen={isResolutionModalOpen}
        onClose={() => setIsResolutionModalOpen(false)}
        ticket={resolutionTargetTicket}
        mode={resolutionMode}
        role={currentRole}
        onUpdated={(updated) => {
          setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
          setSelectedTicket(updated);
          setIsResolutionModalOpen(false);
          toast(
            updated.status === 'resolved' ? `Thanks for confirming ${updated.id}.` : `${updated.id} reopened.`,
            updated.status === 'resolved' ? 'success' : 'info'
          );
        }}
      />

      <DemoWalkthroughModal
        isOpen={isDemoWalkthroughOpen}
        onClose={() => setIsDemoWalkthroughOpen(false)}
        onJumpToTicket={handleJumpToTicket}
        onRefreshData={fetchTickets}
      />
    </div>
  );
}

export function App() {
  return (
    <ToastProvider>
      <AppShell />
    </ToastProvider>
  );
}
