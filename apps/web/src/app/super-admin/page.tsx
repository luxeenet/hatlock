'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Building2,
  CheckCircle2,
  XCircle,
  Activity,
  Laptop,
  RefreshCw,
  AlertCircle,
  Sliders,
  X
} from 'lucide-react';
import { apiSuperAdmin, TenantBusiness } from '../../lib/api';

export default function SuperAdminPage() {
  const [tenants, setTenants] = useState<TenantBusiness[]>([]);
  const [platformOverview, setPlatformOverview] = useState<{
    totalBusinesses: number;
    activeBusinesses: number;
    totalDevicesGlobal: number;
    totalAgreementsGlobal: number;
    globalGrossVolumeTZS: number;
  }>({
    totalBusinesses: 0,
    activeBusinesses: 0,
    totalDevicesGlobal: 0,
    totalAgreementsGlobal: 0,
    globalGrossVolumeTZS: 0
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Quota Modal
  const [quotaModalTenant, setQuotaModalTenant] = useState<TenantBusiness | null>(null);
  const [deviceQuota, setDeviceQuota] = useState(250);
  const [updatingQuota, setUpdatingQuota] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewRes, tenantsRes] = await Promise.all([
        apiSuperAdmin.overview(),
        apiSuperAdmin.listBusinesses()
      ]);
      if (overviewRes?.platform) setPlatformOverview(overviewRes.platform);
      setTenants(tenantsRes.businesses || []);
    } catch (err: any) {
      console.error('Failed to load Super-Admin console:', err);
      setError(err.message || 'Super-Admin privileges required (Login as admin@hatlock.local).');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await apiSuperAdmin.updateStatus(id, nextStatus as any);
      setStatusMessage(`Tenant status updated to ${nextStatus} in PostgreSQL.`);
      await loadData();
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to update tenant status.');
    }
  };

  const handleUpdateQuota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quotaModalTenant) return;
    setUpdatingQuota(true);
    try {
      await apiSuperAdmin.updateQuota(quotaModalTenant.id, Number(deviceQuota));
      setStatusMessage(`Device fleet limit for ${quotaModalTenant.name} increased to ${deviceQuota} devices.`);
      setQuotaModalTenant(null);
      await loadData();
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to update quota.');
    } finally {
      setUpdatingQuota(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-yellow-400" />
            Luxeenet Super-Admin Platform Console
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Cross-tenant governance, business onboarding approval, and global fleet quotas.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-xs font-semibold">
            <Activity className="w-3.5 h-3.5 animate-pulse" />
            Global Health: Online
          </div>
        </div>
      </div>

      {statusMessage && (
        <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-200 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Global SaaS Platform KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="metis-card p-5 rounded-xl border border-slate-800/80">
          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total SaaS Tenants</div>
          <div className="text-2xl font-bold text-white mt-1">
            {platformOverview.totalBusinesses || tenants.length}
          </div>
        </div>
        <div className="metis-card p-5 rounded-xl border border-slate-800/80">
          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Active Business Accounts</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">
            {platformOverview.activeBusinesses || tenants.filter(t => t.status === 'ACTIVE').length}
          </div>
        </div>
        <div className="metis-card p-5 rounded-xl border border-slate-800/80">
          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Global Enrolled Laptops</div>
          <div className="text-2xl font-bold text-cyan-400 mt-1">
            {platformOverview.totalDevicesGlobal}
          </div>
        </div>
        <div className="metis-card p-5 rounded-xl border border-slate-800/80">
          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Global Financing Volume</div>
          <div className="text-2xl font-bold text-indigo-400 mt-1">
            TZS {(platformOverview.globalGrossVolumeTZS || 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Tenant Directory */}
      <div className="metis-card rounded-xl border border-slate-800/90 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Registered Multi-Tenant Workspaces</h2>
          <span className="text-xs text-slate-400">PostgreSQL Tenant Isolation</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Connecting to Super-Admin endpoints...
          </div>
        ) : tenants.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <div className="text-base font-semibold text-white">No tenants registered</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900/60 border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th className="p-4 pl-6">Business Entity</th>
                  <th className="p-4">Tenant Status</th>
                  <th className="p-4">Subscription Plan</th>
                  <th className="p-4">Fleet Allocation</th>
                  <th className="p-4 text-right pr-6">Super-Admin Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {tenants.map(tenant => (
                  <tr key={tenant.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-4 pl-6">
                      <div className="font-semibold text-white">{tenant.name}</div>
                      <div className="text-xs text-slate-400">{tenant.email} &bull; {tenant.country}</div>
                    </td>

                    <td className="p-4">
                      {tenant.status === 'ACTIVE' && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 w-fit">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Active & Verified
                        </span>
                      )}
                      {tenant.status === 'PENDING_VERIFICATION' && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 flex items-center gap-1 w-fit">
                          Pending KYC Review
                        </span>
                      )}
                      {tenant.status === 'SUSPENDED' && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1 w-fit">
                          <XCircle className="w-3.5 h-3.5" />
                          Suspended
                        </span>
                      )}
                    </td>

                    <td className="p-4">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 text-indigo-300 border border-slate-700">
                        {tenant.subscription?.plan?.name || 'Enterprise'}
                      </span>
                    </td>

                    <td className="p-4 text-xs font-mono text-slate-300">
                      <strong>{tenant._count?.devices || 0}</strong> / {tenant.subscription?.plan?.maxDevices || 250} devices
                    </td>

                    <td className="p-4 pr-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setQuotaModalTenant(tenant);
                            setDeviceQuota(tenant.subscription?.plan?.maxDevices || 250);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 border border-slate-700 transition-colors"
                        >
                          <Sliders className="w-3 h-3" />
                          Quota
                        </button>

                        {tenant.status === 'ACTIVE' ? (
                          <button
                            onClick={() => handleToggleStatus(tenant.id, tenant.status)}
                            className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold transition-colors"
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleStatus(tenant.id, tenant.status)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-colors"
                          >
                            Verify / Activate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quota Modal */}
      {quotaModalTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#121927] border border-slate-800 rounded-xl w-full max-w-sm p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Override Device Quota</h3>
              <button
                onClick={() => setQuotaModalTenant(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateQuota} className="space-y-4 mt-4">
              <div className="text-xs text-slate-400">
                Tenant: <strong className="text-white">{quotaModalTenant.name}</strong>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Max Enrolled Devices Quota</label>
                <input
                  type="number"
                  min={1}
                  max={5000}
                  value={deviceQuota}
                  onChange={e => setDeviceQuota(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-yellow-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setQuotaModalTenant(null)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingQuota}
                  className="px-5 py-2 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-navy-950 text-sm font-bold disabled:opacity-50"
                >
                  {updatingQuota ? 'Saving...' : 'Apply Quota'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
