'use client';

import React, { useState, useEffect } from 'react';
import {
  Laptop,
  ShieldCheck,
  Lock,
  Unlock,
  AlertTriangle,
  Search,
  Plus,
  RefreshCw,
  Cpu,
  Key,
  X,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { apiDevices, Device } from '../../lib/api';

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('ALL');

  // Register Device Modal
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [submittingDevice, setSubmittingDevice] = useState(false);
  const [deviceForm, setDeviceForm] = useState({
    serialNumber: '',
    manufacturer: 'HP',
    model: '',
    purchasePrice: 1200000,
    condition: 'EXCELLENT',
    notes: ''
  });

  // Command Modal
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [commandModalOpen, setCommandModalOpen] = useState(false);
  const [commandType, setCommandType] = useState<'RESTRICT' | 'RESTORE'>('RESTRICT');
  const [commandReason, setCommandReason] = useState('Scheduled payment defaulted beyond grace period');
  const [executingCommand, setExecutingCommand] = useState(false);

  const loadDevices = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiDevices.list({
        status: selectedFilter !== 'ALL' ? selectedFilter : undefined,
        search: searchTerm || undefined
      });
      setDevices(data.devices || []);
    } catch (err: any) {
      console.error('Failed to load devices:', err);
      setError(err.message || 'Failed to load device inventory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, [selectedFilter]);

  const handleRegisterDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingDevice(true);
    setError(null);

    try {
      if (!deviceForm.serialNumber || !deviceForm.manufacturer || !deviceForm.model) {
        throw new Error('Please fill in serial number, manufacturer and model.');
      }

      const res = await apiDevices.create({
        ...deviceForm,
        purchasePrice: Number(deviceForm.purchasePrice) || undefined
      });

      setActionSuccess(`Laptop ${res.device.model} (${res.device.serialNumber}) registered in inventory.`);
      setIsRegisterModalOpen(false);
      setDeviceForm({
        serialNumber: '',
        manufacturer: 'HP',
        model: '',
        purchasePrice: 1200000,
        condition: 'EXCELLENT',
        notes: ''
      });
      await loadDevices();
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to register device.');
    } finally {
      setSubmittingDevice(false);
    }
  };

  const handleExecuteCommand = async () => {
    if (!selectedDevice) return;
    setExecutingCommand(true);
    setError(null);

    try {
      const res = await apiDevices.sendCommand(selectedDevice.id, {
        action: commandType,
        reason: commandReason,
        lockScreenMessage:
          commandType === 'RESTRICT'
            ? 'HatLock Security Policy Enforced: Device restricted due to overdue payment. Please settle instalment to restore immediate access.'
            : 'Account in good standing. Lock released.'
      });

      setActionSuccess(
        `Signed ${commandType} command queued (ID: ${res.commandId.slice(0, 8)}). Next agent heartbeat will enforce policy.`
      );
      setCommandModalOpen(false);
      await loadDevices();
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setError(err.message || `Failed to dispatch ${commandType} command.`);
    } finally {
      setExecutingCommand(false);
    }
  };

  const filteredDevices = devices.filter(d => {
    const term = searchTerm.toLowerCase();
    const customer =
      d.financingAgreements?.[0]?.customer || d.rentalAgreements?.[0]?.customer;
    const custName = customer ? `${customer.firstName} ${customer.lastName}`.toLowerCase() : '';

    return (
      d.serialNumber.toLowerCase().includes(term) ||
      d.model.toLowerCase().includes(term) ||
      d.manufacturer.toLowerCase().includes(term) ||
      custName.includes(term)
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Laptop className="w-6 h-6 text-cyan-400" />
            Device Inventory & Remote Lock Control
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Monitor hardware identity, TPM attestation, and dispatch digitally signed commands.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadDevices}
            title="Scan & Refresh Devices"
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-700 flex items-center gap-2 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Scan Devices
          </button>
          <button
            onClick={() => setIsRegisterModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-navy-950 text-sm font-semibold flex items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            Register Device
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 flex-shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-4 rounded-xl border border-slate-800">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by serial number, model, or customer..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900/80 border border-slate-700/80 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto text-xs">
          {['ALL', 'AVAILABLE', 'ACTIVE', 'RESTRICTED', 'GRACE_PERIOD', 'CUSTOMER_OWNED'].map(f => (
            <button
              key={f}
              onClick={() => setSelectedFilter(f)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                selectedFilter === f
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {f.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Inventory Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading device inventory from PostgreSQL...
          </div>
        ) : filteredDevices.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Laptop className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <div className="text-base font-semibold text-white">No devices found</div>
            <p className="text-xs text-slate-400 mt-1">
              Click &quot;Register Device&quot; to onboard your first laptop with serial numbers.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900/60 border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th className="p-4 pl-6">Hardware Profile</th>
                  <th className="p-4">OS / TPM</th>
                  <th className="p-4">Protection Status</th>
                  <th className="p-4">Agreement Context</th>
                  <th className="p-4 text-right pr-6">Remote Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {filteredDevices.map(device => {
                  const activeHP = device.financingAgreements?.[0];
                  const activeRental = device.rentalAgreements?.[0];
                  const activeCustomer = activeHP?.customer || activeRental?.customer;

                  return (
                    <tr key={device.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-4 pl-6">
                        <div className="font-semibold text-white">
                          {device.manufacturer} {device.model}
                        </div>
                        <div className="text-xs font-mono text-cyan-400 flex items-center gap-1.5 mt-0.5">
                          <span>S/N: {device.serialNumber}</span>
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-slate-800 border border-slate-700">
                            {device.currentOS || 'WINDOWS'}
                          </span>
                          {device.identity?.tpmPresent !== false ? (
                            <span className="flex items-center gap-1 text-[11px] text-emerald-400" title="TPM 2.0 Attested">
                              <Cpu className="w-3.5 h-3.5" />
                              TPM 2.0
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-500">Standard</span>
                          )}
                        </div>
                      </td>

                      <td className="p-4">
                        {device.status === 'ACTIVE' && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 w-fit">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Active (Unlocked)
                          </span>
                        )}
                        {device.status === 'RESTRICTED' && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1 w-fit">
                            <Lock className="w-3.5 h-3.5" />
                            Restricted (Locked)
                          </span>
                        )}
                        {device.status === 'GRACE_PERIOD' && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1 w-fit">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Grace Period
                          </span>
                        )}
                        {device.status === 'AVAILABLE' && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-300 border border-slate-500/20 flex items-center gap-1 w-fit">
                            In Stock
                          </span>
                        )}
                        {device.status === 'CUSTOMER_OWNED' && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1 w-fit">
                            Customer Owned
                          </span>
                        )}
                      </td>

                      <td className="p-4 text-xs">
                        {activeCustomer ? (
                          <div>
                            <div className="font-medium text-white">
                              {activeCustomer.firstName} {activeCustomer.lastName}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                              {activeHP?.agreementNumber || activeRental?.agreementNumber}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">Unassigned</span>
                        )}
                      </td>

                      <td className="p-4 pr-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {device.status === 'RESTRICTED' ? (
                            <button
                              onClick={() => {
                                setSelectedDevice(device);
                                setCommandType('RESTORE');
                                setCommandModalOpen(true);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                            >
                              <Unlock className="w-3.5 h-3.5" />
                              Restore Access
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setSelectedDevice(device);
                                setCommandType('RESTRICT');
                                setCommandModalOpen(true);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              Lock Device
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Register Device Modal */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-navy-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Laptop className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-bold text-white">Register Hardware Fleet Device</h2>
              </div>
              <button
                onClick={() => setIsRegisterModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterDevice} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Serial Number (Hardware S/N) *
                </label>
                <input
                  type="text"
                  required
                  value={deviceForm.serialNumber}
                  onChange={e => setDeviceForm({ ...deviceForm, serialNumber: e.target.value })}
                  placeholder="e.g. 5CD2348ABC or LX-8894-HP15"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Manufacturer *</label>
                  <select
                    value={deviceForm.manufacturer}
                    onChange={e => setDeviceForm({ ...deviceForm, manufacturer: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="HP">HP</option>
                    <option value="Dell">Dell</option>
                    <option value="Lenovo">Lenovo</option>
                    <option value="Apple">Apple</option>
                    <option value="Asus">Asus</option>
                    <option value="Acer">Acer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Model Name *</label>
                  <input
                    type="text"
                    required
                    value={deviceForm.model}
                    onChange={e => setDeviceForm({ ...deviceForm, model: e.target.value })}
                    placeholder="e.g. EliteBook 840 G8"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Purchase Cost (TZS)</label>
                  <input
                    type="number"
                    value={deviceForm.purchasePrice}
                    onChange={e => setDeviceForm({ ...deviceForm, purchasePrice: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Physical Condition</label>
                  <select
                    value={deviceForm.condition}
                    onChange={e => setDeviceForm({ ...deviceForm, condition: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="EXCELLENT">Brand New / Excellent</option>
                    <option value="GOOD">Refurbished - Grade A</option>
                    <option value="FAIR">Used - Grade B</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Notes / Asset Tag</label>
                <textarea
                  rows={2}
                  value={deviceForm.notes}
                  onChange={e => setDeviceForm({ ...deviceForm, notes: e.target.value })}
                  placeholder="Asset tag number, supplier invoice number, or RAM/SSD configuration"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDevice}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-navy-950 text-sm font-bold disabled:opacity-50"
                >
                  {submittingDevice ? 'Saving to Database...' : 'Register Laptop'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remote Command Modal */}
      {commandModalOpen && selectedDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-navy-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  commandType === 'RESTRICT'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                }`}
              >
                {commandType === 'RESTRICT' ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {commandType === 'RESTRICT' ? 'Lock & Restrict Laptop' : 'Restore Laptop Access'}
                </h3>
                <p className="text-xs text-slate-400">
                  Target: {selectedDevice.manufacturer} {selectedDevice.model} ({selectedDevice.serialNumber})
                </p>
              </div>
            </div>

            <div className="space-y-4 my-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Reason for Command (Audit Log Record)
                </label>
                <textarea
                  rows={3}
                  value={commandReason}
                  onChange={e => setCommandReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300 space-y-1">
                <div className="font-semibold text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                  Hardware-Enforced Command
                </div>
                <div>
                  This action signs an ES256 payload verified by the local Windows/Linux HatLock agent on boot or heartbeat.
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setCommandModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={executingCommand}
                onClick={handleExecuteCommand}
                className={`px-5 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50 ${
                  commandType === 'RESTRICT'
                    ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/20'
                    : 'bg-emerald-500 hover:bg-emerald-600 text-navy-950 shadow-lg shadow-emerald-500/20'
                }`}
              >
                {executingCommand ? 'Dispatching...' : `Dispatch Signed ${commandType}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
