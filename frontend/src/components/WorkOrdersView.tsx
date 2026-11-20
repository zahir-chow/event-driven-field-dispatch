import React, { useState, useEffect } from 'react';
import type { WorkOrder } from '../types';
import { listWorkOrders, createWorkOrder, cancelWorkOrder } from '../api';
import {
  Plus,
  RefreshCw,
  XCircle,
  Zap,
  MapPin,
  DollarSign,
  Search,
  Filter,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react';

interface WorkOrdersViewProps {
  onSelectForDispatch: (order: WorkOrder) => void;
  onShowToast: (type: 'success' | 'error' | 'info', title: string, message?: string) => void;
  externalShowCreate?: boolean;
  onCloseExternalCreate?: () => void;
}

export const WorkOrdersView: React.FC<WorkOrdersViewProps> = ({
  onSelectForDispatch,
  onShowToast,
  externalShowCreate,
  onCloseExternalCreate,
}) => {
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);

  useEffect(() => {
    if (externalShowCreate) {
      setShowCreateModal(true);
    }
  }, [externalShowCreate]);

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    if (onCloseExternalCreate) onCloseExternalCreate();
  };
  const [cancelModalOrder, setCancelModalOrder] = useState<WorkOrder | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    client_id: 'client-enterprise-retail-42',
    zip_code: '75001',
    required_skills: 'Networking, Fiber Optic',
    max_budget: '350',
  });

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const data = await listWorkOrders(undefined, 100);
      setOrders(data.items || []);
    } catch (err: any) {
      onShowToast('error', 'Failed to fetch work orders', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const created = await createWorkOrder({
        title: formData.title,
        description: formData.description,
        client_id: formData.client_id,
        zip_code: formData.zip_code,
        required_skills: formData.required_skills.split(',').map((s) => s.trim()).filter(Boolean),
        max_budget: formData.max_budget ? parseFloat(formData.max_budget) : undefined,
      });

      handleCloseCreateModal();
      setFormData({
        title: '',
        description: '',
        client_id: 'client-enterprise-retail-42',
        zip_code: '75001',
        required_skills: 'Networking, Fiber Optic',
        max_budget: '350',
      });
      onShowToast(
        'success',
        'Work Order Dispatched to Outbox',
        `'${created.title}' created and emitted to Kafka topic 'work-orders.WorkOrderCreated'.`
      );
      await fetchOrders();
    } catch (err: any) {
      onShowToast('error', 'Creation Failed', err.response?.data?.detail || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelModalOrder) return;
    setActionLoading(true);
    try {
      await cancelWorkOrder(cancelModalOrder.id, cancelReason || 'Project postponed by client');
      onShowToast(
        'info',
        'Order Cancelled',
        `Cancelled '${cancelModalOrder.title}'. Kafka event 'WorkOrderCancelled' emitted.`
      );
      setCancelModalOrder(null);
      setCancelReason('');
      await fetchOrders();
    } catch (err: any) {
      onShowToast('error', 'Cancellation Failed', err.response?.data?.detail || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const fillTemplate = (template: { title: string; desc: string; zip: string; skills: string; budget: string }) => {
    setFormData({
      title: template.title,
      description: template.desc,
      client_id: 'client-enterprise-retail-42',
      zip_code: template.zip,
      required_skills: template.skills,
      max_budget: template.budget,
    });
  };

  const filteredOrders = orders.filter((order) => {
    const matchesStatus = statusFilter === 'ALL' || order.status === statusFilter;
    if (!matchesStatus) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const matchesTitle = order.title.toLowerCase().includes(q);
    const matchesZip = order.zip_code.includes(q);
    const matchesSkill = order.required_skills.some((s) => s.toLowerCase().includes(q));
    const matchesId = order.id.toLowerCase().includes(q);
    return matchesTitle || matchesZip || matchesSkill || matchesId;
  });

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Work Orders Pipeline</h1>
          <p className="text-xs text-slate-400">
            Enterprise work orders backed by PostgreSQL Transactional Outbox and Keyset cursor pagination
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/25 transition active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>New Work Order</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/90 border border-slate-800/80 p-3 rounded-2xl shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search title, zip code, skills..."
            className="w-full pl-9 pr-4 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center space-x-1 w-full sm:w-auto overflow-x-auto">
          {['ALL', 'OPEN', 'ACCEPTED', 'CANCELLED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                statusFilter === st
                  ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              {st === 'ALL' ? 'All Orders' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/70 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800/80">
              <tr>
                <th className="px-5 py-3.5 font-bold">Deployment & Description</th>
                <th className="px-5 py-3.5 font-bold">Status / Version</th>
                <th className="px-5 py-3.5 font-bold">Zip Code</th>
                <th className="px-5 py-3.5 font-bold">Required Skills</th>
                <th className="px-5 py-3.5 font-bold">Budget</th>
                <th className="px-5 py-3.5 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {loading && orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                    Fetching records from work-order-service...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    No work orders matched your filter.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-white text-sm tracking-tight">{order.title}</div>
                      <div className="text-slate-400 truncate max-w-sm mt-0.5">{order.description || 'No notes'}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        Client: {order.client_id} • ID: {order.id.slice(0, 10)}...
                      </div>
                    </td>

                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center space-x-1.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            order.status === 'OPEN'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : order.status === 'ACCEPTED'
                              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                              : order.status === 'CANCELLED'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                          }`}
                        >
                          {order.status}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono font-bold" title="Optimistic Version">
                          v{order.version}
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center space-x-1 font-mono text-slate-200">
                        <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{order.zip_code}</span>
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {order.required_skills.map((skill) => (
                          <span
                            key={skill}
                            className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-indigo-300 border border-slate-700/80 font-medium"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="px-5 py-3.5 whitespace-nowrap font-mono font-bold text-slate-200">
                      {order.max_budget ? (
                        <span className="text-emerald-400">${order.max_budget.toFixed(2)}</span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 whitespace-nowrap text-right space-x-2">
                      {order.status === 'OPEN' && (
                        <>
                          <button
                            onClick={() => onSelectForDispatch(order)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/60 rounded-lg border border-cyan-700/50 transition"
                          >
                            <Zap className="w-3 h-3 text-cyan-400" />
                            <span>Dispatch</span>
                          </button>

                          <button
                            onClick={() => setCancelModalOrder(order)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-rose-300 bg-rose-950/60 hover:bg-rose-900/60 rounded-lg border border-rose-700/50 transition"
                          >
                            <XCircle className="w-3 h-3 text-rose-400" />
                            <span>Cancel</span>
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span>Post Enterprise Field Work Order</span>
              </h3>
              <button onClick={handleCloseCreateModal} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            {/* Quick Demo Templates */}
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                ⚡ Instant Service Templates
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() =>
                    fillTemplate({
                      title: 'Emergency Fiber Optic Splice',
                      desc: 'Trunk cut during sidewalk construction. High priority splice required.',
                      zip: '75001',
                      skills: 'Fiber Optic, Networking',
                      budget: '450',
                    })
                  }
                  className="p-2.5 text-left bg-slate-950/70 hover:bg-indigo-950/60 hover:border-indigo-500/50 border border-slate-800 rounded-xl transition"
                >
                  <div className="font-bold text-slate-200">Fiber Optic Splice</div>
                  <div className="text-[11px] text-slate-400 font-mono">Zip 75001 • $450</div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    fillTemplate({
                      title: 'Cisco Core Switch Deployment',
                      desc: 'Mount Catalyst 9300 switch, configure VLAN trunks, and patch panel.',
                      zip: '75201',
                      skills: 'Networking, Server Racks',
                      budget: '600',
                    })
                  }
                  className="p-2.5 text-left bg-slate-950/70 hover:bg-indigo-950/60 hover:border-indigo-500/50 border border-slate-800 rounded-xl transition"
                >
                  <div className="font-bold text-slate-200">Core Switch Deploy</div>
                  <div className="text-[11px] text-slate-400 font-mono">Zip 75201 • $600</div>
                </button>
              </div>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Work Order Title</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Cisco Core Switch Replacement"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Scope of Work</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe tasks, on-site contact, access instructions..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Zip Code</label>
                  <input
                    type="text"
                    required
                    value={formData.zip_code}
                    onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Budget ($)</label>
                  <input
                    type="number"
                    value={formData.max_budget}
                    onChange={(e) => setFormData({ ...formData, max_budget: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Required Skill Badges (Comma-separated)
                </label>
                <input
                  type="text"
                  required
                  value={formData.required_skills}
                  onChange={(e) => setFormData({ ...formData, required_skills: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleCloseCreateModal}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/25 transition disabled:opacity-50"
                >
                  {actionLoading ? 'Writing to Outbox...' : 'Dispatch Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {cancelModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-rose-400 flex items-center space-x-2">
              <XCircle className="w-5 h-5" />
              <span>Cancel Work Order</span>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Cancel deployment for <strong className="text-white">{cancelModalOrder.title}</strong>? This will emit a{' '}
              <code className="text-rose-300 text-[11px] bg-rose-950/60 px-1 py-0.5 rounded">WorkOrderCancelled</code> event to Kafka and notify dispatchers.
            </p>

            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1 uppercase">Reason</label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Project postponed by client"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setCancelModalOrder(null)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white"
              >
                Keep Order
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-lg shadow-rose-600/20 transition disabled:opacity-50"
              >
                {actionLoading ? 'Cancelling...' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
