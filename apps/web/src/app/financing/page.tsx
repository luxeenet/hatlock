'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Download,
  AlertCircle,
  Plus,
  ArrowRight,
  RefreshCw,
  X,
  Laptop,
  Users
} from 'lucide-react';
import { apiFinancing, apiCustomers, apiDevices, FinancingAgreement, Customer, Device } from '../../lib/api';

export default function FinancingPage() {
  const [agreements, setAgreements] = useState<FinancingAgreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    customerId: '',
    deviceId: '',
    totalAmountTZS: 1800000,
    downPaymentTZS: 300000,
    paymentFrequency: 'MONTHLY',
    instalmentCount: 6,
    startDate: new Date().toISOString().split('T')[0],
    gracePeriodDays: 3
  });

  const loadAgreements = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFinancing.list({
        status: statusFilter !== 'ALL' ? statusFilter : undefined
      });
      setAgreements(data.agreements || []);
    } catch (err: any) {
      console.error('Failed to load financing agreements:', err);
      setError(err.message || 'Failed to load financing agreements.');
    } finally {
      setLoading(false);
    }
  };

  const loadDependencies = async () => {
    try {
      const [cRes, dRes] = await Promise.all([apiCustomers.list(), apiDevices.list({ status: 'AVAILABLE' })]);
      setCustomers(cRes.customers || []);
      setDevices(dRes.devices || []);
      if (cRes.customers?.length > 0 && !formData.customerId) {
        setFormData(prev => ({ ...prev, customerId: cRes.customers[0].id }));
      }
      if (dRes.devices?.length > 0 && !formData.deviceId) {
        setFormData(prev => ({ ...prev, deviceId: dRes.devices[0].id }));
      }
    } catch (err) {
      console.warn('Failed to load dependency dropdowns:', err);
    }
  };

  useEffect(() => {
    loadAgreements();
  }, [statusFilter]);

  const handleOpenCreateModal = async () => {
    await loadDependencies();
    setIsCreateModalOpen(true);
  };

  const handleCreateAgreement = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (!formData.customerId || !formData.deviceId) {
        throw new Error('Please select both a verified customer and an available laptop.');
      }

      const res = await apiFinancing.create({
        ...formData,
        startDate: new Date(formData.startDate).toISOString(),
        totalAmountTZS: Number(formData.totalAmountTZS),
        downPaymentTZS: Number(formData.downPaymentTZS),
        instalmentCount: Number(formData.instalmentCount)
      });

      setSuccess(`Agreement ${res.agreement.agreementNumber} generated and signed in PostgreSQL.`);
      setIsCreateModalOpen(false);
      await loadAgreements();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to create financing agreement.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadCertificate = async (agr: FinancingAgreement) => {
    try {
      const blob = await apiFinancing.getCertificate(agr.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `HatLock_Ownership_Certificate_${agr.agreementNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setSuccess(`Downloaded official cryptographic ownership certificate for ${agr.agreementNumber}.`);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to download certificate.');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-400" />
            Hire Purchase Agreements & Ownership Discharge
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Strict verification: Business retains title until 100% payoff. Immediate digital certificate issued upon final discharge.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadAgreements}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            Create HP Agreement
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

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto text-xs glass-panel p-3 rounded-xl border border-slate-800">
        {['ALL', 'ACTIVE', 'OVERDUE', 'GRACE_PERIOD', 'RESTRICTED', 'OWNERSHIP_TRANSFERRED'].map(f => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              statusFilter === f
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            {f.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Agreements List */}
      {loading ? (
        <div className="glass-panel p-12 text-center rounded-2xl border border-slate-800 text-slate-400">
          <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Loading hire purchase agreements from PostgreSQL...
        </div>
      ) : agreements.length === 0 ? (
        <div className="glass-panel p-12 text-center rounded-2xl border border-slate-800 text-slate-400">
          <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <div className="text-base font-semibold text-white">No agreements found</div>
          <p className="text-xs text-slate-400 mt-1">
            Click &quot;Create HP Agreement&quot; to finance a laptop with an automated daily/monthly instalment plan.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {agreements.map(agr => {
            const total = Number(agr.totalAmountTZS || 0);
            const remaining = Number(agr.remainingBalanceTZS || 0);
            const paid = Math.max(0, total - remaining);
            const progressPercent = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
            const customerName = agr.customer ? `${agr.customer.firstName} ${agr.customer.lastName}` : 'Customer';
            const deviceName = agr.device ? `${agr.device.manufacturer} ${agr.device.model} (${agr.device.serialNumber})` : 'Hardware Device';

            return (
              <div
                key={agr.id}
                className="glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-6 hover:border-indigo-500/30 transition-colors"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-white text-base">
                      {agr.agreementNumber}
                    </span>
                    {agr.status === 'OWNERSHIP_TRANSFERRED' ? (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Ownership Transferred (Paid in Full)
                      </span>
                    ) : agr.status === 'ACTIVE' ? (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        In Progress
                      </span>
                    ) : agr.status === 'GRACE_PERIOD' ? (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        Grace Period
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        {agr.status}
                      </span>
                    )}
                  </div>

                  <div className="text-sm font-semibold text-slate-200">
                    {customerName} &bull; <span className="text-indigo-400">{deviceName}</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5 max-w-md">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Repayment Progress</span>
                      <span className="font-mono text-white font-medium">
                        TZS {paid.toLocaleString()} / {total.toLocaleString()} ({progressPercent}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          agr.status === 'OWNERSHIP_TRANSFERRED' ? 'bg-emerald-500' : 'bg-indigo-500'
                        }`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Right Action Block */}
                <div className="flex flex-col sm:flex-row items-start lg:items-center gap-4">
                  <div className="text-left lg:text-right">
                    <div className="text-xs text-slate-400">Remaining Balance</div>
                    <div className="text-lg font-bold text-white font-mono">
                      TZS {remaining.toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-500">
                      {agr.paidInstalmentCount || 0} of {agr.instalmentCount} instalments paid
                    </div>
                  </div>

                  {agr.status === 'OWNERSHIP_TRANSFERRED' ? (
                    <button
                      onClick={() => handleDownloadCertificate(agr)}
                      className="px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-sm font-semibold flex items-center gap-2 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Ownership Certificate
                    </button>
                  ) : (
                    <div className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-mono text-slate-400 border border-slate-700">
                      Title Held by Lessor
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create HP Agreement Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-navy-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-bold text-white">Create Hire Purchase Agreement</h2>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAgreement} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Select Borrower (KYC Customer) *
                </label>
                {customers.length === 0 ? (
                  <div className="text-xs text-rose-400 p-2 bg-rose-500/10 rounded-lg">
                    No customers found. Please add a customer in the Customers tab first.
                  </div>
                ) : (
                  <select
                    value={formData.customerId}
                    onChange={e => setFormData({ ...formData, customerId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.firstName} {c.lastName} ({c.idNumber}) - {c.phone}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Select Device to Finance *
                </label>
                {devices.length === 0 ? (
                  <div className="text-xs text-rose-400 p-2 bg-rose-500/10 rounded-lg">
                    No available laptops in inventory. Register an available laptop first.
                  </div>
                ) : (
                  <select
                    value={formData.deviceId}
                    onChange={e => setFormData({ ...formData, deviceId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    {devices.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.manufacturer} {d.model} &bull; S/N: {d.serialNumber}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Total Financed Price (TZS)</label>
                  <input
                    type="number"
                    value={formData.totalAmountTZS}
                    onChange={e => setFormData({ ...formData, totalAmountTZS: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Down Payment (TZS)</label>
                  <input
                    type="number"
                    value={formData.downPaymentTZS}
                    onChange={e => setFormData({ ...formData, downPaymentTZS: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Instalment Frequency</label>
                  <select
                    value={formData.paymentFrequency}
                    onChange={e => setFormData({ ...formData, paymentFrequency: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="BIWEEKLY">Bi-Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Number of Instalments</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={formData.instalmentCount}
                    onChange={e => setFormData({ ...formData, instalmentCount: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400">
                Instalment amount:{' '}
                <strong className="text-indigo-400 font-mono">
                  TZS {Math.round((formData.totalAmountTZS - formData.downPaymentTZS) / (formData.instalmentCount || 1)).toLocaleString()}
                </strong>{' '}
                per period.
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || customers.length === 0 || devices.length === 0}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold disabled:opacity-50"
                >
                  {submitting ? 'Generating Contract...' : 'Create & Sign Agreement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
