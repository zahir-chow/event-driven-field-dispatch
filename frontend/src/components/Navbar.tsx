import React from 'react';
import { Layers, Briefcase, Users, Zap, Bell, ExternalLink, Radio } from 'lucide-react';

interface NavbarProps {
  activeTab: 'orders' | 'providers' | 'dispatch' | 'notifications';
  setActiveTab: (tab: 'orders' | 'providers' | 'dispatch' | 'notifications') => void;
  notificationCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, notificationCount }) => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-200 bg-clip-text text-transparent">
                  DiZpatch
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Radio className="w-3 h-3 mr-1 animate-pulse" /> EDA Active
                </span>
              </div>
              <p className="text-xs text-slate-400">Field-Service Event-Driven Marketplace</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex space-x-1">
            <button
              onClick={() => setActiveTab('orders')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'orders'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              <span>Work Orders</span>
            </button>

            <button
              onClick={() => setActiveTab('providers')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'providers'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Technicians</span>
            </button>

            <button
              onClick={() => setActiveTab('dispatch')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'dispatch'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>Dispatch Studio</span>
            </button>

            <button
              onClick={() => setActiveTab('notifications')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors relative ${
                activeTab === 'notifications'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Bell className="w-4 h-4" />
              <span>Event Feed</span>
              {notificationCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-xs bg-cyan-500 text-slate-950 font-bold">
                  {notificationCount}
                </span>
              )}
            </button>
          </nav>

          {/* Quick Links */}
          <div className="flex items-center space-x-3">
            <a
              href="http://172.17.68.210:8080"
              target="_blank"
              rel="noreferrer"
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-lg border border-slate-700 transition"
              title="Open Apache Kafka Web UI"
            >
              <span>Kafka UI</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </a>
          </div>
        </div>
      </div>
    </header>
  );
};
