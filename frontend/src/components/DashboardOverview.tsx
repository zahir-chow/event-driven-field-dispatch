import React from 'react';
import type { WorkOrder, Provider, NotificationLog } from '../types';
import {
  Briefcase,
  Users,
  Radio,
  TrendingUp,
  MapPin,
  Clock,
  ArrowRight,
  ShieldCheck,
  Zap,
  Star,
  DollarSign,
  Activity,
  Layers,
} from 'lucide-react';

interface DashboardOverviewProps {
  orders: WorkOrder[];
  providers: Provider[];
  notifications: NotificationLog[];
  onNavigate: (tab: string) => void;
  onNewOrder: () => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  orders,
  providers,
  notifications,
  onNavigate,
  onNewOrder,
}) => {
  const openOrders = orders.filter((o) => o.status === 'OPEN');
  const acceptedOrders = orders.filter((o) => o.status === 'ACCEPTED');
  const availableTechs = providers.filter((p) => p.status === 'AVAILABLE');
  const totalBudget = orders.reduce((sum, o) => sum + (o.max_budget || 0), 0);

  return (
    <div className="space-y-6">
      {/* Client Welcome Hero */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-full bg-gradient-to-l from-indigo-500/10 via-cyan-500/5 to-transparent pointer-events-none"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Enterprise SLA Protection Active</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Dallas-Fort Worth Regional Field Operations
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-xl">
              Real-time technician dispatching, automated Kafka outbox event streaming, and optimistic concurrency orchestration.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => onNavigate('dispatch')}
              className="flex items-center space-x-2 px-4 py-2 text-xs font-semibold text-slate-300 bg-slate-800/80 hover:bg-slate-700 hover:text-white rounded-xl border border-slate-700 transition"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Matching Studio</span>
            </button>

            <button
              onClick={onNewOrder}
              className="flex items-center space-x-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/25 transition active:scale-95"
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>Request Field Tech</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Work Orders</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-white tracking-tight">{orders.length}</div>
            <div className="flex items-center space-x-2 mt-1 text-xs">
              <span className="text-emerald-400 font-semibold">{openOrders.length} Open</span>
              <span className="text-slate-600">•</span>
              <span className="text-cyan-400 font-semibold">{acceptedOrders.length} Claimed</span>
            </div>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Field Contractors</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-white tracking-tight">{providers.length}</div>
            <div className="flex items-center space-x-2 mt-1 text-xs">
              <span className="text-emerald-400 font-semibold">{availableTechs.length} Available</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400">100% W-9 Verified</span>
            </div>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Kafka Dispatches</span>
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Radio className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-white tracking-tight">{notifications.length}</div>
            <div className="flex items-center space-x-2 mt-1 text-xs">
              <span className="text-cyan-400 font-semibold">100% At-Least-Once</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400">KRaft Synced</span>
            </div>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Operations Budget</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-white tracking-tight">
              ${totalBudget.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
            <div className="flex items-center space-x-2 mt-1 text-xs">
              <span className="text-emerald-400 font-semibold flex items-center">
                <TrendingUp className="w-3 h-3 mr-0.5" />
                99.8%
              </span>
              <span className="text-slate-400">Budget Adherence</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Two-Column Hub */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Active Deployments Pipeline */}
        <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div>
              <h3 className="font-bold text-white text-base">Active Field Work Orders</h3>
              <p className="text-xs text-slate-400">Managed with Keyset cursor pagination & Transactional Outbox</p>
            </div>
            <button
              onClick={() => onNavigate('orders')}
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
            >
              <span>View All ({orders.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {orders.slice(0, 5).map((order) => (
              <div
                key={order.id}
                className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition flex items-center justify-between"
              >
                <div className="min-w-0 pr-4">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-white text-sm truncate">{order.title}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        order.status === 'OPEN'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : order.status === 'ACCEPTED'
                          ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {order.status}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3 text-xs text-slate-400 mt-1 font-mono">
                    <span className="flex items-center space-x-1">
                      <MapPin className="w-3 h-3 text-slate-500" />
                      <span>Zip {order.zip_code}</span>
                    </span>
                    <span>•</span>
                    <span>Budget: ${order.max_budget || 0}</span>
                    <span>•</span>
                    <span className="text-slate-500">v{order.version}</span>
                  </div>
                </div>

                <button
                  onClick={() => onNavigate('dispatch')}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-indigo-600 hover:text-white transition shrink-0"
                >
                  Dispatch
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right Col: Live Kafka Activity Stream */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div>
                <h3 className="font-bold text-white text-base flex items-center space-x-1.5">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <span>Live Kafka Telemetry</span>
                </h3>
                <p className="text-[11px] text-slate-400">Events ingested by Notification Consumer</p>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </div>

            <div className="space-y-3 mt-4">
              {notifications.slice(0, 4).map((log) => (
                <div key={log.id} className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/60 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200 truncate">{log.subject || 'Dispatch Alert'}</span>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-cyan-400">
                      {log.channel}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-1">{log.body}</p>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {new Date(log.created_at).toLocaleTimeString()} • {log.recipient}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => onNavigate('activity')}
            className="w-full py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 transition text-center"
          >
            View Full Event Audit Log
          </button>
        </div>
      </div>
    </div>
  );
};
