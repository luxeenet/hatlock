'use client';

import React, { useState, useEffect } from 'react';
import {
  Laptop,
  Smartphone,
  Tablet,
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
  AlertCircle,
  QrCode,
  Download,
  Filter,
  CheckCheck,
  Eye,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Clock,
  Wifi,
  WifiOff,
  User,
  Copy,
  Check
} from 'lucide-react';
import { apiDevices, Device, apiMdm, AndroidProvisioningProfile, API_BASE } from '../../lib/api';

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('ALL');
  const [selectedManufacturer, setSelectedManufacturer] = useState('ALL');
  const [selectedPlatform, setSelectedPlatform] = useState('ALL');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Register Device Modal
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [submittingDevice, setSubmittingDevice] = useState(false);
  const [deviceForm, setDeviceForm] = useState({
    serialNumber: '',
    manufacturer: 'HP',
    model: '',
    deviceType: 'LAPTOP',
    operatingSystem: 'WINDOWS',
    purchasePrice: 1200000,
    condition: 'EXCELLENT',
    notes: ''
  });

  // Edit Device Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [editForm, setEditForm] = useState({
    model: '',
    condition: 'EXCELLENT',
    purchasePrice: 0,
    notes: ''
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // View Device Details Drawer
  const [detailDevice, setDetailDevice] = useState<Device | null>(null);

  // Command Modal
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [commandModalOpen, setCommandModalOpen] = useState(false);
  const [commandType, setCommandType] = useState<'RESTRICT' | 'RESTORE'>('RESTRICT');
  const [commandReason, setCommandReason] = useState('Scheduled payment defaulted beyond grace period');
  const [executingCommand, setExecutingCommand] = useState(false);

  // Delete / Retire Modal
  const [retiringDevice, setRetiringDevice] = useState<Device | null>(null);
  const [submittingRetire, setSubmittingRetire] = useState(false);

  // Provisioning Modal (Android Enterprise QR / Apple MDM profile)
  const [provisioningDevice, setProvisioningDevice] = useState<Device | null>(null);
  const [provisioningProfile, setProvisioningProfile] = useState<AndroidProvisioningProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);

  // Fetch Android Enterprise QR code & provisioning profile on modal open
  useEffect(() => {
    if (!provisioningDevice || provisioningDevice.currentOS !== 'ANDROID') {
      setProvisioningProfile(null);
      return;
    }

    let isMounted = true;
    setLoadingProfile(true);
    apiMdm.getAndroidProvisioningProfile(provisioningDevice.id)
      .then(profile => {
        if (isMounted) setProvisioningProfile(profile);
      })
      .catch(err => {
        console.warn('Failed to load Android provisioning profile:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingProfile(false);
      });

    return () => {
      isMounted = false;
    };
  }, [provisioningDevice]);

  const loadDevices = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiDevices.list({
        status: selectedFilter !== 'ALL' ? selectedFilter : undefined,
        manufacturer: selectedManufacturer !== 'ALL' ? selectedManufacturer : undefined,
        platform: selectedPlatform !== 'ALL' ? selectedPlatform : undefined,
        search: searchTerm || undefined
      });
      setDevices(data.devices || []);
      setCurrentPage(1);
    } catch (err: any) {
      console.error('Failed to load devices:', err);
      setError(err.message || 'Failed to load device inventory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, [selectedFilter, selectedManufacturer, selectedPlatform]);

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

      setActionSuccess(`Device ${res.device.model} (${res.device.serialNumber}) registered in inventory.`);
      setIsRegisterModalOpen(false);
      setDeviceForm({
        serialNumber: '',
        manufacturer: 'HP',
        model: '',
        deviceType: 'LAPTOP',
        operatingSystem: 'WINDOWS',
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

  const handleOpenEdit = (device: Device) => {
    setEditingDevice(device);
    setEditForm({
      model: device.model || '',
      condition: device.condition || 'EXCELLENT',
      purchasePrice: device.purchasePrice || 0,
      notes: device.notes || ''
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDevice) return;
    setSavingEdit(true);
    setError(null);

    try {
      await apiDevices.update(editingDevice.id, {
        model: editForm.model,
        condition: editForm.condition,
        purchasePrice: Number(editForm.purchasePrice) || undefined,
        notes: editForm.notes
      });

      setActionSuccess(`Hardware profile for ${editingDevice.serialNumber} updated.`);
      setIsEditModalOpen(false);
      setEditingDevice(null);
      await loadDevices();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to update device.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleRetireDevice = async () => {
    if (!retiringDevice) return;
    setSubmittingRetire(true);
    setError(null);

    try {
      await apiDevices.delete(retiringDevice.id);
      setActionSuccess(`Device ${retiringDevice.serialNumber} retired successfully.`);
      setRetiringDevice(null);
      await loadDevices();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to retire device.');
    } finally {
      setSubmittingRetire(false);
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

  // Search filtering including IMEI
  const filteredDevices = devices.filter(d => {
    const term = searchTerm.toLowerCase();
    const customer = d.financingAgreements?.[0]?.customer || d.rentalAgreements?.[0]?.customer;
    const custName = customer ? `${customer.firstName} ${customer.lastName}`.toLowerCase() : '';
    const imei1 = d.identity?.imei1?.toLowerCase() || '';
    const imei2 = d.identity?.imei2?.toLowerCase() || '';

    return (
      d.serialNumber.toLowerCase().includes(term) ||
      d.model.toLowerCase().includes(term) ||
      d.manufacturer.toLowerCase().includes(term) ||
      imei1.includes(term) ||
      imei2.includes(term) ||
      custName.includes(term)
    );
  });

  // Pagination calculation
  const totalPages = Math.ceil(filteredDevices.length / itemsPerPage) || 1;
  const paginatedDevices = filteredDevices.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Laptop className="w-6 h-6 text-cyan-400" />
            Universal Fleet & Device Security Hub
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
            Cross-brand management for Windows, Linux, Android Enterprise, and Apple MDM with cryptographic locks.
          </p>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3">
          <button
            onClick={loadDevices}
            title="Scan & Refresh Devices"
            className="px-3.5 sm:px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs sm:text-sm font-medium border border-slate-700/80 flex items-center gap-2 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Scan Devices
          </button>
          <button
            onClick={() => setIsRegisterModalOpen(true)}
            className="px-3.5 sm:px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-sm active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            Register Device
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="metis-card p-4 rounded-xl border border-slate-800/80 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search serial, IMEI, model, brand, or borrower..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-900/90 border border-slate-700/80 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto text-xs pb-1 sm:pb-0">
            {['ALL', 'AVAILABLE', 'ACTIVE', 'RESTRICTED', 'GRACE_PERIOD', 'CUSTOMER_OWNED'].map(f => (
              <button
                key={f}
                onClick={() => setSelectedFilter(f)}
                className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  selectedFilter === f
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                {f.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Secondary Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800/60 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span>Brand:</span>
            <select
              value={selectedManufacturer}
              onChange={e => setSelectedManufacturer(e.target.value)}
              className="bg-slate-900 border border-slate-750 rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">All Manufacturers</option>
              <option value="HP">HP</option>
              <option value="Dell">Dell</option>
              <option value="Lenovo">Lenovo</option>
              <option value="Samsung">Samsung</option>
              <option value="Tecno">Tecno</option>
              <option value="Infinix">Infinix</option>
              <option value="Apple">Apple</option>
              <option value="Xiaomi">Xiaomi</option>
              <option value="OPPO">OPPO</option>
              <option value="Asus">Asus</option>
              <option value="Acer">Acer</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span>Platform:</span>
            <select
              value={selectedPlatform}
              onChange={e => setSelectedPlatform(e.target.value)}
              className="bg-slate-900 border border-slate-750 rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">All Platforms</option>
              <option value="Windows">Windows Service</option>
              <option value="Linux">Linux systemd</option>
              <option value="Android">Android Enterprise</option>
              <option value="Apple">Apple MDM</option>
            </select>
          </div>

          <div className="ml-auto text-slate-400">
            Showing <span className="font-semibold text-white">{filteredDevices.length}</span> devices
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="metis-card rounded-xl border border-slate-800/90 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading device inventory from PostgreSQL...
          </div>
        ) : filteredDevices.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Laptop className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <div className="text-base font-semibold text-white">No devices found matching filters</div>
            <p className="text-xs text-slate-400 mt-1">
              Click &quot;Register Device&quot; to onboard your first laptop, smartphone or tablet.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900/60 border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th className="p-4 pl-6">Hardware Profile</th>
                  <th className="p-4">OS & Security</th>
                  <th className="p-4">Protection Status</th>
                  <th className="p-4">Borrower / Contract</th>
                  <th className="p-4 text-right pr-6">Management Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {paginatedDevices.map(device => {
                  const activeHP = device.financingAgreements?.[0];
                  const activeRental = device.rentalAgreements?.[0];
                  const activeCustomer = activeHP?.customer || activeRental?.customer;

                  return (
                    <tr key={device.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-300 shrink-0">
                            {device.currentOS === 'ANDROID' || device.currentOS === 'IOS' ? (
                              <Smartphone className="w-5 h-5 text-indigo-400" />
                            ) : (
                              <Laptop className="w-5 h-5 text-cyan-400" />
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-white flex items-center gap-1.5">
                              <span>{device.manufacturer} {device.model}</span>
                              {device.platform && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-normal">
                                  {device.platform.split(' ')[0]}
                                </span>
                              )}
                            </div>
                            <div className="text-xs font-mono text-cyan-400 flex items-center gap-1.5 mt-0.5">
                              <span>S/N: {device.serialNumber}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-slate-800 border border-slate-700 text-slate-300">
                              {device.currentOS || 'WINDOWS'}
                            </span>
                            {device.confidenceScore !== undefined && (
                              <span
                                className={`text-[11px] font-semibold flex items-center gap-1 ${
                                  device.confidenceScore >= 0.8 ? 'text-emerald-400' : 'text-amber-400'
                                }`}
                                title={`Hardware confidence: ${Math.round((device.confidenceScore || 1) * 100)}%`}
                              >
                                <Cpu className="w-3.5 h-3.5" />
                                {Math.round((device.confidenceScore || 1) * 100)}% Trust
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {device.currentOS === 'ANDROID' ? 'Device Owner Kiosk Ready' :
                             device.currentOS === 'IOS' ? 'Supervised Apple MDM' :
                             device.identity?.tpmPresent !== false ? 'TPM 2.0 & BitLocker' : 'Standard Agent'}
                          </div>
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
                            <CheckCheck className="w-3.5 h-3.5" />
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
                            {activeHP?.remainingBalanceTZS !== undefined && (
                              <div className="text-[11px] text-emerald-400 font-mono font-medium">
                                Bal: TZS {activeHP.remainingBalanceTZS.toLocaleString()}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">Unassigned</span>
                        )}
                      </td>

                      <td className="p-4 pr-6 text-right">
                        <div className="flex items-center justify-end gap-1.5 sm:gap-2">
                          {/* View details */}
                          <button
                            onClick={() => setDetailDevice(device)}
                            title="View Full Hardware Profile"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Edit device */}
                          <button
                            onClick={() => handleOpenEdit(device)}
                            title="Edit Device Information"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Provisioning Shortcut for Mobile Devices */}
                          {(device.currentOS === 'ANDROID' || device.currentOS === 'IOS') && (
                            <button
                              onClick={() => setProvisioningDevice(device)}
                              title="Provisioning Profile / QR"
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-400 border border-slate-700 transition-colors"
                            >
                              <QrCode className="w-4 h-4" />
                            </button>
                          )}

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

                          {/* Retire / Delete */}
                          <button
                            onClick={() => setRetiringDevice(device)}
                            title="Retire Device"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Toolbar */}
        {!loading && filteredDevices.length > 0 && (
          <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 bg-navy-950/40">
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
      </div>

      {/* Device Details Modal */}
      {detailDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#121927] border border-slate-800 rounded-xl w-full max-w-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                  <Laptop className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {detailDevice.manufacturer} {detailDevice.model}
                  </h2>
                  <p className="text-xs font-mono text-cyan-400">S/N: {detailDevice.serialNumber}</p>
                </div>
              </div>
              <button
                onClick={() => setDetailDevice(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mt-5 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800">
                  <span className="text-slate-400 font-medium">Status</span>
                  <div className="font-bold text-white mt-0.5">{detailDevice.status}</div>
                </div>
                <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800">
                  <span className="text-slate-400 font-medium">Platform</span>
                  <div className="font-bold text-white mt-0.5">{detailDevice.currentOS || 'WINDOWS'}</div>
                </div>
                <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800">
                  <span className="text-slate-400 font-medium">Acquisition Cost</span>
                  <div className="font-bold text-emerald-400 font-mono mt-0.5">
                    TZS {detailDevice.purchasePrice?.toLocaleString() || 'N/A'}
                  </div>
                </div>
              </div>

              {/* Cryptographic & Security Info */}
              <div className="p-4 bg-slate-900/90 rounded-lg border border-slate-800 space-y-2">
                <div className="font-bold text-white text-xs flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Hardware Security Attestation
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-300">
                  <div>TPM 2.0 State: <strong className="text-emerald-400">{detailDevice.identity?.tpmPresent !== false ? 'Present & Bound' : 'None'}</strong></div>
                  <div>Secure Boot: <strong className="text-cyan-400">{detailDevice.identity?.secureBoot ? 'Enabled' : 'Standard'}</strong></div>
                  {detailDevice.identity?.imei1 && (
                    <div>Primary IMEI: <strong className="text-indigo-400 font-mono">{detailDevice.identity.imei1}</strong></div>
                  )}
                  {detailDevice.identity?.playIntegrityVerdict && (
                    <div>Play Integrity: <strong className="text-emerald-400">{detailDevice.identity.playIntegrityVerdict}</strong></div>
                  )}
                  {detailDevice.complianceStatus && (
                    <div>Compliance: <strong className="text-white">{detailDevice.complianceStatus}</strong></div>
                  )}
                </div>
              </div>

              {/* Borrower & Agreement */}
              <div className="p-4 bg-slate-900/90 rounded-lg border border-slate-800 space-y-2">
                <div className="font-bold text-white text-xs flex items-center gap-2">
                  <User className="w-4 h-4 text-amber-400" />
                  Active Borrower & Agreement Assignment
                </div>
                {detailDevice.financingAgreements?.[0] ? (
                  <div className="text-slate-300 space-y-1">
                    <div>Customer: <strong>{detailDevice.financingAgreements[0].customer.firstName} {detailDevice.financingAgreements[0].customer.lastName}</strong></div>
                    <div>Hire Purchase Contract: <span className="font-mono text-indigo-400">{detailDevice.financingAgreements[0].agreementNumber}</span></div>
                    {detailDevice.financingAgreements[0].remainingBalanceTZS !== undefined && (
                      <div>Remaining Balance: <span className="font-mono text-emerald-400">TZS {detailDevice.financingAgreements[0].remainingBalanceTZS.toLocaleString()}</span></div>
                    )}
                  </div>
                ) : detailDevice.rentalAgreements?.[0] ? (
                  <div className="text-slate-300 space-y-1">
                    <div>Customer: <strong>{detailDevice.rentalAgreements[0].customer.firstName} {detailDevice.rentalAgreements[0].customer.lastName}</strong></div>
                    <div>Rental Agreement: <span className="font-mono text-purple-400">{detailDevice.rentalAgreements[0].agreementNumber}</span></div>
                  </div>
                ) : (
                  <div className="text-slate-500 italic">No customer agreement assigned. Ready in warehouse inventory.</div>
                )}
              </div>

              {detailDevice.notes && (
                <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 text-slate-300">
                  <span className="text-slate-400 block mb-1 font-medium">Administrative Notes:</span>
                  {detailDevice.notes}
                </div>
              )}
            </div>

            <div className="pt-4 mt-4 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setDetailDevice(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Device Modal */}
      {isEditModalOpen && editingDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#121927] border border-slate-800 rounded-xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Edit Hardware Profile</h3>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-white p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Model Name</label>
                <input
                  type="text"
                  required
                  value={editForm.model}
                  onChange={e => setEditForm({ ...editForm, model: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Physical Condition</label>
                <select
                  value={editForm.condition}
                  onChange={e => setEditForm({ ...editForm, condition: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="EXCELLENT">Brand New / Factory Sealed</option>
                  <option value="GOOD">Refurbished - Grade A</option>
                  <option value="FAIR">Used - Functional</option>
                  <option value="POOR">Needs Maintenance</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Acquisition Cost (TZS)</label>
                <input
                  type="number"
                  value={editForm.purchasePrice}
                  onChange={e => setEditForm({ ...editForm, purchasePrice: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Notes</label>
                <textarea
                  rows={3}
                  value={editForm.notes}
                  onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-navy-950 font-bold disabled:opacity-50"
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Retire Device Confirmation Modal */}
      {retiringDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-navy-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center gap-3 text-rose-400 mb-3">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-bold text-white">Retire Hardware from Fleet</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to retire <strong>{retiringDevice.manufacturer} {retiringDevice.model}</strong> (S/N: {retiringDevice.serialNumber})?
              This will decommission the device from active inventory tracking.
            </p>

            <div className="pt-4 mt-4 border-t border-slate-800 flex justify-end gap-3 text-xs">
              <button
                type="button"
                onClick={() => setRetiringDevice(null)}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleRetireDevice}
                disabled={submittingRetire}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold disabled:opacity-50"
              >
                {submittingRetire ? 'Retiring...' : 'Confirm Retire'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Register Device Modal */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-navy-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Laptop className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-bold text-white">Register Universal Fleet Hardware</h2>
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
                  Serial Number or Primary IMEI *
                </label>
                <input
                  type="text"
                  required
                  value={deviceForm.serialNumber}
                  onChange={e => setDeviceForm({ ...deviceForm, serialNumber: e.target.value })}
                  placeholder="e.g. 5CD2348ABC or 356892110293845"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Device Category *</label>
                  <select
                    value={deviceForm.deviceType}
                    onChange={e => {
                      const t = e.target.value;
                      setDeviceForm({
                        ...deviceForm,
                        deviceType: t,
                        operatingSystem: t === 'SMARTPHONE' || t === 'TABLET' ? 'ANDROID' : 'WINDOWS'
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="LAPTOP">Laptop Computer</option>
                    <option value="DESKTOP">Desktop Computer</option>
                    <option value="SMARTPHONE">Android / iPhone Smartphone</option>
                    <option value="TABLET">Tablet Device</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Operating System *</label>
                  <select
                    value={deviceForm.operatingSystem}
                    onChange={e => setDeviceForm({ ...deviceForm, operatingSystem: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="WINDOWS">Windows (10 / 11)</option>
                    <option value="LINUX">Linux (Ubuntu / Fedora / Debian)</option>
                    <option value="ANDROID">Android Enterprise</option>
                    <option value="IOS">Apple iOS / iPadOS</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Manufacturer *</label>
                  <select
                    value={deviceForm.manufacturer}
                    onChange={e => setDeviceForm({ ...deviceForm, manufacturer: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <optgroup label="Computers">
                      <option value="HP">HP</option>
                      <option value="Dell">Dell</option>
                      <option value="Lenovo">Lenovo</option>
                      <option value="Asus">Asus</option>
                      <option value="Acer">Acer</option>
                    </optgroup>
                    <optgroup label="Smartphones & Mobile">
                      <option value="Samsung">Samsung</option>
                      <option value="Tecno">Tecno</option>
                      <option value="Infinix">Infinix</option>
                      <option value="Apple">Apple</option>
                      <option value="Xiaomi">Xiaomi</option>
                      <option value="OPPO">OPPO</option>
                      <option value="Google">Google Pixel</option>
                      <option value="OnePlus">OnePlus</option>
                      <option value="Motorola">Motorola</option>
                    </optgroup>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Model Name *</label>
                  <input
                    type="text"
                    required
                    value={deviceForm.model}
                    onChange={e => setDeviceForm({ ...deviceForm, model: e.target.value })}
                    placeholder="e.g. Camon 30 Pro or EliteBook 840"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Acquisition Cost (TZS)</label>
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
                    <option value="EXCELLENT">Brand New / Factory Sealed</option>
                    <option value="GOOD">Refurbished - Grade A</option>
                    <option value="FAIR">Used - Functional</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Internal Notes</label>
                <input
                  type="text"
                  value={deviceForm.notes}
                  onChange={e => setDeviceForm({ ...deviceForm, notes: e.target.value })}
                  placeholder="Asset tag, branch allocation, financing tier"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
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
                  {submittingDevice ? 'Saving...' : 'Register Device'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remote Command Modal */}
      {commandModalOpen && selectedDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-navy-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Dispatch Cryptographic Command</h3>
              </div>
              <button
                onClick={() => setCommandModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mt-4">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                <div className="text-slate-400">Target Hardware:</div>
                <div className="font-semibold text-white mt-0.5">
                  {selectedDevice.manufacturer} {selectedDevice.model}
                </div>
                <div className="font-mono text-cyan-400 text-[11px] mt-0.5">
                  S/N: {selectedDevice.serialNumber}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Action Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCommandType('RESTRICT')}
                    className={`py-2 rounded-xl text-xs font-semibold border transition-colors flex items-center justify-center gap-1.5 ${
                      commandType === 'RESTRICT'
                        ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                        : 'border-slate-800 text-slate-400'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    Lock Device
                  </button>
                  <button
                    type="button"
                    onClick={() => setCommandType('RESTORE')}
                    className={`py-2 rounded-xl text-xs font-semibold border transition-colors flex items-center justify-center gap-1.5 ${
                      commandType === 'RESTORE'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'border-slate-800 text-slate-400'
                    }`}
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    Restore Access
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Reason for Command</label>
                <input
                  type="text"
                  value={commandReason}
                  onChange={e => setCommandReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
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
                  onClick={handleExecuteCommand}
                  disabled={executingCommand}
                  className={`px-5 py-2 rounded-xl text-navy-950 text-sm font-bold disabled:opacity-50 flex items-center gap-2 ${
                    commandType === 'RESTRICT'
                      ? 'bg-rose-500 hover:bg-rose-400'
                      : 'bg-emerald-500 hover:bg-emerald-400'
                  }`}
                >
                  {executingCommand ? 'Signing ECDSA P-256...' : `Sign & Send ${commandType}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Provisioning Modal (Android Enterprise QR Code / Apple MDM profile) */}
      {provisioningDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in overflow-hidden">
          <div className="bg-navy-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative">
            {/* Modal Header - Pinned at top */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 shrink-0 bg-navy-950/50">
              <div className="flex items-center gap-2 min-w-0">
                <QrCode className="w-5 h-5 text-indigo-400 shrink-0" />
                <h3 className="text-sm sm:text-base font-bold text-white truncate">
                  {provisioningDevice.currentOS === 'ANDROID' ? 'Android Enterprise Provisioning' : 'Apple MDM Enrollment'}
                </h3>
              </div>
              <button
                onClick={() => setProvisioningDevice(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/60 transition-colors shrink-0 ml-2"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body - Scrollable so it never overflows offscreen */}
            <div className="overflow-y-auto px-5 py-4 space-y-3.5 text-xs flex-1 min-h-0">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80">
                <div className="text-[11px] text-slate-400">Target Device:</div>
                <div className="font-semibold text-white mt-0.5 truncate">
                  {provisioningDevice.manufacturer} {provisioningDevice.model}{' '}
                  <span className="text-slate-400 font-mono text-[11px] font-normal">
                    (S/N: {provisioningDevice.serialNumber})
                  </span>
                </div>
              </div>

              {provisioningDevice.currentOS === 'ANDROID' ? (
                <div className="space-y-3.5">
                  <div className="text-slate-300 leading-relaxed text-[11.5px]">
                    To provision this Android smartphone as a <strong className="text-white">Fully Managed Device Owner</strong>:
                  </div>

                  {/* Scannable Android Enterprise QR Code Container */}
                  <div className="flex flex-col items-center justify-center p-3.5 bg-slate-950 rounded-2xl border border-slate-800">
                    <div className="p-2.5 bg-white rounded-xl shadow-md border border-slate-200 flex items-center justify-center">
                      {loadingProfile ? (
                        <div className="flex flex-col items-center justify-center p-6 text-slate-800">
                          <RefreshCw className="w-7 h-7 animate-spin text-emerald-600 mb-2" />
                          <span className="text-xs font-semibold text-slate-600">Generating QR...</span>
                        </div>
                      ) : (
                        <img
                          src={provisioningProfile?.qrDataUrl || `${API_BASE}/api/v1/mdm/android/provisioning-qr/${provisioningDevice.id}`}
                          alt={`HatLock Device Owner QR Code for ${provisioningDevice.manufacturer} ${provisioningDevice.model}`}
                          className="w-36 h-36 sm:w-44 sm:h-44 object-contain"
                        />
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 font-medium mt-2 flex items-center gap-1.5 text-center">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Point phone camera at this QR code during setup</span>
                    </div>
                  </div>

                  {/* Step-by-step instructions */}
                  <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800/80 space-y-1.5 text-slate-300">
                    <div className="font-semibold text-slate-200 text-xs">Setup Instructions:</div>
                    <ol className="list-decimal pl-4 space-y-1 text-slate-400 text-[11px] leading-relaxed">
                      <li>Factory reset or unbox the Samsung device.</li>
                      <li>On the initial <strong>&quot;Welcome&quot;</strong> screen, tap any blank area <strong>6 times</strong> to open QR setup.</li>
                      <li>Connect to Wi-Fi, then scan the QR code above.</li>
                      <li>The HatLock Enterprise Device Owner agent will auto-install and bind.</li>
                    </ol>
                  </div>

                  <div className="p-2 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[10px] text-slate-500 truncate">
                    Endpoint: /api/v1/mdm/android/provisioning-profile/{provisioningDevice.id}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-slate-300">
                    Apple iPhone / iPad supervised device configuration profile:
                  </p>
                  <a
                    href={`/api/v1/mdm/apple/enroll.mobileconfig?deviceId=${provisioningDevice.id}`}
                    download
                    className="w-full py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-semibold flex items-center justify-center gap-2 text-xs transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download hatlock-enroll.mobileconfig
                  </a>
                </div>
              )}
            </div>

            {/* Modal Bottom Action Buttons - Pinned at bottom, always visible */}
            <div className="px-5 py-3 border-t border-slate-800 bg-navy-950/90 shrink-0 flex items-center justify-between gap-2">
              {provisioningDevice.currentOS === 'ANDROID' ? (
                <>
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap flex-1 min-w-0">
                    <a
                      href={`${API_BASE}/api/v1/mdm/android/provisioning-qr/${provisioningDevice.id}`}
                      download={`hatlock-provisioning-${provisioningDevice.serialNumber}.png`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium flex items-center justify-center gap-1.5 text-xs transition-colors border border-slate-700 shrink-0"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Download QR</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => {
                        const payload = provisioningProfile?.qrJson || {
                          deviceId: provisioningDevice.id,
                          serialNumber: provisioningDevice.serialNumber
                        };
                        navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
                        setCopiedPayload(true);
                        setTimeout(() => setCopiedPayload(false), 3000);
                      }}
                      className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium flex items-center justify-center gap-1.5 text-xs transition-colors border border-slate-700 shrink-0"
                    >
                      {copiedPayload ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Copy Setup JSON</span>
                        </>
                      )}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setProvisioningDevice(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold shrink-0"
                  >
                    Close
                  </button>
                </>
              ) : (
                <div className="flex justify-end w-full">
                  <button
                    type="button"
                    onClick={() => setProvisioningDevice(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
