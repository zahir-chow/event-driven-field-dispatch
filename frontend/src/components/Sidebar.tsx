import React from 'react';
import {
  LayoutDashboard,
  Briefcase,
  Zap,
  Users,
  Radio,
  ExternalLink,
  Building2,
  Database,
  Cpu,
  ChevronDown,
  Layers,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  openOrdersCount: number;
  availableTechsCount: number;
  eventCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  openOrdersCount,
  availableTechsCount,
  eventCount,
}) => {
  return (
    <aside className="w-64 bg-slate-900/90 border-r border-slate-800/80 flex flex-col shrink-0 select-none backdrop-blur-md">
      {/* Brand Header */}
      <div className="h-16 px-5 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-bold text-base tracking-tight text-white flex items-center space-x-1.5">
              <span>DiZpatch</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                PRO
              </span>
            </span>
            <p className="text-[11px] text-slate-400 font-medium">Field Operations Suite</p>
          </div>
        </div>
      </div>

      {/* Client Context Switcher */}
      <div className="p-3 border-b border-slate-800/60">
        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition flex items-center justify-between cursor-pointer group">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-indigo-950 border border-indigo-700/50 flex items-center justify-center text-indigo-400 shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-200 truncate group-hover:text-white transition">
                Enterprise Retail HQ
              </div>
              <div className="text-[10px] text-slate-500 font-mono truncate">ID: client-retail-42</div>
            </div>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        </div>
      </div>

      {/* Nav Menu */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {/* Main Section */}
        <div>
          <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Operations
          </div>
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${
                activeTab === 'overview'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <LayoutDashboard className="w-4 h-4" />
                <span>Executive Overview</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('orders')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${
                activeTab === 'orders'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <Briefcase className="w-4 h-4" />
                <span>Work Orders</span>
              </div>
              {openOrdersCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  {openOrdersCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('dispatch')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${
                activeTab === 'dispatch'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Dispatch Studio</span>
              </div>
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 font-mono">
                Strategy
              </span>
            </button>
          </nav>
        </div>

        {/* Workforce */}
        <div>
          <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Field Workforce
          </div>
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('providers')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${
                activeTab === 'providers'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <Users className="w-4 h-4" />
                <span>Technician Network</span>
              </div>
              {availableTechsCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {availableTechsCount} Active
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Telemetry & Architecture */}
        <div>
          <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Event Streaming
          </div>
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('activity')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${
                activeTab === 'activity'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <Radio className="w-4 h-4 text-cyan-400" />
                <span>Kafka Event Feed</span>
              </div>
              {eventCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  {eventCount}
                </span>
              )}
            </button>

            <a
              href="http://172.17.68.210:8080"
              target="_blank"
              rel="noreferrer"
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition"
            >
              <div className="flex items-center space-x-2.5">
                <Cpu className="w-4 h-4" />
                <span>Kafka Broker UI</span>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
            </a>
          </nav>
        </div>
      </div>

      {/* Infrastructure Status Footer */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 space-y-2">
        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800/80 text-[11px] space-y-1.5">
          <div className="flex items-center justify-between font-medium">
            <span className="text-slate-400 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Kafka 3.7 (KRaft)</span>
            </span>
            <span className="text-emerald-400 font-mono text-[10px]">Healthy</span>
          </div>
          <div className="flex items-center justify-between text-slate-500 text-[10px]">
            <span className="flex items-center space-x-1">
              <Database className="w-3 h-3 text-indigo-400" />
              <span>PostgreSQL 16</span>
            </span>
            <span>4 DBs Sync</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
