'use client';

import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  Users,
  Building,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  X,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { apiEmployees, apiBranches, Employee, Branch } from '../../lib/api';

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    position: 'Loan Officer',
    branchId: '',
    role: 'AGENT'
  });

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [empRes, branchRes] = await Promise.all([
        apiEmployees.list(),
        apiBranches.list()
      ]);
      setEmployees(empRes.employees || []);
      setBranches(branchRes.branches || []);
      if (branchRes.branches?.length > 0 && !formData.branchId) {
        setFormData(prev => ({ ...prev, branchId: branchRes.branches[0].id }));
      }
    } catch (err: any) {
      console.error('Failed to load team members:', err);
      setError(err.message || 'Failed to load team directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (!formData.firstName || !formData.lastName || !formData.email) {
        throw new Error('Please fill in name and email address.');
      }

      await apiEmployees.create(formData);
      setSuccess(`Employee ${formData.firstName} ${formData.lastName} successfully registered.`);
      setIsAddModalOpen(false);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        position: 'Loan Officer',
        branchId: branches[0]?.id || '',
        role: 'AGENT'
      });
      await loadData();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to register employee.');
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
            <UserPlus className="w-6 h-6 text-blue-400" />
            Team Members & Branch Staff
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Role-based access control, branch assignments, and employee loan authorization privileges.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold flex items-center gap-2 shadow-lg shadow-blue-600/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Employee
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

      {/* Employees Grid */}
      {loading ? (
        <div className="glass-panel p-12 text-center rounded-2xl border border-slate-800 text-slate-400">
          <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Loading team directory...
        </div>
      ) : employees.length === 0 ? (
        <div className="glass-panel p-12 text-center rounded-2xl border border-slate-800 text-slate-400">
          <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <div className="text-base font-semibold text-white">No employees registered yet</div>
          <p className="text-xs text-slate-400 mt-1">
            Click &quot;Add Employee&quot; to invite a loan officer, manager, or inspection technician.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {employees.map(emp => (
            <div
              key={emp.id}
              className="glass-panel p-6 rounded-2xl border border-slate-800 hover:border-blue-500/40 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold text-white text-base">
                    {emp.firstName} {emp.lastName}
                  </div>
                  <div className="text-xs font-medium text-blue-400 mt-0.5">
                    {emp.position}
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {emp.user?.role || 'Staff'}
                </span>
              </div>

              <div className="space-y-1.5 mt-4 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span className="truncate">{emp.user?.email || 'No email registered'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  <span>{emp.branch?.name || 'Main Headquarters'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Employee Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-navy-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold text-white">Add Team Member</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEmployee} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Position</label>
                  <input
                    type="text"
                    value={formData.position}
                    onChange={e => setFormData({ ...formData, position: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Access Role</label>
                  <select
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="AGENT">Field Agent</option>
                    <option value="MANAGER">Branch Manager</option>
                    <option value="BUSINESS_OWNER">Executive / Owner</option>
                  </select>
                </div>
              </div>

              {branches.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Branch Location</label>
                  <select
                    value={formData.branchId}
                    onChange={e => setFormData({ ...formData, branchId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

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
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Register Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
