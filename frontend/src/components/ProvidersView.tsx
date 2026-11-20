import React, { useState, useEffect } from 'react';
import type { Provider } from '../types';
import { listProviders, createProvider } from '../api';
import {
  Users,
  Star,
  Plus,
  RefreshCw,
  CheckCircle2,
  Search,
  MapPin,
  DollarSign,
  ShieldCheck,
  Phone,
  Mail,
} from 'lucide-react';

interface ProvidersViewProps {
  onShowToast: (type: 'success' | 'error' | 'info', title: string, message?: string) => void;
}

export const ProvidersView: React.FC<ProvidersViewProps> = ({ onShowToast }) => {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showRegisterModal, setShowRegisterModal] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '+1-555-0199',
    skills: 'Fiber Optic, Networking',
    service_zip_codes: '75001, 75002, 75201',
    hourly_rate: '75',
  });

  const fetchProviders = async () => {
    setLoading(true);
    try {
      const data = await listProviders(100);
      setProviders(data);
    } catch (err: any) {
      onShowToast('error', 'Failed to load technicians', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const p = await createProvider({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        skills: formData.skills.split(',').map((s) => s.trim()).filter(Boolean),
        service_zip_codes: formData.service_zip_codes.split(',').map((s) => s.trim()).filter(Boolean),
        hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : undefined,
      });

      setShowRegisterModal(false);
      setFormData({
        name: '',
        email: '',
        phone: '+1-555-0199',
        skills: 'Fiber Optic, Networking',
        service_zip_codes: '75001, 75002, 75201',
        hourly_rate: '75',
      });
      onShowToast('success', 'Technician Onboarded', `Added ${p.name} to the active field contractor roster.`);
      await fetchProviders();
    } catch (err: any) {
      onShowToast('error', 'Registration Failed', err.response?.data?.detail || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredProviders = providers.filter((p) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const matchesSkill = p.skills.some((s) => s.toLowerCase().includes(query));
    const matchesZip = p.service_zip_codes.some((z) => z.includes(query));
    const matchesName = p.name.toLowerCase().includes(query);
    return matchesSkill || matchesZip || matchesName;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Technician Marketplace</h1>
          <p className="text-xs text-slate-400">
            Verified field workforce roster with skill matrices, hourly economics, and geographic coverage
          </p>
        </div>

        <button
          onClick={() => setShowRegisterModal(true)}
          className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/25 transition active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Onboard Technician</span>
        </button>
      </div>

      {/* Search and Filter */}
      <div className="bg-slate-900/90 border border-slate-800/80 p-3 rounded-2xl shadow-sm">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by skill (e.g. Fiber Optic, CCTV), zip code (75001), or name..."
            className="w-full pl-9 pr-4 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Grid of Provider Cards */}
      {loading && providers.length === 0 ? (
        <div className="p-12 text-center text-slate-500">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
          Loading technicians from PostgreSQL...
        </div>
      ) : filteredProviders.length === 0 ? (
        <div className="p-12 text-center text-slate-500 bg-slate-900/90 border border-slate-800/80 rounded-2xl">
          No technicians matched your search filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProviders.map((p) => {
            const initials = p.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase();

            return (
              <div
                key={p.id}
                className="bg-slate-900/90 border border-slate-800/80 hover:border-slate-700 rounded-2xl p-5 shadow-lg transition flex flex-col justify-between"
              >
                <div className="space-y-4">
                  {/* Top Profile */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-900 to-indigo-700 border border-indigo-600/30 flex items-center justify-center font-bold text-xs text-indigo-200">
                        {initials}
                      </div>
                      <div>
                        <div className="flex items-center space-x-1.5">
                          <h3 className="font-bold text-white text-sm">{p.name}</h3>
                          <span title="Background Verified">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono truncate">{p.email}</p>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        p.status === 'AVAILABLE'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>

                  {/* Rating & Rate Metrics Box */}
                  <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-slate-950/70 rounded-xl text-center border border-slate-800/70">
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Rating</div>
                      <div className="text-xs font-bold text-amber-400 flex items-center justify-center space-x-1 mt-0.5">
                        <Star className="w-3 h-3 fill-amber-400" />
                        <span>{p.rating.toFixed(1)}</span>
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Rate</div>
                      <div className="text-xs font-bold text-emerald-400 mt-0.5">
                        ${p.hourly_rate ? p.hourly_rate.toFixed(0) : '—'}/hr
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Jobs Done</div>
                      <div className="text-xs font-bold text-slate-200 mt-0.5">{p.total_jobs}</div>
                    </div>
                  </div>

                  {/* Skills */}
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Verified Capabilities
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {p.skills.map((skill) => (
                        <span
                          key={skill}
                          className="px-2 py-0.5 rounded text-[10px] bg-indigo-950/60 text-indigo-300 border border-indigo-800/40 font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Covered Zips */}
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Coverage Zones
                    </div>
                    <div className="flex flex-wrap gap-1 text-[11px] text-slate-300 font-mono">
                      {p.service_zip_codes.map((zip) => (
                        <span key={zip} className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800">
                          {zip}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-3.5 mt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                  <span>ID: {p.id.slice(0, 8)}...</span>
                  <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Active Contract</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Onboard Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Users className="w-5 h-5 text-indigo-400" />
                <span>Onboard Contractor to Provider Network</span>
              </h3>
              <button onClick={() => setShowRegisterModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Billing Rate ($/hr)</label>
                  <input
                    type="number"
                    value={formData.hourly_rate}
                    onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Direct Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Skills Matrix (Comma separated)
                </label>
                <input
                  type="text"
                  required
                  value={formData.skills}
                  onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Covered Zip Codes (Comma separated)
                </label>
                <input
                  type="text"
                  required
                  value={formData.service_zip_codes}
                  onChange={(e) => setFormData({ ...formData, service_zip_codes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/25 transition disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : 'Confirm Registration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
