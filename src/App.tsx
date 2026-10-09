import React, { useState, useEffect } from 'react';
import { UserRole, User, Ticket, Department, AuthSession } from './types';
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
import { apiFetch } from './lib/api';
import { Building2, AlertTriangle, RefreshCw } from 'lucide-react';

export function App() {
  const [currentRole, setCurrentRole] = useState<UserRole>('student');
  const [currentUser, setCurrentUser] = useState<User>({
    id: 'u-1',
    name: 'Aarav Patel',
    email: 'aarav.patel@campus.edu',
    role: 'student',
    campusLocation: 'Block B - Oak Hall Room 308',
  });

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Modals state
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const [isRepairModalOpen, setIsRepairModalOpen] = useState(false);
  const [repairTargetTicket, setRepairTargetTicket] = useState<Ticket | null>(null);

  const [isResolutionModalOpen, setIsResolutionModalOpen] = useState(false);
  const [resolutionMode, setResolutionMode] = useState<'confirm' | 'reopen'>('confirm');
  const [resolutionTargetTicket, setResolutionTargetTicket] = useState<Ticket | null>(null);

  const [isDemoWalkthroughOpen, setIsDemoWalkthroughOpen] = useState(false);

  // Staff authentication session (admin / technician). Null = signed out.
  const [staffSession, setStaffSession] = useState<AuthSession | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);

  // Load tickets from server
  const fetchTickets = async () => {
    setLoadError(false);
    try {
      const res = await fetch('/api/tickets');
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = await res.json();
      setTickets(data);
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
        if (res.ok) setStaffSession((await res.json()) as AuthSession);
      } catch {
        /* no active staff session */
      } finally {
        setSessionChecked(true);
      }
    })();
  }, []);

  // Update user representation when role toggles
  const handleRoleChange = (newRole: UserRole) => {
    setCurrentRole(newRole);
    if (newRole === 'student') {
      setCurrentUser({
        id: 'u-1',
        name: 'Aarav Patel',
        email: 'aarav.patel@campus.edu',
        role: 'student',
        campusLocation: 'Block B - Oak Hall Room 308',
      });
    } else if (newRole === 'technician') {
      setCurrentUser({
        id: 'u-2',
        name: 'Marcus Vance',
        email: 'm.vance@campus.edu',
        role: 'technician',
        department: 'Plumbing',
      });
    } else {
      setCurrentUser({
        id: 'u-3',
        name: 'Dr. Evelyn Ward',
        email: 'warden@campus.edu',
        role: 'admin',
      });
    }
  };

  // Establish the authenticated staff session and route to the matching portal.
  const handleSignedIn = (session: AuthSession) => {
    setStaffSession(session);
    setCurrentRole(session.user.role);
    setCurrentUser({
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: session.user.role,
      department: session.user.department as Department | undefined,
    });
  };

  const handleSignOut = async () => {
    try {
      if (staffSession) {
        await apiFetch('/api/auth/logout', { method: 'POST', csrfToken: staffSession.csrfToken });
      }
    } catch {
      /* network failure on logout still clears local state below */
    }
    setStaffSession(null);
    if (currentRole === 'admin') handleRoleChange('student');
  };

  // Reset demo state (admin only)
  const handleResetDemo = async () => {
    if (staffSession?.user.role !== 'admin') return;
    setIsResetting(true);
    try {
      await apiFetch('/api/demo/reset', { method: 'POST', csrfToken: staffSession.csrfToken });
      await fetchTickets();
    } catch (e) {
      console.error(e);
    } finally {
      setIsResetting(false);
    }
  };

  // Start work on ticket
  const handleStartWork = async (ticketId: string) => {
    try {
      const res = await apiFetch(`/api/tickets/${ticketId}/status`, {
        method: 'PUT',
        csrfToken: staffSession?.csrfToken,
        body: JSON.stringify({
          status: 'in_progress',
          actor: currentUser.name,
          role: currentRole,
          notes: 'Technician arrived at site and commenced maintenance work.',
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        if (selectedTicket?.id === updated.id) setSelectedTicket(updated);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Reassign department by admin (requires an authenticated admin session)
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
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Jump to specific ticket & role from the 90s demo walkthrough
  const handleJumpToTicket = (ticketId: string, role: UserRole) => {
    handleRoleChange(role);
    const found = tickets.find((t) => t.id === ticketId);
    if (found) {
      setSelectedTicket(found);
      setIsDetailModalOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col font-sans">
      <Navbar
        currentRole={currentRole}
        setCurrentRole={handleRoleChange}
        currentUser={currentUser}
        staffSession={staffSession}
        onSignOut={handleSignOut}
        onOpenReport={() => setIsReportModalOpen(true)}
        onOpenDemoWalkthrough={() => setIsDemoWalkthroughOpen(true)}
        onResetDemo={handleResetDemo}
        isResetting={isResetting}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center text-slate-500 gap-3">
            <div className="w-8 h-8 rounded-full border-4 border-brand-600 border-t-transparent animate-spin" />
            <span className="text-xs font-semibold">Connecting to CampusCare Facility Engine...</span>
          </div>
        ) : loadError ? (
          <div className="py-24 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-12 h-12 rounded-card bg-critical-50 border border-critical-200 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-critical-600" />
            </div>
            <h2 className="text-sm font-bold text-slate-900">Could not reach the CampusCare server</h2>
            <p className="text-xs text-slate-500 max-w-md">
              Ticket data could not be loaded. Check that the API server is running, then try again.
            </p>
            <button
              onClick={fetchTickets}
              className="mt-1 inline-flex items-center gap-2 px-4 py-2 rounded-control bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
          </div>
        ) : (
          <>
            {currentRole === 'student' && (
              <StudentPortal
                tickets={tickets}
                onOpenReport={() => setIsReportModalOpen(true)}
                onSelectTicket={(t) => {
                  setSelectedTicket(t);
                  setIsDetailModalOpen(true);
                }}
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
            )}

            {currentRole === 'technician' && (
              <MaintenancePortal
                tickets={tickets}
                onSelectTicket={(t) => {
                  setSelectedTicket(t);
                  setIsDetailModalOpen(true);
                }}
                onStartWork={handleStartWork}
                onOpenRepairModal={(t) => {
                  setRepairTargetTicket(t);
                  setIsRepairModalOpen(true);
                }}
              />
            )}

            {currentRole === 'admin' &&
              (!staffSession || staffSession.user.role !== 'admin' ? (
                sessionChecked ? (
                  <StaffSignIn expectedRole="admin" onSignedIn={handleSignedIn} />
                ) : (
                  <div className="py-24 flex flex-col items-center justify-center text-slate-500 gap-3">
                    <div className="w-8 h-8 rounded-full border-4 border-brand-600 border-t-transparent animate-spin" />
                    <span className="text-xs font-semibold">Checking administrator session…</span>
                  </div>
                )
              ) : (
                <AdminDashboard
                  tickets={tickets}
                  csrfToken={staffSession.csrfToken}
                  onSelectTicket={(t) => {
                    setSelectedTicket(t);
                    setIsDetailModalOpen(true);
                  }}
                  onReassignTicket={handleReassignTicket}
                  onRefresh={fetchTickets}
                />
              ))}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-line bg-surface py-6 text-slate-500 text-xs mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-brand-600" />
            <span className="font-bold text-slate-900">CampusCare</span>
            <span className="hidden sm:inline">— Smart campus maintenance &amp; issue-resolution platform</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-slate-400 font-medium">
            <span>Report it • Route it • Resolve it • Verify it</span>
            <span aria-hidden="true">•</span>
            <span>Gemini 3.8 Flash Verification Engine</span>
            <span aria-hidden="true">•</span>
            <span>MIT License</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <StudentReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onTicketCreated={(newTicket) => {
          setTickets((prev) => [newTicket, ...prev]);
          setSelectedTicket(newTicket);
          setIsDetailModalOpen(true);
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
