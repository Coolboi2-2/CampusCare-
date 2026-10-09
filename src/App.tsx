import React, { useState, useEffect } from 'react';
import { UserRole, User, Ticket, Department } from './types';
import { Navbar } from './components/Navbar';
import { StudentPortal } from './components/StudentPortal';
import { MaintenancePortal } from './components/MaintenancePortal';
import { AdminDashboard } from './components/AdminDashboard';
import { StudentReportModal } from './components/StudentReportModal';
import { TicketDetailModal } from './components/TicketDetailModal';
import { RepairCompletionModal } from './components/RepairCompletionModal';
import { StudentResolutionModal } from './components/StudentResolutionModal';
import { DemoWalkthroughModal } from './components/DemoWalkthroughModal';
import { Building2, Sparkles, CheckCircle2 } from 'lucide-react';

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

  // Load tickets from server
  const fetchTickets = async () => {
    try {
      const res = await fetch('/api/tickets');
      if (res.ok) {
        const data = await res.json();
        setTickets(data);
      }
    } catch (e) {
      console.error('Error fetching tickets:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
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

  // Reset demo state
  const handleResetDemo = async () => {
    setIsResetting(true);
    try {
      await fetch('/api/demo/reset', { method: 'POST' });
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
      const res = await fetch(`/api/tickets/${ticketId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'in_progress',
          actor: currentUser.name,
          role: 'technician',
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

  // Reassign department by admin
  const handleReassignTicket = async (ticket: Ticket, newDept: Department) => {
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/assign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar
        currentRole={currentRole}
        setCurrentRole={handleRoleChange}
        currentUser={currentUser}
        onOpenReport={() => setIsReportModalOpen(true)}
        onOpenDemoWalkthrough={() => setIsDemoWalkthroughOpen(true)}
        onResetDemo={handleResetDemo}
        isResetting={isResetting}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center text-slate-500 gap-3">
            <div className="w-8 h-8 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
            <span className="text-xs font-semibold">Connecting to CampusCare Facility Engine...</span>
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

            {currentRole === 'admin' && (
              <AdminDashboard
                tickets={tickets}
                onSelectTicket={(t) => {
                  setSelectedTicket(t);
                  setIsDetailModalOpen(true);
                }}
                onReassignTicket={handleReassignTicket}
                onRefresh={fetchTickets}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-slate-500 text-xs mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-600" />
            <span className="font-bold text-slate-900">CampusCare</span>
            <span>— Smart campus maintenance & issue-resolution platform</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400 font-medium">
            <span>Report it • Route it • Resolve it • Verify it</span>
            <span>•</span>
            <span>Gemma 4 Verification Engine</span>
            <span>•</span>
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
