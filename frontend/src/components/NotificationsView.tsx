import React, { useState, useEffect } from 'react';
import type { NotificationLog } from '../types';
import { listNotificationLogs } from '../api';
import {
  Bell,
  Mail,
  MessageSquare,
  Smartphone,
  CheckCircle,
  RefreshCw,
  Radio,
  ExternalLink,
  Search,
  Filter,
  Copy,
  Terminal,
  ShieldCheck,
  Send,
  CheckCircle2,
} from 'lucide-react';

interface NotificationsViewProps {
  onShowToast?: (type: 'success' | 'error' | 'info', title: string, message?: string) => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({ onShowToast }) => {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [channelFilter, setChannelFilter] = useState<string>('ALL');
  const [selectedLog, setSelectedLog] = useState<NotificationLog | null>(null);

  const fetchLogs = async () => {
    try {
      const data = await listNotificationLogs(100);
      setLogs(data);
    } catch (err: any) {
      console.error(err);
      if (onShowToast) {
        onShowToast('error', 'Notification Stream Offline', err.message);
      }
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

  const filteredLogs = logs.filter((log) => {
    const matchesChannel = channelFilter === 'ALL' || log.channel === channelFilter;
    const matchesSearch =
      searchQuery === '' ||
      log.recipient.toLowerCase().includes(searchQuery.toLowerCase()) ||
      Boolean(log.subject && log.subject.toLowerCase().includes(searchQuery.toLowerCase())) ||
      Boolean(log.body && log.body.toLowerCase().includes(searchQuery.toLowerCase())) ||
      log.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesChannel && matchesSearch;
  });

  const emailCount = logs.filter((l) => l.channel === 'EMAIL').length;
  const smsCount = logs.filter((l) => l.channel === 'SMS').length;
  const pushCount = logs.filter((l) => l.channel === 'PUSH').length;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    if (onShowToast) {
      onShowToast('info', 'Copied to Clipboard', label);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center space-x-2.5">
            <Radio className="w-6 h-6 text-cyan-400 animate-pulse" />
            <span>Kafka Consumer Notification Feed</span>
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Real-time multi-channel event dispatches (Factory Pattern: Email, SMS, Push) consumed from Kafka topics
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
              autoRefresh
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-pulse text-emerald-400' : ''}`} />
            <span>Auto-Poll (3s): {autoRefresh ? 'ACTIVE' : 'PAUSED'}</span>
          </button>

          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-800/80 hover:bg-slate-700 hover:text-white rounded-xl border border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
            <span>Total Events</span>
            <Bell className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-white mt-2">{logs.length}</div>
          <p className="text-[11px] text-slate-500 mt-1">Consumed from Kafka</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
            <span>Email Dispatches</span>
            <Mail className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-blue-400 mt-2">{emailCount}</div>
          <p className="text-[11px] text-slate-500 mt-1">SMTP Notification Factory</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
            <span>SMS Dispatches</span>
            <Smartphone className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-2">{smsCount}</div>
          <p className="text-[11px] text-slate-500 mt-1">Mobile Carrier Gateway</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
            <span>Delivery Rate</span>
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-2">100%</div>
          <p className="text-[11px] text-slate-500 mt-1">At-least-once Guarantee</p>
        </div>
      </div>

      {/* Architecture Explainer Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-900/40 rounded-2xl p-4 text-xs text-slate-300 flex items-start space-x-3.5 shadow-lg">
        <div className="p-2.5 bg-indigo-600/20 rounded-xl border border-indigo-500/30 text-indigo-400 shrink-0 mt-0.5">
          <Terminal className="w-4 h-4" />
        </div>
        <div className="flex-1 leading-relaxed">
          <span className="font-bold text-white">Event Architecture Pipeline:</span> Microservices write business entities and outbox events in a single PostgreSQL ACID transaction. Outbox Relays tail the outbox tables and publish records to Kafka topics (<code className="text-cyan-300">work-orders.WorkOrderCreated</code>, <code className="text-cyan-300">assignments.AssignmentAccepted</code>). The dedicated <code className="text-indigo-300">notification-service</code> consumer pulls payloads asynchronously, executes the Notification Strategy Factory (Email / SMS), and logs idempotent delivery.
        </div>
      </div>

      {/* Search & Channel Filter */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search recipient, body, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
          />
        </div>

        {/* Channel Filter Pills */}
        <div className="flex items-center space-x-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider mr-1 hidden lg:inline">Channel:</span>
          {['ALL', 'EMAIL', 'SMS', 'PUSH'].map((channel) => (
            <button
              key={channel}
              onClick={() => setChannelFilter(channel)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 ${
                channelFilter === channel
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
              }`}
            >
              {channel}
            </button>
          ))}
        </div>
      </div>

      {/* Main Logs Table / Stream */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
          <span className="flex items-center space-x-2">
            <span>Dispatched Message Feed ({filteredLogs.length})</span>
          </span>
          <a
            href="http://172.17.68.210:8080"
            target="_blank"
            rel="noreferrer"
            className="text-indigo-400 hover:text-indigo-300 flex items-center space-x-1.5 font-semibold lowercase tracking-normal"
          >
            <span>Open Kafka UI Topics</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {loading && logs.length === 0 ? (
          <div className="p-16 text-center text-slate-500">
            <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-3 text-indigo-400" />
            <p className="text-sm font-medium">Connecting to Notification Service stream...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-16 text-center text-slate-500">
            <Bell className="w-8 h-8 mx-auto mb-3 text-slate-600" />
            <p className="text-sm font-semibold text-slate-400">No matching notification dispatches found</p>
            <p className="text-xs text-slate-500 mt-1">
              Create a new work order or assign a technician to trigger automated Kafka events!
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                onClick={() => setSelectedLog(log)}
                className={`p-4 hover:bg-slate-800/40 transition cursor-pointer flex items-start space-x-4 ${
                  selectedLog?.id === log.id ? 'bg-indigo-950/20 border-l-2 border-indigo-500' : ''
                }`}
              >
                {/* Channel Icon */}
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-sm ${
                    log.channel === 'EMAIL'
                      ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                      : log.channel === 'SMS'
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : 'bg-purple-500/10 border-purple-500/20 text-purple-400'
                  }`}
                >
                  {log.channel === 'EMAIL' ? (
                    <Mail className="w-5 h-5" />
                  ) : log.channel === 'SMS' ? (
                    <Smartphone className="w-5 h-5" />
                  ) : (
                    <MessageSquare className="w-5 h-5" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-white text-sm truncate">
                      {log.subject || `Dispatch notification to ${log.recipient}`}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        log.channel === 'EMAIL'
                          ? 'bg-blue-950 text-blue-300 border border-blue-800/50'
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-800/50'
                      }`}
                    >
                      {log.channel}
                    </span>
                    <span className="text-xs text-emerald-400 flex items-center space-x-1 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{log.status}</span>
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 mt-1 line-clamp-2 leading-relaxed">{log.body}</p>

                  <div className="flex items-center space-x-3 text-[11px] text-slate-500 mt-2 font-mono">
                    <span className="text-slate-400 font-sans">Recipient:</span>
                    <span className="text-slate-300 font-semibold">{log.recipient}</span>
                    <span>•</span>
                    <span>{new Date(log.created_at).toLocaleTimeString()}</span>
                    <span>•</span>
                    <span>ID: {log.id.slice(0, 8)}...</span>
                  </div>
                </div>

                {/* Action button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    copyToClipboard(JSON.stringify(log, null, 2), `Log ${log.id.slice(0, 8)}`);
                  }}
                  className="p-2 text-slate-500 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-lg border border-slate-700/60 transition"
                  title="Copy JSON Payload"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected Log Modal / Detail Drawer */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    selectedLog.channel === 'EMAIL'
                      ? 'bg-blue-500/10 text-blue-400'
                      : 'bg-emerald-500/10 text-emerald-400'
                  }`}
                >
                  {selectedLog.channel === 'EMAIL' ? <Mail className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Dispatched Notification Payload</h3>
                  <p className="text-xs text-slate-400 font-mono">ID: {selectedLog.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 block font-semibold mb-1">Subject:</span>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-medium">
                  {selectedLog.subject || 'N/A'}
                </div>
              </div>

              <div>
                <span className="text-slate-400 block font-semibold mb-1">Recipient Destination:</span>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-cyan-300 font-mono">
                  {selectedLog.recipient}
                </div>
              </div>

              <div>
                <span className="text-slate-400 block font-semibold mb-1">Message Body:</span>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {selectedLog.body}
                </div>
              </div>

              <div>
                <span className="text-slate-400 block font-semibold mb-1">Raw Microservice Record:</span>
                <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-indigo-300 font-mono overflow-x-auto text-[11px]">
                  {JSON.stringify(selectedLog, null, 2)}
                </pre>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end space-x-2">
              <button
                onClick={() => copyToClipboard(JSON.stringify(selectedLog, null, 2), 'Log JSON')}
                className="px-4 py-2 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition"
              >
                Copy JSON
              </button>
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
