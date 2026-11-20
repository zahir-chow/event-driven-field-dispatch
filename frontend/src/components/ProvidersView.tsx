import React, { useState, useEffect } from 'react';
import type { Provider } from '../types';
import { listProviders, createProvider } from '../api';
import { Users, Star, Plus, RefreshCw, CheckCircle2, Search } from 'lucide-react';

export const ProvidersView: React.FC = () => {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchSkill, setSearchSkill] = useState<string>('');
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
    } catch (err) {
      console.error('Failed to load providers', err);
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
      await createProvider({
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
      await fetchProviders();
    } catch (err: any) {
      alert(`Error registering provider: ${err.response?.data?.detail || err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredProviders = providers.filter((p) => {
    if (!searchSkill) return true;
    const query = searchSkill.toLowerCase();
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
          <h1 className="text-2xl font-bold tracking-tight text-white">Technicians & Providers</h1>
          <p className="text-sm text-slate-400">
            Supply side: Verified field contractors with skill matrices and geographic coverage
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchProviders}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-2 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setShowRegisterModal(true)}
            className="flex items-center space-x-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-md shadow-indigo-500/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Onboard Technician</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchSkill}
          onChange={(e) => setSearchSkill(e.target.value)}
          placeholder="Filter by skill, zip code (e.g. 75001), or name..."
          className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* Grid of Provider Cards */}
      {loading && providers.length === 0 ? (
        <div className="p-12 text-center text-slate-500">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
          Loading technicians from PostgreSQL...
        </div>
      ) : filteredProviders.length === 0 ? (
        <div className="p-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-xl">
          No technicians matched your filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProviders.map((p) => (
            <div
              key={p.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-5 shadow-lg transition flex flex-col justify-between"
            >
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-white text-base">{p.name}</h3>
                    <p className="text-xs text-slate-400">{p.email}</p>
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                      p.status === 'AVAILABLE'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {p.status}
                  </span>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-slate-950/60 rounded-lg text-center border border-slate-800/80">
                  <div>
                    <div className="text-[11px] text-slate-400">Rating</div>
                    <div className="text-sm font-bold text-amber-400 flex items-center justify-center space-x-1">
                      <Star className="w-3.5 h-3.5 fill-amber-400" />
                      <span>{p.rating.toFixed(1)}</span>
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] text-slate-400">Rate</div>
                    <div className="text-sm font-bold text-emerald-400">
                      ${p.hourly_rate ? p.hourly_rate.toFixed(0) : '—'}/hr
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] text-slate-400">Jobs</div>
                    <div className="text-sm font-bold text-slate-200">{p.total_jobs}</div>
                  </div>
                </div>

                {/* Skills */}
                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Verified Skills
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {p.skills.map((skill) => (
                      <span
                        key={skill}
                        className="px-2 py-0.5 rounded text-xs bg-indigo-950/60 text-indigo-300 border border-indigo-800/40 font-medium"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Zip Coverage */}
                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Zip Code Coverage
                  </div>
                  <div className="flex flex-wrap gap-1 text-xs text-slate-300 font-mono">
                    {p.service_zip_codes.map((zip) => (
                      <span key={zip} className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">
                        {zip}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500 font-mono">
                <span>ID: {p.id.slice(0, 8)}...</span>
                <span className="text-emerald-400 flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>W-9 Verified</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Onboard Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <Users className="w-5 h-5 text-indigo-400" />
                <span>Onboard New Technician</span>
              </h3>
              <button
                onClick={() => setShowRegisterModal(false)}
                className="text-slate-400 hover:text-white transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. John Doe"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="john@fieldpro.com"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Hourly Rate ($/hr)</label>
                  <input
                    type="number"
                    value={formData.hourly_rate}
                    onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                    placeholder="75"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+1-555-0199"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Skills (Comma separated)
                </label>
                <input
                  type="text"
                  required
                  value={formData.skills}
                  onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                  placeholder="CCTV, Fiber Optic, Hardware Repair"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Covered Zip Codes (Comma separated)
                </label>
                <input
                  type="text"
                  required
                  value={formData.service_zip_codes}
                  onChange={(e) => setFormData({ ...formData, service_zip_codes: e.target.value })}
                  placeholder="75001, 75002, 75201"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-md shadow-indigo-500/20 transition disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : 'Register Technician'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
