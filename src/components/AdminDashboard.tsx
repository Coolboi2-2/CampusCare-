import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  History,
  Inbox,
  PlayCircle,
  RefreshCw,
  Search,
  SearchX,
  ShieldCheck,
  UserCog,
} from 'lucide-react';
import { Ticket, Department, SecurityEvent } from '../types';
import { apiFetch, readApiError } from '../lib/api';
import {
  StatusBadge,
  PriorityBadge,
  CategoryPill,
  UrgentBadge,
  TicketIdChip,
} from './ui/Badges';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { EmptyState } from './ui/EmptyState';
import { Avatar } from './ui/Avatar';

interface AdminDashboardProps {
  tickets: Ticket[];
  /** CSRF token for authenticated admin mutations (assign, role changes). */
  csrfToken: string;
  onSelectTicket: (ticket: Ticket) => void;
  onReassignTicket: (ticket: Ticket, newDept: Department) => void;
  onRefresh: () => void;
  onOpenTour: () => void;
}

interface StaffRow {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'technician';
  department?: string;
}

const SECURITY_ACTION_LABELS: Record<string, string> = {
  login_success: 'Signed in',
  login_failed: 'Failed sign-in attempt',
  login_rate_limited: 'Rate-limited sign-in',
  logout: 'Signed out',
  access_denied: 'Access denied',
  work_order_assigned: 'Assigned work order',
  work_order_reassigned: 'Reassigned work order',
  staff_role_changed: 'Changed staff role',
  resolution_admin_override: 'Admin resolution override',
  demo_state_reset: 'Reset sample data',
};

/** Internal engine names, shown only inside the admin-only Details disclosure. */
const PROVIDER_LABELS: Record<string, string> = {
  gemma: 'Gemma (live model)',
  fallback: 'Fallback rules (deterministic)',
};

const providerLabel = (provider?: string): string =>
  provider ? PROVIDER_LABELS[provider] ?? provider : 'Not recorded';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  tickets,
  csrfToken,
  onSelectTicket,
  onReassignTicket,
  onRefresh,
  onOpenTour,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [priorityFilter, setPriorityFilter] = useState<string>('All');
  const [audit, setAudit] = useState<SecurityEvent[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [adminError, setAdminError] = useState<string | null>(null);

  const loadAdminData = async () => {
    try {
      const [auditRes, staffRes] = await Promise.all([
        apiFetch('/api/admin/audit?limit=10'),
        apiFetch('/api/admin/users'),
      ]);
      if (auditRes.ok) setAudit((await auditRes.json()) as SecurityEvent[]);
      if (staffRes.ok) setStaff((await staffRes.json()) as StaffRow[]);
    } catch {
      /* audit/roster are supplementary; the ticket table already handles load errors */
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleRefresh = () => {
    onRefresh();
    loadAdminData();
  };

  const changeStaffRole = async (userId: string, role: 'admin' | 'technician') => {
    setAdminError(null);
    try {
      const res = await apiFetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        csrfToken,
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        setAdminError(await readApiError(res, 'Could not change that staff role.'));
        return;
      }
      const updated = (await res.json()) as StaffRow;
      setStaff((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      loadAdminData();
    } catch {
      setAdminError('Could not reach the server to change that role.');
    }
  };

  // Metrics
  const total = tickets.length;
  const active = tickets.filter((t) => t.status !== 'resolved').length;
  const awaitingVerif = tickets.filter((t) => t.status === 'awaiting_verification').length;
  const escalatedOrReview = tickets.filter(
    (t) => t.status === 'escalated' || t.aiAssessment.needsHumanReview
  ).length;
  const critical = tickets.filter((t) => t.isSafetyCritical && t.status !== 'resolved').length;
  const resolved = tickets.filter((t) => t.status === 'resolved').length;
  const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

  // Filtered tickets
  const filtered = tickets.filter((t) => {
    if (deptFilter !== 'All' && t.department !== deptFilter) return false;
    if (statusFilter !== 'All' && t.status !== statusFilter) return false;
    if (priorityFilter !== 'All' && t.aiAssessment.priority !== priorityFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        t.id.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.aiAssessment.title.toLowerCase().includes(q) ||
        t.location.building.toLowerCase().includes(q) ||
        t.location.room.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const departments: Department[] = ['Plumbing', 'Electrical', 'Cleaning', 'Carpentry', 'HVAC', 'General'];

  const kpis: { label: string; value: number | string; hint: string; tone: string }[] = [
    { label: 'Total logged', value: total, hint: 'All campus facilities', tone: 'text-slate-900' },
    { label: 'Active orders', value: active, hint: 'In maintenance queues', tone: 'text-brand-700' },
    { label: 'Awaiting verification', value: awaitingVerif, hint: 'Repairs completed', tone: 'text-confirm-700' },
    { label: 'Human review queue', value: escalatedOrReview, hint: 'Safety or uncertainty', tone: 'text-warning-700' },
    { label: 'Critical issues', value: critical, hint: 'Open safety-critical', tone: 'text-critical-600' },
    {
      label: 'Verified resolution rate',
      value: `${resolutionRate}%`,
      hint: 'Confirmed by students or admin',
      tone: 'text-success-700',
    },
  ];

  const analysisMeta = tickets[0]?.issueAnalysisMetadata;
  const verificationMeta = tickets.find((t) => t.latestVerification)?.latestVerification?.metadata;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Maintenance Operations</h1>
          <p className="mt-1 text-sm text-slate-500">
            Oversight of work orders, department routing, and cases awaiting human sign-off.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleRefresh}
          className="shrink-0 self-start sm:self-auto"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="p-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {kpi.label}
            </span>
            <div className={`mt-1 text-2xl font-bold ${kpi.tone}`}>{kpi.value}</div>
            <span className="text-xs text-slate-400">{kpi.hint}</span>
          </Card>
        ))}
      </div>

      {/* Department workload */}
      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-800">Department load</h2>
          <span className="text-xs text-slate-400">Active work orders by department</span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {departments.map((d) => {
            const count = tickets.filter((t) => t.department === d && t.status !== 'resolved').length;
            const isActive = deptFilter === d;

            return (
              <button
                key={d}
                type="button"
                onClick={() => setDeptFilter(isActive ? 'All' : d)}
                aria-pressed={isActive}
                className={`rounded-control border p-3 text-left transition-colors ${
                  isActive
                    ? 'border-brand-300 bg-brand-50'
                    : 'border-line bg-surface-muted hover:border-brand-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-slate-800">{d}</span>
                  <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">
                    {count}
                  </span>
                </div>
                <div
                  className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200"
                  role="img"
                  aria-label={`${d}: ${count} active ${count === 1 ? 'ticket' : 'tickets'}`}
                >
                  <div
                    className="h-full rounded-full bg-brand-600 transition-all"
                    style={{ width: `${Math.min(100, count * 33)}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Administrative oversight: recent privileged activity + staff roles */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <History className="h-4 w-4 text-slate-500" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-800">Recent administrative activity</h2>
          </div>
          {audit.length === 0 ? (
            <p className="text-sm text-slate-500">No privileged activity recorded yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {audit.map((event) => (
                <li key={event.id} className="flex items-start gap-3 py-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-800">
                      {SECURITY_ACTION_LABELS[event.action] || event.action}
                      {event.detail ? (
                        <span className="font-normal text-slate-500"> — {event.detail}</span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-400">
                      {event.actor} · {new Date(event.timestamp).toLocaleString()}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <UserCog className="h-4 w-4 text-slate-500" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-800">Staff &amp; roles</h2>
          </div>
          {adminError && (
            <p
              role="alert"
              className="mb-2 rounded-control border border-critical-200 bg-critical-50 px-3 py-2 text-sm text-critical-700"
            >
              {adminError}
            </p>
          )}
          <ul className="divide-y divide-line">
            {staff.map((member) => (
              <li key={member.id} className="flex items-center gap-3 py-2.5">
                <Avatar name={member.name} className="h-8 w-8" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-800">{member.name}</div>
                  <div className="truncate text-xs text-slate-500">{member.email}</div>
                </div>
                <label htmlFor={`role-${member.id}`} className="sr-only">
                  Role for {member.name}
                </label>
                <select
                  id={`role-${member.id}`}
                  value={member.role}
                  onChange={(e) => changeStaffRole(member.id, e.target.value as 'admin' | 'technician')}
                  className="rounded-control border border-line bg-surface-muted p-2 text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-brand-500"
                >
                  <option value="technician">Technician</option>
                  <option value="admin">Administrator</option>
                </select>
              </li>
            ))}
            {staff.length === 0 && (
              <li className="py-2 text-sm text-slate-500">No staff accounts configured.</li>
            )}
          </ul>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Only administrators can change staff roles. You cannot remove your own admin access.
          </p>
        </Card>
      </div>

      {/* Filter and ticket table */}
      <Card className="overflow-hidden">
        <h2 className="sr-only">All maintenance tickets</h2>

        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <label htmlFor="admin-search" className="sr-only">
              Search tickets
            </label>
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="admin-search"
              type="text"
              placeholder="Search ID, description, building, or room..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-control border border-line bg-surface-muted py-2 pl-9 pr-3 text-sm focus:border-brand-400 focus:outline-hidden focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
            <div>
              <label htmlFor="admin-dept-filter" className="sr-only">
                Filter by department
              </label>
              <select
                id="admin-dept-filter"
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="w-full rounded-control border border-line bg-surface-muted p-2 font-medium focus:border-brand-400 focus:outline-hidden focus:ring-2 focus:ring-brand-500"
              >
                <option value="All">All Departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="admin-status-filter" className="sr-only">
                Filter by status
              </label>
              <select
                id="admin-status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-control border border-line bg-surface-muted p-2 font-medium focus:border-brand-400 focus:outline-hidden focus:ring-2 focus:ring-brand-500"
              >
                <option value="All">All Statuses</option>
                <option value="reported">Received</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In progress</option>
                <option value="awaiting_verification">Please confirm</option>
                <option value="resolved">Fixed</option>
                <option value="reopened">Reopened</option>
              </select>
            </div>

            <div>
              <label htmlFor="admin-priority-filter" className="sr-only">
                Filter by priority
              </label>
              <select
                id="admin-priority-filter"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full rounded-control border border-line bg-surface-muted p-2 font-medium focus:border-brand-400 focus:outline-hidden focus:ring-2 focus:ring-brand-500"
              >
                <option value="All">All Priorities</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            className="border-0"
            icon={
              tickets.length === 0 ? (
                <Inbox className="h-6 w-6" aria-hidden="true" />
              ) : (
                <SearchX className="h-6 w-6" aria-hidden="true" />
              )
            }
            title={tickets.length === 0 ? 'No tickets logged yet' : 'No tickets match your filters'}
            description={
              tickets.length === 0
                ? 'New maintenance reports will appear here once students submit them.'
                : 'Try clearing the search or changing the department, status, or priority filters.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <caption className="sr-only">
                All maintenance tickets with department, priority, location, status, and technician
              </caption>
              <thead className="border-b border-line bg-surface-muted text-xs text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Ticket &amp; Defect
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Department &amp; Priority
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Campus Location
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Technician
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-slate-700">
                {filtered.map((ticket) => (
                  <tr key={ticket.id} className="transition-colors hover:bg-surface-muted">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <TicketIdChip id={ticket.id} />
                        <span className="max-w-xs truncate font-semibold text-slate-900">
                          {ticket.aiAssessment.title}
                        </span>
                      </div>
                      <span className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                        {ticket.description}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <CategoryPill department={ticket.department} />
                        <PriorityBadge priority={ticket.aiAssessment.priority} />
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{ticket.location.building}</div>
                      <span className="text-xs text-slate-500">{ticket.location.room}</span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge
                          status={ticket.status}
                          pulse={
                            ticket.status === 'awaiting_verification' || ticket.status === 'escalated'
                          }
                        />
                        {ticket.isSafetyCritical && <UrgentBadge />}
                      </div>
                      {ticket.aiAssessment.needsHumanReview && (
                        <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-critical-600">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span>Flagged for human review</span>
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {ticket.assignedTechnician || <span className="text-slate-400">Unassigned</span>}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <label htmlFor={`reassign-${ticket.id}`} className="sr-only">
                          Reassign {ticket.id} department
                        </label>
                        <select
                          id={`reassign-${ticket.id}`}
                          value={ticket.department}
                          onChange={(e) => onReassignTicket(ticket, e.target.value as Department)}
                          title="Reassign department"
                          className="rounded-control border border-line bg-surface-muted p-2 text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-brand-500"
                        >
                          {departments.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                        <Button type="button" variant="secondary" size="sm" onClick={() => onSelectTicket(ticket)}>
                          View details
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Admin-only technical details, collapsed by default. */}
      <details className="rounded-card border border-line bg-surface shadow-card">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-slate-700">
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-slate-400" aria-hidden="true" />
            Details
          </span>
          <span className="text-xs font-normal text-slate-400">Internal</span>
        </summary>
        <div className="space-y-4 border-t border-line px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-control border border-line bg-surface-muted p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                AI-assisted triage
              </p>
              <dl className="mt-2 space-y-1 text-sm text-slate-700">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-slate-500">Provider</dt>
                  <dd className="font-medium">{providerLabel(analysisMeta?.provider)}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-slate-500">Model</dt>
                  <dd className="font-medium">{analysisMeta?.modelId ?? 'Not recorded'}</dd>
                </div>
              </dl>
            </div>
            <div className="rounded-control border border-line bg-surface-muted p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Repair verification engine
              </p>
              <dl className="mt-2 space-y-1 text-sm text-slate-700">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-slate-500">Provider</dt>
                  <dd className="font-medium">{providerLabel(verificationMeta?.provider)}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-slate-500">Model</dt>
                  <dd className="font-medium">{verificationMeta?.modelId ?? 'Not recorded'}</dd>
                </div>
              </dl>
            </div>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={onOpenTour}>
            <PlayCircle className="h-4 w-4" aria-hidden="true" />
            Product tour
          </Button>
        </div>
      </details>
    </div>
  );
};
