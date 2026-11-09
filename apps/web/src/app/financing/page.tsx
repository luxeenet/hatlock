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
  Users,
  Eye,
  ChevronLeft,
  ChevronRight,
  DollarSign
} from 'lucide-react';
import { apiFinancing, apiCustomers, apiDevices, FinancingAgreement, Customer, Device } from '../../lib/api';

export default function FinancingPage() {
  const [agreements, setAgreements] = useState<FinancingAgreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // View Agreement Detail Modal
  const [detailAgreementId, setDetailAgreementId] = useState<string | null>(null);
  const [agreementDetail, setAgreementDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

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
      setCurrentPage(1);
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

  const handleOpenDetail = async (id: string) => {
    setDetailAgreementId(id);
    setLoadingDetail(true);
    try {
      const res = await apiFinancing.get(id);
      setAgreementDetail(res.agreement);
    } catch (err: any) {
      setError(err.message || 'Failed to load agreement details.');
    } finally {
      setLoadingDetail(false);
    }
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

  const handleDownloadCertificate = async (agr: { id: string; agreementNumber: string }) => {
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

  const totalPages = Math.ceil(agreements.length / itemsPerPage) || 1;
  const paginated = agreements.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-400" />
            Hire Purchase Agreements & Ownership Discharge
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
            Strict verification: Business retains title until 100% payoff. Immediate digital certificate issued upon final discharge.
          </p>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3">
          <button
            onClick={loadAgreements}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleOpenCreateModal}
            className="px-3.5 sm:px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            Create HP Agreement
          </button>
        </div>
      </div>

      {success && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto text-xs glass-panel p-3 rounded-xl border border-slate-800 pb-2 sm:pb-3">
        {['ALL', 'ACTIVE', 'OVERDUE', 'GRACE_PERIOD', 'RESTRICTED', 'OWNERSHIP_TRANSFERRED'].map(f => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
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
        <div className="metis-card p-12 text-center rounded-xl border border-slate-800 text-slate-400">
          <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <div className="text-base font-semibold text-white">No agreements found</div>
          <p className="text-xs text-slate-400 mt-1">
            Click &quot;Create HP Agreement&quot; to finance a laptop with an automated instalment plan.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {paginated.map(agr => {
            const total = Number(agr.totalAmountTZS || 0);
            const remaining = Number(agr.remainingBalanceTZS || 0);
            const paid = Math.max(0, total - remaining);
            const progressPercent = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
            const customerName = agr.customer ? `${agr.customer.firstName} ${agr.customer.lastName}` : 'Customer';
            const deviceName = agr.device ? `${agr.device.manufacturer} ${agr.device.model} (${agr.device.serialNumber})` : 'Hardware Device';

            return (
              <div
                key={agr.id}
                className="metis-card p-5 sm:p-6 rounded-xl border border-slate-800/80 flex flex-col lg:flex-row lg:items-center justify-between gap-5 hover:border-indigo-500/30 transition-colors"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
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
                <div className="flex flex-wrap sm:flex-nowrap items-center justify-between lg:justify-end gap-3 sm:gap-4 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-800">
                  <div className="text-left lg:text-right">
                    <div className="text-xs text-slate-400">Remaining Balance</div>
                    <div className="text-base sm:text-lg font-bold text-white font-mono">
                      TZS {remaining.toLocaleString()}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {agr.paidInstalmentCount || 0} of {agr.instalmentCount} instalments paid
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenDetail(agr.id)}
                      title="View Schedule & Contract Details"
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Details
                    </button>

                    {agr.status === 'OWNERSHIP_TRANSFERRED' ? (
                      <button
                        onClick={() => handleDownloadCertificate(agr)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Certificate
                      </button>
                    ) : (
                      <div className="px-2.5 py-1 rounded-lg bg-slate-800 text-[11px] font-mono text-slate-400 border border-slate-700">
                        Title Retained
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {!loading && agreements.length > 0 && (
        <div className="glass-panel p-4 rounded-xl border border-slate-800 flex items-center justify-between text-xs text-slate-400 bg-navy-950/40">
          <div>
            Page <span className="font-semibold text-white">{currentPage}</span> of{' '}
            <span className="font-semibold text-white">{totalPages}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors flex items-center gap-1"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* View Agreement Details Modal */}
      {detailAgreementId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#121927] border border-slate-800 rounded-xl w-full max-w-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            {loadingDetail || !agreementDetail ? (
              <div className="p-12 text-center text-slate-400">
                <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                Loading contract and instalment schedule...
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <FileText className="w-5 h-5 text-indigo-400" />
                    <div>
                      <h2 className="text-base font-bold text-white font-mono">
                        {agreementDetail.agreementNumber}
                      </h2>
                      <span className="text-[11px] text-slate-400">
                        Status: <strong className="text-indigo-400">{agreementDetail.status}</strong>
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setDetailAgreementId(null);
                      setAgreementDetail(null);
                    }}
                    className="text-slate-400 hover:text-white p-1 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4 my-5 text-xs">
                  {/* Financial Terms Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 font-mono">
                    <div>
                      <span className="text-slate-400 block text-[10px]">TOTAL VALUE</span>
                      <span className="font-bold text-white text-sm">
                        TZS {Number(agreementDetail.purchasePriceTZS || agreementDetail.totalContractualTZS || 0).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">DOWN PAYMENT</span>
                      <span className="font-bold text-cyan-400 text-sm">
                        TZS {Number(agreementDetail.depositAmountTZS || 0).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">FINANCED</span>
                      <span className="font-bold text-indigo-400 text-sm">
                        TZS {Number(agreementDetail.financedBalanceTZS || 0).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">INSTALMENT</span>
                      <span className="font-bold text-emerald-400 text-sm">
                        TZS {Number(agreementDetail.instalmentAmountTZS || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Customer and Hardware */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block mb-1">Borrower</span>
                      <div className="font-bold text-white">
                        {agreementDetail.customer?.firstName} {agreementDetail.customer?.lastName}
                      </div>
                      <div className="text-slate-400 mt-0.5">Phone: {agreementDetail.customer?.phone}</div>
                    </div>

                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block mb-1">Financed Hardware</span>
                      <div className="font-bold text-white">
                        {agreementDetail.device?.manufacturer} {agreementDetail.device?.model}
                      </div>
                      <div className="font-mono text-cyan-400 mt-0.5">
                        S/N: {agreementDetail.device?.serialNumber}
                      </div>
                    </div>
                  </div>

                  {/* Instalments Schedule Table */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="font-bold text-white text-xs flex items-center justify-between">
                      <span>Repayment Schedule ({agreementDetail.instalments?.length || 0} instalments)</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        Frequency: {agreementDetail.paymentFrequency}
                      </span>
                    </div>

                    <div className="max-h-48 overflow-y-auto divide-y divide-slate-800/80">
                      {agreementDetail.instalments?.map((inst: any) => (
                        <div key={inst.id} className="py-2 flex items-center justify-between text-[11px] font-mono">
                          <div>
                            <span className="font-semibold text-slate-300">#{inst.instalmentNumber}</span>
                            <span className="text-slate-500 ml-2">
                              Due: {new Date(inst.dueDate).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-white">TZS {Number(inst.totalAmountTZS).toLocaleString()}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              inst.paidAmountTZS >= inst.totalAmountTZS
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-slate-800 text-slate-400'
                            }`}>
                              {inst.paidAmountTZS >= inst.totalAmountTZS ? 'PAID' : 'PENDING'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                  {agreementDetail.status === 'OWNERSHIP_TRANSFERRED' && (
                    <button
                      onClick={() => handleDownloadCertificate(agreementDetail)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Official Certificate
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setDetailAgreementId(null);
                      setAgreementDetail(null);
                    }}
                    className="ml-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create HP Agreement Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#121927] border border-slate-800 rounded-xl w-full max-w-lg p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
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

            <form onSubmit={handleCreateAgreement} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block font-medium text-slate-300 mb-1">
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
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
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
                <label className="block font-medium text-slate-300 mb-1">
                  Select Device to Finance *
                </label>
                {devices.length === 0 ? (
                  <div className="text-xs text-rose-400 p-2 bg-rose-500/10 rounded-lg">
                    No available devices found in inventory. Please register a device first.
                  </div>
                ) : (
                  <select
                    value={formData.deviceId}
                    onChange={e => setFormData({ ...formData, deviceId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  >
                    {devices.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.manufacturer} {d.model} (S/N: {d.serialNumber})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Total Valuation (TZS)</label>
                  <input
                    type="number"
                    required
                    value={formData.totalAmountTZS}
                    onChange={e => setFormData({ ...formData, totalAmountTZS: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Deposit / Down Payment (TZS)</label>
                  <input
                    type="number"
                    value={formData.downPaymentTZS}
                    onChange={e => setFormData({ ...formData, downPaymentTZS: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Payment Frequency</label>
                  <select
                    value={formData.paymentFrequency}
                    onChange={e => setFormData({ ...formData, paymentFrequency: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="DAILY">Daily Collections</option>
                    <option value="WEEKLY">Weekly Collections</option>
                    <option value="BIWEEKLY">Bi-Weekly Collections</option>
                    <option value="MONTHLY">Monthly Instalments</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Number of Instalments</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={formData.instalmentCount}
                    onChange={e => setFormData({ ...formData, instalmentCount: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Grace Period (Days)</label>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={formData.gracePeriodDays}
                    onChange={e => setFormData({ ...formData, gracePeriodDays: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || customers.length === 0 || devices.length === 0}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold disabled:opacity-50"
                >
                  {submitting ? 'Generating Schedules...' : 'Sign Agreement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
