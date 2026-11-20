import React, { useState, useEffect } from 'react';
import type { WorkOrder } from '../types';
import { listWorkOrders, createWorkOrder, cancelWorkOrder } from '../api';
import { Plus, RefreshCw, XCircle, Zap, MapPin, DollarSign } from 'lucide-react';

interface WorkOrdersViewProps {
  onSelectForDispatch: (order: WorkOrder) => void;
}

export const WorkOrdersView: React.FC<WorkOrdersViewProps> = ({ onSelectForDispatch }) => {
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [cancelModalOrder, setCancelModalOrder] = useState<WorkOrder | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);

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
      const data = await listWorkOrders(undefined, 50);
      setOrders(data.items || []);
    } catch (err) {
      console.error('Failed to load orders', err);
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
      await createWorkOrder({
        title: formData.title,
        description: formData.description,
        client_id: formData.client_id,
        zip_code: formData.zip_code,
        required_skills: formData.required_skills.split(',').map((s) => s.trim()).filter(Boolean),
        max_budget: formData.max_budget ? parseFloat(formData.max_budget) : undefined,
      });
      setShowCreateModal(false);
      setFormData({
        title: '',
        description: '',
        client_id: 'client-enterprise-retail-42',
        zip_code: '75001',
        required_skills: 'Networking, Fiber Optic',
        max_budget: '350',
      });
      await fetchOrders();
    } catch (err: any) {
      alert(`Error creating order: ${err.response?.data?.detail || err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelModalOrder) return;
    setActionLoading(true);
    try {
      await cancelWorkOrder(cancelModalOrder.id, cancelReason || 'Cancelled by client');
      setCancelModalOrder(null);
      setCancelReason('');
      await fetchOrders();
    } catch (err: any) {
      alert(`Error cancelling order: ${err.response?.data?.detail || err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const fillTemplate = (template: { title: string; desc: string; zip: string; skills: string; budget: string }) => {
    setFormData({
      title: template.title,
      description: template.desc,
      client_id: 'client-enterprise-hub',
      zip_code: template.zip,
      required_skills: template.skills,
      max_budget: template.budget,
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Work Orders Hub</h1>
          <p className="text-sm text-slate-400">
            Lifecycle management with Transactional Outbox & Keyset cursor pagination
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchOrders}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-2 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-md shadow-indigo-500/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create Work Order</span>
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/60 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">Title & Details</th>
                <th className="px-6 py-4">Status & Ver</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">Required Skills</th>
                <th className="px-6 py-4">Budget</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading && orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                    Loading work orders from PostgreSQL...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    No work orders found. Click "Create Work Order" to start!
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white">{order.title}</div>
                      <div className="text-xs text-slate-400 truncate max-w-xs">{order.description || 'No description'}</div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">ID: {order.id.slice(0, 13)}...</div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
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
                        <span className="text-xs text-slate-500 font-mono" title="Optimistic Version">
                          v{order.version}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-slate-300">
                      <div className="flex items-center space-x-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" />
                        <span>{order.zip_code}</span>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {order.required_skills.map((skill) => (
                          <span
                            key={skill}
                            className="px-2 py-0.5 rounded text-xs bg-slate-800 text-indigo-300 border border-slate-700 font-medium"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-200">
                      {order.max_budget ? (
                        <div className="flex items-center space-x-1">
                          <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{order.max_budget.toFixed(2)}</span>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-xs">Standard</span>
                      )}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                      {order.status === 'OPEN' && (
                        <>
                          <button
                            onClick={() => onSelectForDispatch(order)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/60 rounded border border-cyan-700/50 transition"
                            title="Match & Dispatch Technicians"
                          >
                            <Zap className="w-3 h-3 text-cyan-400" />
                            <span>Dispatch</span>
                          </button>

                          <button
                            onClick={() => setCancelModalOrder(order)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-rose-300 bg-rose-950/60 hover:bg-rose-900/60 rounded border border-rose-700/50 transition"
                            title="Cancel Work Order"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <Plus className="w-5 h-5 text-indigo-400" />
                <span>Create New Work Order</span>
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white transition"
              >
                ✕
              </button>
            </div>

            {/* Quick Templates */}
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                ⚡ Quick Demo Templates
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() =>
                    fillTemplate({
                      title: 'Emergency Fiber Optic Splice',
                      desc: 'Trunk cut during sidewalk construction. High priority repair.',
                      zip: '75001',
                      skills: 'Fiber Optic, Networking',
                      budget: '400',
                    })
                  }
                  className="p-2 text-left bg-slate-800/80 hover:bg-indigo-950/60 hover:border-indigo-500/50 border border-slate-700 rounded-lg transition"
                >
                  <div className="font-semibold text-slate-200">Fiber Optic Repair</div>
                  <div className="text-[11px] text-slate-400">Zip: 75001 • $400</div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    fillTemplate({
                      title: 'Install 8 IP Security Cameras',
                      desc: 'Mount and wire 8 PoE dome cameras in warehouse perimeter.',
                      zip: '75006',
                      skills: 'CCTV, Access Control',
                      budget: '500',
                    })
                  }
                  className="p-2 text-left bg-slate-800/80 hover:bg-indigo-950/60 hover:border-indigo-500/50 border border-slate-700 rounded-lg transition"
                >
                  <div className="font-semibold text-slate-200">Security Cameras</div>
                  <div className="text-[11px] text-slate-400">Zip: 75006 • $500</div>
                </button>
              </div>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Work Order Title</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Cisco Switch Replacement"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Description</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Details of the job requirements..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Zip Code</label>
                  <input
                    type="text"
                    required
                    value={formData.zip_code}
                    onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                    placeholder="75001"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Budget ($)</label>
                  <input
                    type="number"
                    value={formData.max_budget}
                    onChange={(e) => setFormData({ ...formData, max_budget: e.target.value })}
                    placeholder="350"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Required Skills (Comma separated)
                </label>
                <input
                  type="text"
                  required
                  value={formData.required_skills}
                  onChange={(e) => setFormData({ ...formData, required_skills: e.target.value })}
                  placeholder="Fiber Optic, Networking"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-md shadow-indigo-500/20 transition disabled:opacity-50"
                >
                  {actionLoading ? 'Creating & Emitting...' : 'Publish Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {cancelModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center space-x-2 text-rose-400">
              <XCircle className="w-5 h-5" />
              <span>Cancel Work Order</span>
            </h3>
            <p className="text-sm text-slate-300">
              Are you sure you want to cancel <strong className="text-white">{cancelModalOrder.title}</strong>? 
              This will emit a <code className="text-rose-300 text-xs bg-rose-950/60 px-1 py-0.5 rounded">WorkOrderCancelled</code> event to Kafka.
            </p>

            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1">Reason for Cancellation</label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Project postponed, resolved on-site"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setCancelModalOrder(null)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white transition"
              >
                Keep Order
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-500 rounded-lg shadow-md shadow-rose-500/20 transition disabled:opacity-50"
              >
                {actionLoading ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
