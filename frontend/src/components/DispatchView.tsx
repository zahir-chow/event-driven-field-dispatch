import React, { useState, useEffect } from 'react';
import type { WorkOrder, Assignment, Candidate } from '../types';
import { listWorkOrders, matchAssignment, acceptAssignment, getAssignment } from '../api';
import { Zap, ShieldAlert, CheckCircle, Star, DollarSign, Award, AlertTriangle } from 'lucide-react';

interface DispatchViewProps {
  selectedOrder: WorkOrder | null;
  onSelectOrder: (order: WorkOrder | null) => void;
  onEventTriggered: () => void;
}

export const DispatchView: React.FC<DispatchViewProps> = ({
  selectedOrder,
  onSelectOrder,
  onEventTriggered,
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
      // Check if assignment exists
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
      onEventTriggered();
    } catch (err: any) {
      alert(`Matching error: ${err.response?.data?.detail || err.message}`);
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
      onEventTriggered();
      fetchOrders();
    } catch (err: any) {
      if (err.response?.status === 409) {
        setConcurrencyStatus({
          message: `409 Conflict: Optimistic Concurrency Control blocked duplicate claim! ${err.response?.data?.detail || ''}`,
          type: 'error',
        });
      } else {
        alert(`Error: ${err.response?.data?.detail || err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateConflict = async () => {
    if (!selectedOrder || !assignment) return;
    setLoading(true);
    try {
      // Simulate another technician clicking Accept with expected_version = 1
      await acceptAssignment(selectedOrder.id, 'fake-concurrent-provider-uuid-999', 1);
      setConcurrencyStatus({
        message: 'Unexpectedly succeeded!',
        type: 'success',
      });
    } catch (err: any) {
      if (err.response?.status === 409) {
        setConcurrencyStatus({
          message: `🛡️ TOCTOU Race Condition Successfully Prevented! Server rejected with HTTP 409 Conflict: "${err.response.data.detail}". Only 1 technician can ever claim this job.`,
          type: 'error',
        });
      } else {
        alert(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center space-x-2">
          <Zap className="w-6 h-6 text-amber-400" />
          <span>Dispatch & Strategy Matching Studio</span>
        </h1>
        <p className="text-sm text-slate-400">
          Pluggable Strategy Pattern ranking engine with Optimistic Locking concurrency protection
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Order & Strategy Selector */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5 shadow-lg">
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
              1. Select Open Work Order
            </label>
            {openOrders.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500 bg-slate-950 rounded-lg border border-slate-800">
                No open work orders available. Create one in the Work Orders tab!
              </div>
            ) : (
              <select
                value={selectedOrder?.id || ''}
                onChange={(e) => {
                  const found = openOrders.find((o) => o.id === e.target.value);
                  if (found) onSelectOrder(found);
                }}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
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
            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg text-xs space-y-2">
              <div className="font-semibold text-white">{selectedOrder.title}</div>
              <div className="text-slate-400">{selectedOrder.description}</div>
              <div className="flex flex-wrap gap-1 pt-1">
                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                  Zip: {selectedOrder.zip_code}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                  Budget: ${selectedOrder.max_budget || 0}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono">
                  v{selectedOrder.version}
                </span>
              </div>
              <div className="flex flex-wrap gap-1 pt-1">
                {selectedOrder.required_skills.map((s) => (
                  <span key={s} className="px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/40">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
              2. Choose Ranking Strategy (Strategy Pattern)
            </label>
            <div className="space-y-2">
              <label
                onClick={() => setStrategy('rating')}
                className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition ${
                  strategy === 'rating'
                    ? 'bg-indigo-950/40 border-indigo-500 text-white'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Star className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-sm">RatingRankingStrategy</div>
                  <div className="text-xs text-slate-400">Prioritizes technicians with the highest review scores.</div>
                </div>
              </label>

              <label
                onClick={() => setStrategy('cost')}
                className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition ${
                  strategy === 'cost'
                    ? 'bg-indigo-950/40 border-indigo-500 text-white'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <DollarSign className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-sm">CostRankingStrategy</div>
                  <div className="text-xs text-slate-400">Prioritizes the lowest hourly rate for budget efficiency.</div>
                </div>
              </label>

              <label
                onClick={() => setStrategy('distance')}
                className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition ${
                  strategy === 'distance'
                    ? 'bg-indigo-950/40 border-indigo-500 text-white'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Award className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-sm">DistanceRankingStrategy</div>
                  <div className="text-xs text-slate-400">Weights proximity to site zip code for fast response.</div>
                </div>
              </label>
            </div>
          </div>

          <button
            onClick={handleMatch}
            disabled={!selectedOrder || loading}
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold text-sm shadow-lg shadow-indigo-500/25 transition disabled:opacity-50"
          >
            <Zap className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Execute Strategy Matching</span>
          </button>
        </div>

        {/* Right 2 Cols: Matched Candidates & Concurrency Simulator */}
        <div className="lg:col-span-2 space-y-5">
          {/* Concurrency Banner */}
          {concurrencyStatus.type !== 'idle' && (
            <div
              className={`p-4 rounded-xl border flex items-start space-x-3 shadow-md ${
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
              <div className="text-sm font-medium">{concurrencyStatus.message}</div>
            </div>
          )}

          {/* Matched Results Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base">Matched Candidate Technicians</h3>
                <p className="text-xs text-slate-400">
                  {assignment
                    ? `Strategy: ${assignment.strategy_used || strategy} • Status: ${assignment.status} (v${assignment.version})`
                    : 'Click "Execute Strategy Matching" to run the algorithm'}
                </p>
              </div>

              {assignment && assignment.status === 'ACCEPTED' && (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center space-x-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Job Claimed & Locked</span>
                </span>
              )}
            </div>

            {!assignment || !assignment.candidates || assignment.candidates.length === 0 ? (
              <div className="py-12 text-center text-slate-500 space-y-2">
                <AlertTriangle className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-sm">No matched candidates yet.</p>
                <p className="text-xs text-slate-600">
                  The strategy engine filters providers by skills and zip code, then ranks by your selected algorithm.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {assignment.candidates.map((cand, idx) => (
                  <div
                    key={cand.provider_id}
                    className={`p-4 rounded-xl border transition flex items-center justify-between ${
                      assignment.provider_id === cand.provider_id
                        ? 'bg-cyan-950/30 border-cyan-500'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center space-x-4">
                      {/* Rank Badge */}
                      <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-sm text-indigo-400 border border-slate-700">
                        #{idx + 1}
                      </div>

                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-white text-sm">{cand.name}</span>
                          <span className="text-xs text-slate-500 font-mono">
                            Score: {cand.score.toFixed(2)}
                          </span>
                        </div>

                        <div className="flex items-center space-x-3 text-xs text-slate-400 mt-1">
                          <span className="flex items-center space-x-1 text-amber-400">
                            <Star className="w-3 h-3 fill-amber-400" />
                            <span>{cand.rating.toFixed(1)}</span>
                          </span>
                          <span className="text-emerald-400">
                            ${cand.hourly_rate ? cand.hourly_rate.toFixed(0) : 0}/hr
                          </span>
                          <span className="text-slate-500">
                            Matched: {cand.matching_skills.join(', ')}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      {assignment.provider_id === cand.provider_id ? (
                        <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-500 text-slate-950 flex items-center space-x-1 shadow">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Assigned</span>
                        </span>
                      ) : assignment.status === 'ACCEPTED' ? (
                        <span className="text-xs text-slate-500 font-medium">Position Filled</span>
                      ) : (
                        <button
                          onClick={() => handleAccept(cand)}
                          disabled={loading}
                          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition shadow-sm disabled:opacity-50"
                        >
                          Accept Job
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Concurrency Testing Box */}
                {assignment && assignment.status === 'ACCEPTED' && (
                  <div className="mt-6 p-4 rounded-xl bg-slate-950 border border-rose-900/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-rose-400 font-semibold text-sm">
                        <ShieldAlert className="w-4 h-4" />
                        <span>Test Concurrency / Double-Booking Race Condition</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-500">TOCTOU Guard</span>
                    </div>

                    <p className="text-xs text-slate-400">
                      This order is already claimed by <strong className="text-white">{assignment.provider_id?.slice(0, 8)}...</strong>. 
                      Click the button below to simulate another technician trying to claim this exact same job at the same time:
                    </p>

                    <button
                      onClick={handleSimulateConflict}
                      disabled={loading}
                      className="px-4 py-2 text-xs font-semibold text-rose-300 bg-rose-950/80 hover:bg-rose-900 border border-rose-800 rounded-lg transition"
                    >
                      Trigger Simulated Race Condition (Expect 409 Conflict)
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
