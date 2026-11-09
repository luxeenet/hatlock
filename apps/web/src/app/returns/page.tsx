'use client';

import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  Laptop,
  PackageCheck,
  Search,
  Plus,
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
  X,
  ShieldCheck,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { apiReturns, apiRentals, DeviceReturn, RentalAgreement } from '../../lib/api';

export default function ReturnsPage() {
  const [returns, setReturns] = useState<DeviceReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Initiate Return Modal
  const [isInitiateModalOpen, setIsInitiateModalOpen] = useState(false);
  const [rentalAgreements, setRentalAgreements] = useState<RentalAgreement[]>([]);
  const [selectedRental, setSelectedRental] = useState<RentalAgreement | null>(null);
  const [returnReason, setReturnReason] = useState('END_OF_LEASE');
  const [submittingReturn, setSubmittingReturn] = useState(false);

  // Complete Inspection Modal
  const [inspectingReturn, setInspectingReturn] = useState<DeviceReturn | null>(null);
  const [inspectionRating, setInspectionRating] = useState('GOOD');
  const [inspectionResult, setInspectionResult] = useState('PASS');
  const [damageNotes, setDamageNotes] = useState('');
  const [repairCost, setRepairCost] = useState('0');
  const [refundAmount, setRefundAmount] = useState('250000');
  const [submittingInspection, setSubmittingInspection] = useState(false);

  const loadReturns = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiReturns.list();
      setReturns(data.returns || []);
    } catch (err: any) {
      console.error('Failed to load device returns:', err);
      setError(err.message || 'Failed to load device returns.');
    } finally {
      setLoading(false);
    }
  };

  const loadRentals = async () => {
    try {
      const data = await apiRentals.list();
      setRentalAgreements(data.rentals || []);
      if (data.rentals?.length > 0) {
        setSelectedRental(data.rentals[0]);
      }
    } catch (err) {
      console.warn('Failed to load rentals:', err);
    }
  };

  useEffect(() => {
    loadReturns();
  }, []);

  const handleOpenInitiateModal = async () => {
    await loadRentals();
    setIsInitiateModalOpen(true);
  };

  const handleInitiateReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRental || !selectedRental.device) {
      setError('Please select an active rental agreement.');
      return;
    }
    setSubmittingReturn(true);
    setError(null);

    try {
      const res = await apiReturns.create({
        agreementId: selectedRental.id,
        deviceId: selectedRental.deviceId,
        reason: returnReason,
        conditionNotes: `Return initiated for ${selectedRental.agreementNumber}`
      });

      setSuccessMsg(`Return workflow opened for device ${selectedRental.device.serialNumber}. Physical inspection queued.`);
      setIsInitiateModalOpen(false);
      await loadReturns();
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to initiate return.');
    } finally {
      setSubmittingReturn(false);
    }
  };

  const handleCompleteInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectingReturn) return;
    setSubmittingInspection(true);
    setError(null);

    try {
      await apiReturns.inspect(inspectingReturn.id, {
        result: inspectionResult as any,
        conditionRating: inspectionRating as any,
        damageNotes,
        repairCostEstimateTZS: Number(repairCost) || 0,
        refundSecurityDepositTZS: Number(refundAmount) || 0
      });

      setSuccessMsg(
        `Device inspection verified. Security deposit reconciliation recorded in PostgreSQL.`
      );
      setInspectingReturn(null);
      await loadReturns();
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to complete inspection.');
    } finally {
      setSubmittingInspection(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <RotateCcw className="w-6 h-6 text-rose-400" />
            Device Returns & Physical Inspection
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Manage rental device collection, condition assessment, and security deposit reconciliation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadReturns}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleOpenInitiateModal}
            className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-sm font-semibold flex items-center gap-2 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Initiate Return
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Returns List */}
      {loading ? (
        <div className="glass-panel p-12 text-center rounded-2xl border border-slate-800 text-slate-400">
          <div className="w-8 h-8 border-2 border-rose-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Loading return workflows from PostgreSQL...
        </div>
      ) : returns.length === 0 ? (
        <div className="glass-panel p-12 text-center rounded-2xl border border-slate-800 text-slate-400">
          <RotateCcw className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <div className="text-base font-semibold text-white">No return workflows currently open</div>
          <p className="text-xs text-slate-400 mt-1">
            When a rental contract ends or a customer returns leased hardware, click &quot;Initiate Return&quot;.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {returns.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(ret => {
            const customerName = ret.customer ? `${ret.customer.firstName} ${ret.customer.lastName}` : 'Customer';
            const deviceName = ret.device ? `${ret.device.manufacturer} ${ret.device.model} (${ret.device.serialNumber})` : 'Hardware Device';

            return (
              <div
                key={ret.id}
                className="metis-card p-6 rounded-xl border border-slate-800/80 hover:border-rose-500/30 transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-white text-base">
                        Return #{ret.id.slice(0, 8)}
                      </span>
                      {ret.status === 'COMPLETED' ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Inspection Passed & Reconciled
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          Pending Physical Inspection
                        </span>
                      )}
                    </div>

                    <div className="text-sm font-semibold text-white">
                      {customerName} &bull; <span className="text-rose-400">{deviceName}</span>
                    </div>

                    <div className="text-xs text-slate-400 flex flex-wrap gap-4">
                      <span>Requested On: <strong className="text-slate-300">{new Date(ret.requestedAt).toLocaleDateString()}</strong></span>
                      {ret.inspection && (
                        <span>Condition Rating: <strong className="text-emerald-400">{ret.inspection.conditionRating}</strong></span>
                      )}
                    </div>
                  </div>

                  <div>
                    {ret.status !== 'COMPLETED' ? (
                      <button
                        onClick={() => {
                          setInspectingReturn(ret);
                          setRefundAmount('250000');
                        }}
                        className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-navy-950 text-sm font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                      >
                        <PackageCheck className="w-4 h-4" />
                        Inspect & Reconcile
                      </button>
                    ) : (
                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-emerald-400 text-right">
                        Deposit Refunded: TZS {ret.inspection?.refundSecurityDepositTZS?.toLocaleString() || '0'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Pagination Controls */}
          {returns.length > itemsPerPage && (
            <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 bg-navy-950/40 rounded-xl">
              <div>
                Page <span className="font-semibold text-white">{currentPage}</span> of{' '}
                <span className="font-semibold text-white">{Math.ceil(returns.length / itemsPerPage) || 1}</span>
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
                  onClick={() => setCurrentPage(prev => Math.min(Math.ceil(returns.length / itemsPerPage) || 1, prev + 1))}
                  disabled={currentPage === Math.ceil(returns.length / itemsPerPage) || currentPage * itemsPerPage >= returns.length}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors flex items-center gap-1"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Initiate Return Modal */}
      {isInitiateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#121927] border border-slate-800 rounded-xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-rose-400" />
                <h3 className="text-base font-bold text-white">Initiate Hardware Return Workflow</h3>
              </div>
              <button
                onClick={() => setIsInitiateModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInitiateReturn} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Select Leased Laptop Agreement *
                </label>
                {rentalAgreements.length === 0 ? (
                  <div className="text-xs text-rose-400 p-2 bg-rose-500/10 rounded-lg">
                    No active rental agreements found.
                  </div>
                ) : (
                  <select
                    value={selectedRental?.id || ''}
                    onChange={e => {
                      const found = rentalAgreements.find(r => r.id === e.target.value);
                      setSelectedRental(found || null);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500"
                  >
                    {rentalAgreements.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.agreementNumber} - {r.customer?.firstName} {r.customer?.lastName} ({r.device?.serialNumber})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Return Reason</label>
                <select
                  value={returnReason}
                  onChange={e => setReturnReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="END_OF_LEASE">Contract Concluded (End of Lease)</option>
                  <option value="EARLY_TERMINATION">Early Voluntary Return</option>
                  <option value="HARDWARE_REPOSSESSION">Repossession / Non-Payment</option>
                  <option value="HARDWARE_UPGRADE">Exchange for Hardware Upgrade</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsInitiateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReturn || !selectedRental}
                  className="px-5 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-sm font-bold disabled:opacity-50"
                >
                  {submittingReturn ? 'Initiating...' : 'Open Return Case'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Inspection Modal */}
      {inspectingReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#121927] border border-slate-800 rounded-xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <PackageCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Device Condition Inspection</h3>
              </div>
              <button
                onClick={() => setInspectingReturn(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCompleteInspection} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Inspection Result</label>
                  <select
                    value={inspectionResult}
                    onChange={e => setInspectionResult(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="PASS">Pass (Clean Return)</option>
                    <option value="PASS_WITH_MINOR_DAMAGE">Pass (Minor Wear/Scratch)</option>
                    <option value="FAIL_SIGNIFICANT_DAMAGE">Fail (Significant Damage)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Condition Rating</label>
                  <select
                    value={inspectionRating}
                    onChange={e => setInspectionRating(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="EXCELLENT">Excellent (Like New)</option>
                    <option value="GOOD">Good (Normal Wear)</option>
                    <option value="FAIR">Fair (Needs Polish)</option>
                    <option value="POOR">Poor (Requires Repairs)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Repair Cost (TZS)</label>
                  <input
                    type="number"
                    value={repairCost}
                    onChange={e => setRepairCost(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Refund Security Deposit (TZS)</label>
                  <input
                    type="number"
                    value={refundAmount}
                    onChange={e => setRefundAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Inspection Damage Notes</label>
                <textarea
                  rows={2}
                  value={damageNotes}
                  onChange={e => setDamageNotes(e.target.value)}
                  placeholder="Checked screen, keyboard, battery health, and charger accessory"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setInspectingReturn(null)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingInspection}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-navy-950 text-sm font-bold disabled:opacity-50"
                >
                  {submittingInspection ? 'Submitting...' : 'Sign & Complete Inspection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
