import React, { useState } from 'react';
import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Search,
  Filter,
  Users,
  Eye,
  RefreshCw,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { Ticket, Department, Priority } from '../types';

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
      {/* Top Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-lg border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-semibold mb-2 border border-purple-400/30">
            <Shield className="w-3.5 h-3.5 text-purple-400" />
            <span>Campus Administration & Warden Command Center</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Campus Maintenance Operations & Auditing
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
            Real-time oversight over facility work orders, department routing accuracy, uncertain AI cases requiring human sign-off, and verified photographic evidence archives.
          </p>
        </div>

        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Analytics</span>
        </button>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Total Logged
          </span>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">{total}</div>
          <span className="text-[10px] text-slate-400">All campus facilities</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Active Orders
          </span>
          <div className="text-2xl font-extrabold text-blue-600 mt-1">{active}</div>
          <span className="text-[10px] text-blue-500">In maintenance queues</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Awaiting Verification
          </span>
          <div className="text-2xl font-extrabold text-purple-600 mt-1">{awaitingVerif}</div>
          <span className="text-[10px] text-purple-500">Repairs completed</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Human Review Queue
          </span>
          <div className="text-2xl font-extrabold text-rose-600 mt-1">{escalatedOrReview}</div>
          <span className="text-[10px] text-rose-500">Safety / Uncertainty</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs col-span-2 sm:col-span-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Verified Resolution Rate
          </span>
          <div className="text-2xl font-extrabold text-emerald-600 mt-1">{resolutionRate}%</div>
          <span className="text-[10px] text-emerald-600 font-medium">Confirmed by students or admin</span>
        </div>
      </div>

      {/* Department Workload Distribution */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Department Load & Ticket Distribution
          </h3>
          <span className="text-xs text-slate-400">Deterministic automated routing</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
          {departments.map((d) => {
            const count = tickets.filter((t) => t.department === d && t.status !== 'resolved').length;
            const isHigh = count >= 2;

            return (
              <div
                key={d}
                onClick={() => setDeptFilter(deptFilter === d ? 'All' : d)}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  deptFilter === d
                    ? 'border-purple-600 bg-purple-50/50 shadow-2xs'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">{d}</span>
                  <span
                    className={`font-mono text-xs font-bold px-1.5 py-0.5 rounded ${
                      isHigh ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {count}
                  </span>
                </div>
                <div className="mt-2 w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-purple-600 h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, count * 33)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter and Master Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Controls */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filter by Ticket ID, description, building, or room..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto text-xs">
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="p-2 bg-slate-50 border border-slate-200 rounded-xl font-medium"
            >
              <option value="All">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="p-2 bg-slate-50 border border-slate-200 rounded-xl font-medium"
            >
              <option value="All">All Statuses</option>
              <option value="reported">Reported</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="awaiting_verification">Awaiting Verification</option>
              <option value="resolved">Resolved</option>
              <option value="reopened">Reopened</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="p-2 bg-slate-50 border border-slate-200 rounded-xl font-medium"
            >
              <option value="All">All Priorities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
        </div>

        {/* Master Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Ticket & Defect</th>
                <th className="py-3 px-4">Department & Priority</th>
                <th className="py-3 px-4">Campus Location</th>
                <th className="py-3 px-4">Status & AI Check</th>
                <th className="py-3 px-4">Technician</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filtered.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                        {ticket.id}
                      </span>
                      <span className="font-semibold text-slate-900 truncate max-w-xs">
                        {ticket.aiAssessment.title}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                      {ticket.description}
                    </span>
                  </td>

                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-800">{ticket.department}</span>
                      <span
                        className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                          ticket.aiAssessment.priority === 'Critical'
                            ? 'bg-rose-100 text-rose-700'
                            : ticket.aiAssessment.priority === 'High'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {ticket.aiAssessment.priority}
                      </span>
                    </div>
                  </td>

                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-800">{ticket.location.building}</div>
                    <span className="text-[11px] text-slate-500">{ticket.location.room}</span>
                  </td>

                  <td className="py-3 px-4">
                    <div className="space-y-0.5">
                      <span
                        className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          ticket.status === 'resolved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : ticket.status === 'awaiting_verification'
                            ? 'bg-purple-100 text-purple-800'
                            : ticket.status === 'in_progress'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {ticket.status.replace('_', ' ')}
                      </span>
                      {ticket.aiAssessment.needsHumanReview && (
                        <div className="text-[10px] text-rose-600 font-bold flex items-center gap-0.5">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          <span>Flagged for Human Review</span>
                        </div>
                      )}
                    </div>
                  </td>

                  <td className="py-3 px-4 text-slate-600">
                    {ticket.assignedTechnician || <span className="text-slate-400">Unassigned</span>}
                  </td>

                  <td className="py-3 px-4 text-right space-x-1">
                    <button
                      onClick={() => onSelectTicket(ticket)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-lg text-xs transition-colors"
                    >
                      Audit & Evidence
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
