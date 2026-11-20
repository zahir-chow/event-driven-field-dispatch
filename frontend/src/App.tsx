import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardOverview } from './components/DashboardOverview';
import { WorkOrdersView } from './components/WorkOrdersView';
import { ProvidersView } from './components/ProvidersView';
import { DispatchView } from './components/DispatchView';
import { NotificationsView } from './components/NotificationsView';
import { ToastContainer } from './components/Toast';
import type { ToastMessage } from './components/Toast';
import type { WorkOrder, Provider, NotificationLog } from './types';
import { listWorkOrders, listProviders, listNotificationLogs } from './api';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'dispatch' | 'providers' | 'activity'>('overview');
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [showCreateModalTrigger, setShowCreateModalTrigger] = useState<boolean>(false);

  // Toast Helper
  const addToast = useCallback((type: 'success' | 'error' | 'info', title: string, message?: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const newToast: ToastMessage = { id, type, title, message };
    setToasts((prev) => [...prev, newToast]);

    // Auto dismiss after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Fetch all primary operational data
  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const [ordersRes, providersRes, notifsRes] = await Promise.allSettled([
        listWorkOrders(undefined, 100),
        listProviders(100),
        listNotificationLogs(50),
      ]);

      if (ordersRes.status === 'fulfilled') {
        setOrders(ordersRes.value.items || []);
      }
      if (providersRes.status === 'fulfilled') {
        setProviders(providersRes.value || []);
      }
      if (notifsRes.status === 'fulfilled') {
        setNotifications(notifsRes.value || []);
      }
    } catch (err: any) {
      console.error('Data fetch error:', err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleSelectForDispatch = (order: WorkOrder) => {
    setSelectedOrder(order);
    setActiveTab('dispatch');
  };

  const handleNewOrder = () => {
    setActiveTab('orders');
    setShowCreateModalTrigger(true);
  };

  const openOrdersCount = orders.filter((o) => o.status === 'OPEN').length;
  const availableTechsCount = providers.filter((p) => p.status === 'AVAILABLE').length;

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans antialiased">
      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      {/* Enterprise Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        openOrdersCount={openOrdersCount}
        availableTechsCount={availableTechsCount}
        eventCount={notifications.length}
      />

      {/* Main App Workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-950">
        {/* Top Sticky Header */}
        <Header
          activeTab={activeTab}
          onNewOrder={handleNewOrder}
          onRefresh={() => fetchData(false)}
          loading={loading}
          eventCount={notifications.length}
        />

        {/* Scrollable View Container */}
        <main className="flex-1 overflow-y-auto px-6 py-6 scroll-smooth">
          <div className="max-w-7xl mx-auto pb-12">
            {activeTab === 'overview' && (
              <DashboardOverview
                orders={orders}
                providers={providers}
                notifications={notifications}
                onNavigate={(tab) => setActiveTab(tab as any)}
                onNewOrder={handleNewOrder}
              />
            )}

            {activeTab === 'orders' && (
              <WorkOrdersView
                onSelectForDispatch={handleSelectForDispatch}
                onShowToast={addToast}
                externalShowCreate={showCreateModalTrigger}
                onCloseExternalCreate={() => setShowCreateModalTrigger(false)}
              />
            )}

            {activeTab === 'dispatch' && (
              <DispatchView
                selectedOrder={selectedOrder}
                onSelectOrder={setSelectedOrder}
                onEventTriggered={() => fetchData(true)}
                onShowToast={addToast}
              />
            )}

            {activeTab === 'providers' && <ProvidersView onShowToast={addToast} />}

            {activeTab === 'activity' && <NotificationsView onShowToast={addToast} />}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
