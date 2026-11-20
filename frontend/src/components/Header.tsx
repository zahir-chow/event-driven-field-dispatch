import React from 'react';
import {
  Bell,
  Plus,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Terminal,
} from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  onNewOrder: () => void;
  onRefresh: () => void;
  loading: boolean;
  eventCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onNewOrder,
  onRefresh,
  loading,
  eventCount,
}) => {
  const getBreadcrumbTitle = () => {
    switch (activeTab) {
      case 'overview':
        return 'Executive Operations Dashboard';
      case 'orders':
        return 'Work Orders & Deployment Pipeline';
      case 'dispatch':
        return 'Strategy Matchmaker & Dispatch Studio';
      case 'providers':
        return 'Field Technician Marketplace';
      case 'activity':
        return 'Live Kafka Event Telemetry & Audit Feed';
      default:
        return 'Operations';
    }
  };

  return (
    <header className="h-16 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Breadcrumb / Title */}
      <div className="flex items-center space-x-3">
        <h2 className="text-base font-bold text-white tracking-tight">{getBreadcrumbTitle()}</h2>
        <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-400" />
          <span>Transactional Outbox Synced</span>
        </span>
      </div>

      {/* Header Actions */}
      <div className="flex items-center space-x-3">
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-2 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-xl transition"
          title="Refresh Data"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
        </button>

        <a
          href="http://172.17.68.210:8080"
          target="_blank"
          rel="noreferrer"
          className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-800/80 hover:bg-slate-700 hover:text-white border border-slate-700 rounded-xl transition shadow-sm"
        >
          <Terminal className="w-3.5 h-3.5 text-cyan-400" />
          <span>Broker Console</span>
          <ExternalLink className="w-3 h-3 text-slate-400" />
        </a>

        <button
          onClick={onNewOrder}
          className="flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md shadow-indigo-600/20 transition active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Request Service</span>
        </button>

        {/* Profile Avatar Chip */}
        <div className="flex items-center space-x-2 pl-2 border-l border-slate-800">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center font-bold text-xs text-white shadow-sm ring-2 ring-slate-800">
            ER
          </div>
        </div>
      </div>
    </header>
  );
};
