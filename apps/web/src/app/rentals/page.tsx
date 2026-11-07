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
  Users
} from 'lucide-react';
import { apiRentals, apiCustomers, apiDevices, RentalAgreement, Customer, Device } from '../../lib/api';

export default function RentalsPage() {
  const [rentals, setRentals] = useState<RentalAgreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [submitting, setSubmitting] = useState(false);

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

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Repeat className="w-6 h-6 text-purple-400" />
            Equipment Rentals & Leases
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Lessor retains strict ownership at all times. Completing rental payments never conveys title.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadRentals}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold flex items-center gap-2 shadow-lg shadow-purple-600/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            Create Rental Agreement
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

      {/* Critical Legal Ownership Retention Notice Banner */}
      <div className="p-4 rounded-2xl bg-purple-950/40 border border-purple-500/30 flex items-start gap-3">
        <Shield className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
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
          {rentals.map(rental => {
            const customerName = rental.customer ? `${rental.customer.firstName} ${rental.customer.lastName}` : 'Customer';
            const deviceName = rental.device ? `${rental.device.manufacturer} ${rental.device.model} (${rental.device.serialNumber})` : 'Hardware Device';

            return (
              <div
                key={rental.id}
                className="glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-6 hover:border-purple-500/30 transition-colors"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-3">
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

                  {(() => {
                    const rate = Number(rental.rentalPriceTZS ?? rental.rentalRatePerPeriodTZS ?? 0);
                    const deposit = Number(rental.securityDepositTZS ?? 0);
                    const duration = rental.durationPeriods || (rental._count?.rentalCharges ?? 1);

                    return (
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
                    );
                  })()}
                </div>

                <div className="px-3.5 py-2 rounded-xl bg-purple-950/40 border border-purple-800/60 text-xs text-purple-300 font-medium">
                  Title: 100% Business Retained
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Rental Agreement Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-navy-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
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

            <form onSubmit={handleCreateRental} className="space-y-4 mt-4">
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
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
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
                  Select Laptop to Lease *
                </label>
                {devices.length === 0 ? (
                  <div className="text-xs text-rose-400 p-2 bg-rose-500/10 rounded-lg">
                    No available laptops in inventory. Register an available laptop first.
                  </div>
                ) : (
                  <select
                    value={formData.deviceId}
                    onChange={e => setFormData({ ...formData, deviceId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
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
                  <label className="block text-xs font-medium text-slate-300 mb-1">Rental Rate (TZS) *</label>
                  <input
                    type="number"
                    value={formData.rentalRatePerPeriodTZS}
                    onChange={e => setFormData({ ...formData, rentalRatePerPeriodTZS: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Security Deposit (TZS)</label>
                  <input
                    type="number"
                    value={formData.securityDepositTZS}
                    onChange={e => setFormData({ ...formData, securityDepositTZS: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Billing Frequency</label>
                  <select
                    value={formData.paymentFrequency}
                    onChange={e => setFormData({ ...formData, paymentFrequency: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="BIWEEKLY">Bi-Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Duration Periods</label>
                  <input
                    type="number"
                    min={1}
                    max={36}
                    value={formData.durationPeriods}
                    onChange={e => setFormData({ ...formData, durationPeriods: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
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
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold disabled:opacity-50"
                >
                  {submitting ? 'Creating Agreement...' : 'Issue Rental Agreement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
