import React, { useState, useEffect } from 'react';
import type { WorkOrder, Assignment, Candidate } from '../types';
import { listWorkOrders, matchAssignment, acceptAssignment, getAssignment } from '../api';
import {
  Zap,
  ShieldAlert,
  CheckCircle,
  Star,
  DollarSign,
  Award,
  AlertTriangle,
  MapPin,
  Cpu,
  Layers,
  Sparkles,
} from 'lucide-react';

interface DispatchViewProps {
  selectedOrder: WorkOrder | null;
  onSelectOrder: (order: WorkOrder | null) => void;
  onEventTriggered: () => void;
  onShowToast: (type: 'success' | 'error' | 'info', title: string, message?: string) => void;
}

export const DispatchView: React.FC<DispatchViewProps> = ({
  selectedOrder,
  onSelectOrder,
  onEventTriggered,
  onShowToast,
}) => {
  const [openOrders, setOpenOrders] = useState<WorkOrder[]>([]);
  const [strategy, setStrategy] = useState<'rating' | 'cost' | 'distance'>('rating');
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [concurrencyStatus, setConcurrencyStatus] = useState<{ message: string; type: 'success' | 'error' | 'idle' }>({
    message: '',
    type: 'idle',
  });

  const fetchOrders = async () => {
    try {
      const data = await listWorkOrders(undefined, 50);
      const open = (data.items || []).filter((o) => o.status === 'OPEN' || o.status === 'ASSIGNED');
      setOpenOrders(open);
      if (!selectedOrder && open.length > 0) {
        onSelectOrder(open[0]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    if (selectedOrder) {
      setAssignment(null);
      setConcurrencyStatus({ message: '', type: 'idle' });
      getAssignment(selectedOrder.id)
        .then((data) => setAssignment(data))
        .catch(() => setAssignment(null));
    }
  }, [selectedOrder]);

  const handleMatch = async () => {
    if (!selectedOrder) return;
    setLoading(true);
    setConcurrencyStatus({ message: '', type: 'idle' });
    try {
      const result = await matchAssignment({
        work_order_id: selectedOrder.id,
        zip_code: selectedOrder.zip_code,
        required_skills: selectedOrder.required_skills,
        strategy,
      });
      setAssignment(result);
      onShowToast(
        'success',
        'Providers Matched via Strategy Pattern',
        `Evaluated candidates using ${strategy.toUpperCase()} algorithm. Event emitted to Kafka 'assignments.ProvidersMatched'.`
      );
      onEventTriggered();
    } catch (err: any) {
      onShowToast('error', 'Matching Failed', err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (candidate: Candidate) => {
    if (!selectedOrder || !assignment) return;
    setLoading(true);
    try {
      const result = await acceptAssignment(selectedOrder.id, candidate.provider_id, assignment.version);
      setAssignment(result);
      setConcurrencyStatus({
        message: `Success! ${candidate.name} accepted the work order. Event 'AssignmentAccepted' published to Kafka.`,
        type: 'success',
      });
      onShowToast(
        'success',
        'Technician Accepted Deployment',
        `${candidate.name} confirmed. Notification Consumer dispatched SMS to provider and Email to client.`
      );
      onEventTriggered();
      fetchOrders();
    } catch (err: any) {
      if (err.response?.status === 409) {
        const errorDetail = err.response?.data?.detail || 'Optimistic Concurrency Control blocked duplicate claim';
        setConcurrencyStatus({
          message: `409 Conflict: ${errorDetail}`,
          type: 'error',
        });
        onShowToast('error', '409 Conflict: Double-Booking Blocked', errorDetail);
      } else {
        onShowToast('error', 'Acceptance Failed', err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateConflict = async () => {
    if (!selectedOrder || !assignment) return;
    setLoading(true);
    try {
      await acceptAssignment(selectedOrder.id, 'fake-concurrent-provider-uuid-999', 1);
      setConcurrencyStatus({
        message: 'Unexpectedly succeeded!',
        type: 'success',
      });
    } catch (err: any) {
      if (err.response?.status === 409) {
        const msg = `🛡️ TOCTOU Race Condition Blocked! Server rejected with HTTP 409 Conflict: "${err.response.data.detail}". Database version constraint protected state integrity.`;
        setConcurrencyStatus({
          message: msg,
          type: 'error',
        });
        onShowToast('info', 'TOCTOU Concurrency Guard Triggered', 'Successfully proved double-booking prevention via HTTP 409 Conflict.');
      } else {
        onShowToast('error', 'Request Failed', err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-white flex items-center space-x-2">
          <Zap className="w-6 h-6 text-amber-400" />
          <span>Dispatch & Strategy Matching Studio</span>
        </h1>
        <p className="text-xs text-slate-400">
          Algorithmic workforce ranking (Strategy Pattern) with Optimistic Concurrency Control
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Work Order Picker & Strategy */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 space-y-5 shadow-xl">
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              1. Active Order Deployment
            </label>
            {openOrders.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500 bg-slate-950 rounded-xl border border-slate-800">
                No open work orders available.
              </div>
            ) : (
              <select
                value={selectedOrder?.id || ''}
                onChange={(e) => {
                  const found = openOrders.find((o) => o.id === e.target.value);
                  if (found) onSelectOrder(found);
                }}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
              >
                {openOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.title} ({o.zip_code}) - {o.status}
                  </option>
                ))}
              </select>
            )}
          </div>

          {selectedOrder && (
            <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs space-y-2">
              <div className="font-bold text-white text-sm">{selectedOrder.title}</div>
              <div className="text-slate-400 line-clamp-2">{selectedOrder.description}</div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                  Zip: {selectedOrder.zip_code}
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-emerald-400 font-mono text-[10px]">
                  Budget: ${selectedOrder.max_budget || 0}
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-400 font-mono text-[10px]">
                  v{selectedOrder.version}
                </span>
              </div>
              <div className="flex flex-wrap gap-1 pt-1">
                {selectedOrder.required_skills.map((s) => (
                  <span key={s} className="px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/40 text-[10px]">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              2. Ranking Algorithm (Strategy Pattern)
            </label>
            <div className="space-y-2 text-xs">
              <label
                onClick={() => setStrategy('rating')}
                className={`flex items-start space-x-3 p-3 rounded-xl border cursor-pointer transition ${
                  strategy === 'rating'
                    ? 'bg-indigo-950/50 border-indigo-500 text-white shadow-sm'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Star className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">RatingRankingStrategy</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Top customer review scores ranked first.</div>
                </div>
              </label>

              <label
                onClick={() => setStrategy('cost')}
                className={`flex items-start space-x-3 p-3 rounded-xl border cursor-pointer transition ${
                  strategy === 'cost'
                    ? 'bg-indigo-950/50 border-indigo-500 text-white shadow-sm'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <DollarSign className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">CostRankingStrategy</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Lowest contractor hourly billing rates first.</div>
                </div>
              </label>

              <label
                onClick={() => setStrategy('distance')}
                className={`flex items-start space-x-3 p-3 rounded-xl border cursor-pointer transition ${
                  strategy === 'distance'
                    ? 'bg-indigo-950/50 border-indigo-500 text-white shadow-sm'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Award className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">DistanceRankingStrategy</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Closest proximity to target work order zip code.</div>
                </div>
              </label>
            </div>
          </div>

          <button
            onClick={handleMatch}
            disabled={!selectedOrder || loading}
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold text-xs shadow-lg shadow-indigo-600/25 transition disabled:opacity-50 active:scale-95"
          >
            <Zap className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Execute Strategy Match</span>
          </button>
        </div>

        {/* Right 2 Columns: Ranked Candidates & Concurrency Simulator */}
        <div className="lg:col-span-2 space-y-5">
          {/* Concurrency Banner */}
          {concurrencyStatus.type !== 'idle' && (
            <div
              className={`p-4 rounded-2xl border flex items-start space-x-3 shadow-md ${
                concurrencyStatus.type === 'error'
                  ? 'bg-rose-950/50 border-rose-800 text-rose-200'
                  : 'bg-emerald-950/50 border-emerald-800 text-emerald-200'
              }`}
            >
              {concurrencyStatus.type === 'error' ? (
                <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              )}
              <div className="text-xs font-semibold leading-relaxed">{concurrencyStatus.message}</div>
            </div>
          )}

          {/* Matched Results Card */}
          <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div>
                <h3 className="font-bold text-white text-base">Algorithmic Recommendation Board</h3>
                <p className="text-xs text-slate-400">
                  {assignment
                    ? `Algorithm: ${assignment.strategy_used || strategy} • State: ${assignment.status} (v${assignment.version})`
                    : 'Click "Execute Strategy Match" to query and score candidates'}
                </p>
              </div>

              {assignment && assignment.status === 'ACCEPTED' && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center space-x-1.5">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Deployment Locked</span>
                </span>
              )}
            </div>

            {!assignment || !assignment.candidates || assignment.candidates.length === 0 ? (
              <div className="py-14 text-center text-slate-500 space-y-2">
                <AlertTriangle className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-sm font-semibold text-slate-400">No candidates scored yet.</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  The strategy engine filters providers by skills and zip coverage, then weights candidates by your selected strategy.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {assignment.candidates.map((cand, idx) => (
                  <div
                    key={cand.provider_id}
                    className={`p-4 rounded-2xl border transition flex items-center justify-between ${
                      assignment.provider_id === cand.provider_id
                        ? 'bg-cyan-950/30 border-cyan-500 shadow-md'
                        : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center space-x-4">
                      {/* Rank Badge */}
                      <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center font-bold text-xs text-indigo-400 border border-slate-700">
                        #{idx + 1}
                      </div>

                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-white text-sm">{cand.name}</span>
                          <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/30">
                            Score: {cand.score.toFixed(2)}
                          </span>
                        </div>

                        <div className="flex items-center space-x-3 text-xs text-slate-400 mt-1 font-mono">
                          <span className="flex items-center space-x-1 text-amber-400">
                            <Star className="w-3 h-3 fill-amber-400" />
                            <span>{cand.rating.toFixed(1)}</span>
                          </span>
                          <span>•</span>
                          <span className="text-emerald-400">
                            ${cand.hourly_rate ? cand.hourly_rate.toFixed(0) : 0}/hr
                          </span>
                          <span>•</span>
                          <span className="text-slate-500">
                            Matched: {cand.matching_skills.join(', ')}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      {assignment.provider_id === cand.provider_id ? (
                        <span className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-cyan-500 text-slate-950 flex items-center space-x-1 shadow">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Dispatched</span>
                        </span>
                      ) : assignment.status === 'ACCEPTED' ? (
                        <span className="text-xs text-slate-500 font-medium">Position Filled</span>
                      ) : (
                        <button
                          onClick={() => handleAccept(cand)}
                          disabled={loading}
                          className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition shadow-md shadow-indigo-600/20 disabled:opacity-50 active:scale-95"
                        >
                          Confirm & Dispatch
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Concurrency Testing Box */}
                {assignment && assignment.status === 'ACCEPTED' && (
                  <div className="mt-6 p-4 rounded-2xl bg-slate-950/80 border border-rose-900/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
                        <ShieldAlert className="w-4 h-4" />
                        <span>Interactive TOCTOU Race Condition Test</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-2 py-0.5 rounded">
                        Optimistic Version Lock
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      This order is officially claimed by <strong className="text-white">{assignment.provider_id?.slice(0, 8)}...</strong>. 
                      Click below to simulate another technician clicking "Accept" on the exact same job at the same millisecond:
                    </p>

                    <button
                      onClick={handleSimulateConflict}
                      disabled={loading}
                      className="px-4 py-2 text-xs font-bold text-rose-300 bg-rose-950/80 hover:bg-rose-900 border border-rose-800 rounded-xl transition shadow active:scale-95"
                    >
                      Simulate Concurrent Double-Booking (Expect 409 Conflict)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
