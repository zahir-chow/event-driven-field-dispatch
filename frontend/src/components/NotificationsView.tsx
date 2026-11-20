import React, { useState, useEffect } from 'react';
import type { NotificationLog } from '../types';
import { listNotificationLogs } from '../api';
import { Bell, Mail, MessageSquare, Smartphone, CheckCircle, RefreshCw, Radio, ExternalLink } from 'lucide-react';

export const NotificationsView: React.FC = () => {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  const fetchLogs = async () => {
    try {
      const data = await listNotificationLogs(50);
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    if (!autoRefresh) return;
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center space-x-2">
            <Bell className="w-6 h-6 text-cyan-400" />
            <span>Kafka Consumer Notification Feed</span>
          </h1>
          <p className="text-sm text-slate-400">
            Real-time multi-channel dispatches (Factory Pattern: Email, SMS, Push) consumed from Kafka topics
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              autoRefresh
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-pulse text-emerald-400' : ''}`} />
            <span>Auto-Poll (3s): {autoRefresh ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Architecture Info Box */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-900/40 rounded-xl p-4 text-xs text-slate-300 flex items-start space-x-3">
        <div className="p-2 bg-indigo-600/20 rounded-lg border border-indigo-500/30 text-indigo-400 shrink-0">
          <Bell className="w-4 h-4" />
        </div>
        <div>
          <span className="font-semibold text-white">How This Feed Works:</span> When an action happens (e.g. Work Order created, Job accepted), the microservice commits to PostgreSQL and its outbox relay pushes an event to Apache Kafka. The <code className="text-cyan-300">dizpatch-notification-consumer</code> container consumes the event asynchronously, dynamically creates an <strong className="text-indigo-300">Email</strong> or <strong className="text-emerald-300">SMS</strong> sender via the Factory Pattern, and persists the record to the <code className="text-indigo-300">dizpatch_notifications</code> database.
        </div>
      </div>

      {/* Notification Logs List */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
          <span>Dispatched Notifications ({logs.length})</span>
          <a
            href="http://172.17.68.210:8080"
            target="_blank"
            rel="noreferrer"
            className="text-indigo-400 hover:text-indigo-300 flex items-center space-x-1 font-normal lowercase tracking-normal"
          >
            <span>view raw events in kafka ui</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {loading && logs.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
            Connecting to Notification Service...
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            No notification logs yet. Create or accept a work order to trigger automated dispatches!
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {logs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-slate-800/40 transition flex items-start space-x-4">
                {/* Channel Icon */}
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                    log.channel === 'EMAIL'
                      ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                      : log.channel === 'SMS'
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : 'bg-purple-500/10 border-purple-500/20 text-purple-400'
                  }`}
                >
                  {log.channel === 'EMAIL' ? (
                    <Mail className="w-4 h-4" />
                  ) : log.channel === 'SMS' ? (
                    <Smartphone className="w-4 h-4" />
                  ) : (
                    <MessageSquare className="w-4 h-4" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-white text-sm truncate">
                      {log.subject || `Dispatch to ${log.recipient}`}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        log.channel === 'EMAIL'
                          ? 'bg-blue-950 text-blue-300 border border-blue-800/40'
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-800/40'
                      }`}
                    >
                      {log.channel}
                    </span>
                    <span className="text-xs text-emerald-400 flex items-center space-x-1 font-medium">
                      <CheckCircle className="w-3 h-3" />
                      <span>{log.status}</span>
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 mt-1 line-clamp-2">{log.body}</p>

                  <div className="flex items-center space-x-3 text-[11px] text-slate-500 mt-2 font-mono">
                    <span>To: {log.recipient}</span>
                    <span>•</span>
                    <span>{new Date(log.created_at).toLocaleTimeString()}</span>
                    <span>•</span>
                    <span>ID: {log.id.slice(0, 8)}...</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
