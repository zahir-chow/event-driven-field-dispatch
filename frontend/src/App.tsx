import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { WorkOrdersView } from './components/WorkOrdersView';
import { ProvidersView } from './components/ProvidersView';
import { DispatchView } from './components/DispatchView';
import { NotificationsView } from './components/NotificationsView';
import type { WorkOrder } from './types';
import { listNotificationLogs } from './api';
import { Layers, Database, Activity, GitBranch } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'orders' | 'providers' | 'dispatch' | 'notifications'>('orders');
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [notificationCount, setNotificationCount] = useState<number>(0);

  const fetchNotificationCount = async () => {
    try {
      const logs = await listNotificationLogs(10);
      setNotificationCount(logs.length);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchNotificationCount();
    const interval = setInterval(fetchNotificationCount, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSelectForDispatch = (order: WorkOrder) => {
    setSelectedOrder(order);
    setActiveTab('dispatch');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        notificationCount={notificationCount}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'orders' && (
          <WorkOrdersView onSelectForDispatch={handleSelectForDispatch} />
        )}

        {activeTab === 'providers' && <ProvidersView />}

        {activeTab === 'dispatch' && (
          <DispatchView
            selectedOrder={selectedOrder}
            onSelectOrder={setSelectedOrder}
            onEventTriggered={fetchNotificationCount}
          />
        )}

        {activeTab === 'notifications' && <NotificationsView />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            <span className="font-semibold text-slate-400">DiZpatch Core</span>
            <span>•</span>
            <span>FastAPI • Apache Kafka (KRaft) • PostgreSQL 16 • Docker</span>
          </div>

          <div className="flex items-center space-x-4">
            <span className="flex items-center space-x-1">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>4 Isolated DBs</span>
            </span>
            <span className="flex items-center space-x-1">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>Transactional Outbox</span>
            </span>
            <span className="flex items-center space-x-1">
              <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
              <span>Event-Driven</span>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
