'use client';

import React, { useState, useEffect } from 'react';
import {
  Building,
  Plus,
  RefreshCw,
  X,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Phone,
  Laptop,
  Users
} from 'lucide-react';
import { apiBranches, Branch } from '../../lib/api';

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '+255 22 211 0000'
  });

  const loadBranches = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiBranches.list();
      setBranches(data.branches || []);
    } catch (err: any) {
      console.error('Failed to load branches:', err);
      setError(err.message || 'Failed to load branch locations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBranches();
  }, []);

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (!formData.name) {
        throw new Error('Please enter a branch name.');
      }

      await apiBranches.create(formData);
      setSuccess(`Branch "${formData.name}" added to PostgreSQL.`);
      setIsAddModalOpen(false);
      setFormData({ name: '', address: '', phone: '+255 22 211 0000' });
      await loadBranches();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to create branch.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Building className="w-6 h-6 text-teal-400" />
            Branch Offices & Distribution Hubs
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Geographic laptop stock allocation, customer service branches, and local inventory managers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadBranches}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-navy-950 text-sm font-semibold flex items-center gap-2 shadow-lg shadow-teal-500/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Branch
          </button>
        </div>
      </div>

      {success && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Branches Grid */}
      {loading ? (
        <div className="glass-panel p-12 text-center rounded-2xl border border-slate-800 text-slate-400">
          <div className="w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Loading branch locations...
        </div>
      ) : branches.length === 0 ? (
        <div className="glass-panel p-12 text-center rounded-2xl border border-slate-800 text-slate-400">
          <Building className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <div className="text-base font-semibold text-white">No branches created yet</div>
          <p className="text-xs text-slate-400 mt-1">
            Click &quot;Add Branch&quot; to define your regional hubs (e.g. Arusha, Mwanza, Zanzibar).
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {branches.map(branch => (
            <div
              key={branch.id}
              className="glass-panel p-6 rounded-2xl border border-slate-800 hover:border-teal-500/40 transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="font-bold text-white text-base">{branch.name}</div>
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-teal-500/10 text-teal-400 border border-teal-500/20">
                    Active Hub
                  </span>
                </div>

                <div className="space-y-1.5 mt-3 text-xs text-slate-300">
                  {branch.address && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{branch.address}</span>
                    </div>
                  )}
                  {branch.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{branch.phone}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Laptop className="w-3.5 h-3.5 text-cyan-400" />
                  {branch._count?.devices || 0} Devices
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                  {branch._count?.employees || 0} Staff
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Branch Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-navy-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-teal-400" />
                <h3 className="text-base font-bold text-white">Add Branch Location</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBranch} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Branch Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Arusha Central Hub"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Physical Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Clock Tower Roundabout, Arusha"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Contact Phone</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+255 27 250 0000"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-navy-950 text-sm font-bold disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Add Branch Location'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
