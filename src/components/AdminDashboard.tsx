import React, { useState } from 'react';
import { AlertTriangle, Inbox, RefreshCw, Search, SearchX } from 'lucide-react';
import { Ticket, Department } from '../types';
import {
  StatusBadge,
  PriorityBadge,
  TicketIdChip,
  SafetyBadge,
} from './ui/Badges';

interface AdminDashboardProps {
  tickets: Ticket[];
  onSelectTicket: (ticket: Ticket) => void;
  onReassignTicket: (ticket: Ticket, newDept: Department) => void;
  onRefresh: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  tickets,
  onSelectTicket,
  onReassignTicket,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [priorityFilter, setPriorityFilter] = useState<string>('All');

  // Metrics
  const total = tickets.length;
  const active = tickets.filter((t) => t.status !== 'resolved').length;
  const awaitingVerif = tickets.filter((t) => t.status === 'awaiting_verification').length;
  const escalatedOrReview = tickets.filter(
    (t) => t.status === 'escalated' || t.aiAssessment.needsHumanReview
  ).length;
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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
            Maintenance Operations
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Oversight of work orders, department routing, and AI cases awaiting human sign-off.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-control border border-line bg-surface hover:bg-surface-muted text-slate-700 text-xs font-semibold shadow-card transition-colors shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-surface rounded-card border border-line shadow-card p-4">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Total Logged
          </span>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">{total}</div>
          <span className="text-[11px] text-slate-400">All campus facilities</span>
        </div>

        <div className="bg-surface rounded-card border border-line shadow-card p-4">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Active Orders
          </span>
          <div className="text-2xl font-extrabold text-brand-600 mt-1">{active}</div>
          <span className="text-[11px] text-brand-500">In maintenance queues</span>
        </div>

        <div className="bg-surface rounded-card border border-line shadow-card p-4">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Awaiting Verification
          </span>
          <div className="text-2xl font-extrabold text-accent-600 mt-1">{awaitingVerif}</div>
          <span className="text-[11px] text-accent-600">Repairs completed</span>
        </div>

        <div className="bg-surface rounded-card border border-line shadow-card p-4">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Human Review Queue
          </span>
          <div className="text-2xl font-extrabold text-rose-600 mt-1">{escalatedOrReview}</div>
          <span className="text-[11px] text-rose-500">Safety / uncertainty</span>
        </div>

        <div className="bg-surface rounded-card border border-line shadow-card p-4 col-span-2 sm:col-span-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Verified Resolution Rate
          </span>
          <div className="text-2xl font-extrabold text-emerald-600 mt-1">{resolutionRate}%</div>
          <span className="text-[11px] text-emerald-600">Confirmed by students or admin</span>
        </div>
      </div>

      {/* Department Workload Distribution */}
      <div className="bg-surface rounded-card border border-line shadow-card p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Department Load & Ticket Distribution
          </h2>
          <span className="text-xs text-slate-400">Active work orders by department</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {departments.map((d) => {
            const count = tickets.filter((t) => t.department === d && t.status !== 'resolved').length;
            const isActive = deptFilter === d;

            return (
              <button
                key={d}
                type="button"
                onClick={() => setDeptFilter(isActive ? 'All' : d)}
                aria-pressed={isActive}
                className={`text-left p-3 rounded-control border transition-all ${
                  isActive
                    ? 'border-accent-400 bg-accent-50 shadow-card'
                    : 'border-line bg-surface-muted hover:border-accent-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-slate-800">{d}</span>
                  <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-accent-100 text-accent-700">
                    {count}
                  </span>
                </div>
                <div
                  className="mt-2 w-full bg-slate-200 h-1.5 rounded-full overflow-hidden"
                  role="img"
                  aria-label={`${d}: ${count} active ${count === 1 ? 'ticket' : 'tickets'}`}
                >
                  <div
                    className="bg-accent-600 h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, count * 33)}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter and Master Table */}
      <div className="bg-surface rounded-card border border-line shadow-card overflow-hidden">
        <h2 className="sr-only">All maintenance tickets</h2>

        {/* Controls */}
        <div className="p-4 border-b border-line flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1 min-w-0">
            <label htmlFor="admin-search" className="sr-only">
              Search tickets
            </label>
            <Search
              className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="admin-search"
              type="text"
              placeholder="Search ID, description, building, or room..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2 bg-surface-muted border border-line rounded-control focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:border-brand-400"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div>
              <label htmlFor="admin-dept-filter" className="sr-only">
                Filter by department
              </label>
              <select
                id="admin-dept-filter"
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="w-full p-2 bg-surface-muted border border-line rounded-control font-medium focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:border-brand-400"
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
                className="w-full p-2 bg-surface-muted border border-line rounded-control font-medium focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:border-brand-400"
              >
                <option value="All">All Statuses</option>
                <option value="reported">Reported</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="awaiting_verification">Awaiting Verification</option>
                <option value="resolved">Resolved</option>
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
                className="w-full p-2 bg-surface-muted border border-line rounded-control font-medium focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:border-brand-400"
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

        {/* Master Table / Empty State */}
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            {tickets.length === 0 ? (
              <Inbox className="w-10 h-10 mx-auto text-slate-300 mb-2" aria-hidden="true" />
            ) : (
              <SearchX className="w-10 h-10 mx-auto text-slate-300 mb-2" aria-hidden="true" />
            )}
            <h3 className="font-bold text-slate-800 text-sm">
              {tickets.length === 0 ? 'No tickets logged yet' : 'No tickets match your filters'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {tickets.length === 0
                ? 'New maintenance reports will appear here once students submit them.'
                : 'Try clearing the search or changing the department, status, or priority filters.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[720px]">
              <caption className="sr-only">
                All maintenance tickets with department, priority, location, status, and technician
              </caption>
              <thead className="bg-surface-muted text-slate-600 font-bold border-b border-line">
                <tr>
                  <th scope="col" className="py-3 px-4">
                    Ticket &amp; Defect
                  </th>
                  <th scope="col" className="py-3 px-4">
                    Department &amp; Priority
                  </th>
                  <th scope="col" className="py-3 px-4">
                    Campus Location
                  </th>
                  <th scope="col" className="py-3 px-4">
                    Status &amp; AI Check
                  </th>
                  <th scope="col" className="py-3 px-4">
                    Technician
                  </th>
                  <th scope="col" className="py-3 px-4 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-slate-700">
                {filtered.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-surface-muted transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <TicketIdChip id={ticket.id} />
                        <span className="font-semibold text-slate-900 truncate max-w-xs">
                          {ticket.aiAssessment.title}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                        {ticket.description}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-slate-800">{ticket.department}</span>
                        <PriorityBadge priority={ticket.aiAssessment.priority} />
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">{ticket.location.building}</div>
                      <span className="text-[11px] text-slate-500">{ticket.location.room}</span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge
                          status={ticket.status}
                          pulse={
                            ticket.status === 'awaiting_verification' || ticket.status === 'escalated'
                          }
                        />
                        {ticket.isSafetyCritical && <SafetyBadge />}
                      </div>
                      {ticket.aiAssessment.needsHumanReview && (
                        <div className="text-[10px] text-rose-600 font-bold flex items-center gap-0.5 mt-1">
                          <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden="true" />
                          <span>Flagged for human review</span>
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4 text-slate-600">
                      {ticket.assignedTechnician || <span className="text-slate-400">Unassigned</span>}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <label htmlFor={`reassign-${ticket.id}`} className="sr-only">
                          Reassign {ticket.id} department
                        </label>
                        <select
                          id={`reassign-${ticket.id}`}
                          value={ticket.department}
                          onChange={(e) => onReassignTicket(ticket, e.target.value as Department)}
                          title="Reassign department"
                          className="p-1.5 bg-surface-muted border border-line rounded-control text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-brand-500"
                        >
                          {departments.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => onSelectTicket(ticket)}
                          className="px-2.5 py-1 bg-surface-muted hover:bg-brand-50 text-brand-700 border border-line font-semibold rounded-control text-xs transition-colors whitespace-nowrap"
                        >
                          Audit &amp; Evidence
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
