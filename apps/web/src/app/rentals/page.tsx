'use client';

import React, { useState, useEffect } from 'react';
import {
  Repeat,
  Shield,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  X,
  Laptop,
  Users,
  Eye,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { apiRentals, apiCustomers, apiDevices, RentalAgreement, Customer, Device } from '../../lib/api';

export default function RentalsPage() {
  const [rentals, setRentals] = useState<RentalAgreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // View Details Modal
  const [detailRentalId, setDetailRentalId] = useState<string | null>(null);
  const [rentalDetail, setRentalDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    customerId: '',
    deviceId: '',
    rentalRatePerPeriodTZS: 150000,
    paymentFrequency: 'MONTHLY',
    durationPeriods: 3,
    securityDepositTZS: 300000,
    startDate: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const loadRentals = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRentals.list();
      setRentals(data.rentals || []);
      setCurrentPage(1);
    } catch (err: any) {
      console.error('Failed to load rentals:', err);
      setError(err.message || 'Failed to load rental agreements.');
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
    loadRentals();
  }, []);

  const handleOpenCreateModal = async () => {
    await loadDependencies();
    setIsCreateModalOpen(true);
  };

  const handleOpenDetail = async (id: string) => {
    setDetailRentalId(id);
    setLoadingDetail(true);
    try {
      const res = await apiRentals.get(id);
      setRentalDetail(res.rental);
    } catch (err: any) {
      setError(err.message || 'Failed to load rental agreement details.');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCreateRental = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (!formData.customerId || !formData.deviceId) {
        throw new Error('Please select both a verified customer and an available laptop.');
      }

      const res = await apiRentals.create({
        ...formData,
        startDate: new Date(formData.startDate).toISOString(),
        rentalRatePerPeriodTZS: Number(formData.rentalRatePerPeriodTZS),
        durationPeriods: Number(formData.durationPeriods),
        securityDepositTZS: Number(formData.securityDepositTZS)
      });

      setSuccess(`Rental agreement ${res.rental.agreementNumber} created in PostgreSQL. Business ownership strictly retained.`);
      setIsCreateModalOpen(false);
      await loadRentals();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to create rental agreement.');
    } finally {
      setSubmitting(false);
    }
  };

  const totalPages = Math.ceil(rentals.length / itemsPerPage) || 1;
  const paginated = rentals.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Repeat className="w-6 h-6 text-purple-400" />
            Equipment Rentals & Leases
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
            Lessor retains strict ownership at all times. Completing rental payments never conveys title.
          </p>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3">
          <button
            onClick={loadRentals}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleOpenCreateModal}
            className="px-3.5 sm:px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-lg shadow-purple-600/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            Create Rental Agreement
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

      {/* Title Retention Notice Banner */}
      <div className="p-4 rounded-2xl bg-purple-950/40 border border-purple-500/30 flex items-start gap-3">
        <Shield className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
        <div className="text-xs text-purple-200 leading-relaxed">
          <strong className="text-white font-semibold">Strict Title Retention Clause:</strong> All rental contracts retain full ownership with the business. Upon contract end or cancellation, devices are flagged for physical return and security deposit reconciliation.
        </div>
      </div>

      {/* Rentals List */}
      {loading ? (
        <div className="glass-panel p-12 text-center rounded-2xl border border-slate-800 text-slate-400">
          <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Loading rental agreements from PostgreSQL...
        </div>
      ) : rentals.length === 0 ? (
        <div className="glass-panel p-12 text-center rounded-2xl border border-slate-800 text-slate-400">
          <Repeat className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <div className="text-base font-semibold text-white">No rental agreements found</div>
          <p className="text-xs text-slate-400 mt-1">
            Click &quot;Create Rental Agreement&quot; to issue a laptop lease with security deposit protection.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {paginated.map(rental => {
            const customerName = rental.customer ? `${rental.customer.firstName} ${rental.customer.lastName}` : 'Customer';
            const deviceName = rental.device ? `${rental.device.manufacturer} ${rental.device.model} (${rental.device.serialNumber})` : 'Hardware Device';
            const rate = Number(rental.rentalPriceTZS ?? rental.rentalRatePerPeriodTZS ?? 0);
            const deposit = Number(rental.securityDepositTZS ?? 0);
            const duration = rental.durationPeriods || (rental._count?.rentalCharges ?? 1);

            return (
              <div
                key={rental.id}
                className="metis-card p-5 sm:p-6 rounded-xl border border-slate-800/80 flex flex-col lg:flex-row lg:items-center justify-between gap-5 hover:border-purple-500/30 transition-colors"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <span className="font-mono font-bold text-white text-base">
                      {rental.agreementNumber}
                    </span>
                    {rental.status === 'ACTIVE' ? (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Active Lease
                      </span>
                    ) : rental.status === 'RETURN_PENDING' ? (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        Return Pending
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        {rental.status}
                      </span>
                    )}
                  </div>

                  <div className="text-sm font-semibold text-slate-200">
                    {customerName} &bull; <span className="text-purple-400">{deviceName}</span>
                  </div>

                  <div className="text-xs text-slate-400 flex flex-wrap gap-4">
                    <span>
                      Rate:{' '}
                      <strong className="text-white font-mono">
                        TZS {rate.toLocaleString()} / {rental.paymentFrequency}
                      </strong>
                    </span>
                    <span>
                      Duration: <strong className="text-white">{duration} periods</strong>
                    </span>
                    <span>
                      Deposit:{' '}
                      <strong className="text-emerald-400 font-mono">
                        TZS {deposit.toLocaleString()}
                      </strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-800">
                  <button
                    onClick={() => handleOpenDetail(rental.id)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Details
                  </button>
                  <div className="px-3.5 py-2 rounded-xl bg-purple-950/40 border border-purple-800/60 text-xs text-purple-300 font-medium whitespace-nowrap">
                    Title Retained
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {!loading && rentals.length > 0 && (
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

      {/* View Rental Detail Modal */}
      {detailRentalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#121927] border border-slate-800 rounded-xl w-full max-w-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            {loadingDetail || !rentalDetail ? (
              <div className="p-12 text-center text-slate-400">
                <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                Loading lease agreement and charges...
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <Repeat className="w-5 h-5 text-purple-400" />
                    <div>
                      <h2 className="text-base font-bold text-white font-mono">
                        {rentalDetail.agreementNumber}
                      </h2>
                      <span className="text-[11px] text-slate-400">
                        Status: <strong className="text-purple-400">{rentalDetail.status}</strong>
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setDetailRentalId(null);
                      setRentalDetail(null);
                    }}
                    className="text-slate-400 hover:text-white p-1 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4 my-5 text-xs">
                  {/* Financial Terms Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 font-mono">
                    <div>
                      <span className="text-slate-400 block text-[10px]">PERIOD RATE</span>
                      <span className="font-bold text-white text-sm">
                        TZS {Number(rentalDetail.rentalPriceTZS || rentalDetail.rentalRatePerPeriodTZS || 0).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">SECURITY DEPOSIT</span>
                      <span className="font-bold text-emerald-400 text-sm">
                        TZS {Number(rentalDetail.securityDepositTZS || 0).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">FREQUENCY</span>
                      <span className="font-bold text-purple-400 text-sm">
                        {rentalDetail.paymentFrequency}
                      </span>
                    </div>
                  </div>

                  {/* Customer and Hardware */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block mb-1">Lessee Customer</span>
                      <div className="font-bold text-white">
                        {rentalDetail.customer?.firstName} {rentalDetail.customer?.lastName}
                      </div>
                      <div className="text-slate-400 mt-0.5">Phone: {rentalDetail.customer?.phone}</div>
                    </div>

                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block mb-1">Rented Hardware</span>
                      <div className="font-bold text-white">
                        {rentalDetail.device?.manufacturer} {rentalDetail.device?.model}
                      </div>
                      <div className="font-mono text-cyan-400 mt-0.5">
                        S/N: {rentalDetail.device?.serialNumber}
                      </div>
                    </div>
                  </div>

                  {/* Rental Charges Schedule */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="font-bold text-white text-xs flex items-center justify-between">
                      <span>Rental Invoices / Charges ({rentalDetail.rentalCharges?.length || 0})</span>
                      <span className="text-[10px] text-purple-300 font-medium">
                        Title Remains 100% with Lessor
                      </span>
                    </div>

                    <div className="max-h-48 overflow-y-auto divide-y divide-slate-800/80">
                      {rentalDetail.rentalCharges?.map((charge: any) => (
                        <div key={charge.id} className="py-2 flex items-center justify-between text-[11px] font-mono">
                          <div>
                            <span className="font-semibold text-slate-300">Period #{charge.chargeNumber}</span>
                            <span className="text-slate-500 ml-2">
                              Due: {new Date(charge.dueDate).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-white">TZS {Number(charge.amountTZS).toLocaleString()}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              charge.isPaid
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-slate-800 text-slate-400'
                            }`}>
                              {charge.isPaid ? 'PAID' : 'PENDING'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex justify-end">
                  <button
                    onClick={() => {
                      setDetailRentalId(null);
                      setRentalDetail(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Rental Agreement Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#121927] border border-slate-800 rounded-xl w-full max-w-lg p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Repeat className="w-5 h-5 text-purple-400" />
                <h2 className="text-lg font-bold text-white">Create Equipment Rental Agreement</h2>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRental} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  Select Customer (Lessee) *
                </label>
                {customers.length === 0 ? (
                  <div className="text-xs text-rose-400 p-2 bg-rose-500/10 rounded-lg">
                    No customers found. Please add a customer first.
                  </div>
                ) : (
                  <select
                    value={formData.customerId}
                    onChange={e => setFormData({ ...formData, customerId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
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
                  Select Device to Rent *
                </label>
                {devices.length === 0 ? (
                  <div className="text-xs text-rose-400 p-2 bg-rose-500/10 rounded-lg">
                    No available devices found in inventory.
                  </div>
                ) : (
                  <select
                    value={formData.deviceId}
                    onChange={e => setFormData({ ...formData, deviceId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
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
                  <label className="block font-medium text-slate-300 mb-1">Rental Rate (TZS per period) *</label>
                  <input
                    type="number"
                    required
                    value={formData.rentalRatePerPeriodTZS}
                    onChange={e => setFormData({ ...formData, rentalRatePerPeriodTZS: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Security Deposit (TZS) *</label>
                  <input
                    type="number"
                    required
                    value={formData.securityDepositTZS}
                    onChange={e => setFormData({ ...formData, securityDepositTZS: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Payment Frequency</label>
                  <select
                    value={formData.paymentFrequency}
                    onChange={e => setFormData({ ...formData, paymentFrequency: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="DAILY">Daily Rent</option>
                    <option value="WEEKLY">Weekly Rent</option>
                    <option value="BIWEEKLY">Bi-Weekly Rent</option>
                    <option value="MONTHLY">Monthly Rent</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Duration (Number of Periods)</label>
                  <input
                    type="number"
                    min={1}
                    max={36}
                    value={formData.durationPeriods}
                    onChange={e => setFormData({ ...formData, durationPeriods: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Agreement Start Date</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                />
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
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold disabled:opacity-50"
                >
                  {submitting ? 'Generating Lease...' : 'Create Rental Contract'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
