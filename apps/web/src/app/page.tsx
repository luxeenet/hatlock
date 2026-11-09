'use client';

import React, { useState, useEffect } from 'react';
import {
  Laptop,
  ShieldCheck,
  CreditCard,
  FileText,
  Repeat,
  AlertTriangle,
  Lock,
  Unlock,
  TrendingUp,
  Cpu,
  Layers,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  RefreshCw,
  Users,
  Smartphone,
  Shield,
  Activity,
  Plus
} from 'lucide-react';
import Link from 'next/link';
import { apiDashboard, apiDevices, apiPayments, apiFinancing, apiRentals, Device, PaymentTransaction } from '../lib/api';

export default function DashboardOverview() {
  const [loading, setLoading] = useState(true);
  const [recentDevices, setRecentDevices] = useState<Device[]>([]);
  const [recentPayments, setRecentPayments] = useState<PaymentTransaction[]>([]);
  const [metrics, setMetrics] = useState({
    totalDevices: 0,
    availableDevices: 0,
    activeFinancingCount: 0,
    activeRentalCount: 0,
    restrictedDevices: 0,
    gracePeriodDevices: 0,
    customerOwnedDevices: 0,
    totalCustomers: 0,
    totalRevenueTZS: 0,
    pendingCommandsCount: 0,
    osDistribution: { windows: 0, linux: 0, other: 0 },
    hardwareSecurity: { tpmSecured: 0, standard: 0 }
  });

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [kpiRes, devRes, payRes] = await Promise.allSettled([
        apiDashboard.getMetrics(),
        apiDevices.list(),
        apiPayments.list()
      ]);

      if (kpiRes.status === 'fulfilled' && kpiRes.value?.kpis) {
        const kpis = kpiRes.value.kpis;
        setMetrics({
          totalDevices: kpis.totalDevices ?? 0,
          availableDevices: kpis.availableDevices ?? 0,
          activeFinancingCount: kpis.activeFinancingCount ?? 0,
          activeRentalCount: kpis.activeRentalCount ?? 0,
          restrictedDevices: kpis.restrictedDevices ?? 0,
          gracePeriodDevices: kpis.gracePeriodDevices ?? 0,
          customerOwnedDevices: kpis.customerOwnedDevices ?? 0,
          totalCustomers: kpis.totalCustomers ?? 0,
          totalRevenueTZS: Number(kpis.totalRevenueTZS) || 0,
          pendingCommandsCount: kpis.pendingCommandsCount ?? 0,
          osDistribution: kpis.osDistribution || { windows: 0, linux: 0, other: 0 },
          hardwareSecurity: kpis.hardwareSecurity || { tpmSecured: 0, standard: 0 }
        });
      }

      if (devRes.status === 'fulfilled' && devRes.value?.devices) {
        setRecentDevices(devRes.value.devices.slice(0, 5));
      }

      if (payRes.status === 'fulfilled' && payRes.value?.payments) {
        setRecentPayments(payRes.value.payments.slice(0, 5));
      }
    } catch (err) {
      console.warn('Dashboard metrics fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 sm:p-6 rounded-xl bg-[#121927] border border-slate-800/90 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs tracking-wider uppercase">
            <ShieldCheck className="w-4 h-4" />
            HatLock Enterprise SaaS &bull; Luxeenet
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-1">Operational Fleet Dashboard</h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
            Real-time telemetry, automated payment enforcement, and cryptographic device authorization.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <button
            onClick={loadDashboardData}
            title="Refresh Live Metrics"
            className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/80 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/devices"
            className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs sm:text-sm transition-colors flex items-center gap-2 shadow-sm active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Enroll Device
          </Link>
          <Link
            href="/financing"
            className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 font-medium text-xs sm:text-sm transition-colors border border-slate-700/80 shadow-sm active:scale-95"
          >
            New Agreement
          </Link>
        </div>
      </div>

      {/* Primary KPI Grid (6 Top Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total Fleet */}
        <div className="metis-card p-4 sm:p-5 rounded-xl border border-slate-800/80 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Total Fleet</span>
            <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Laptop className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-white mt-2 tracking-tight">
            {loading ? <div className="w-10 h-7 bg-slate-800 animate-pulse rounded" /> : metrics.totalDevices}
          </div>
          <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1 font-medium">
            <CheckCircle2 className="w-3 h-3 shrink-0" />
            <span>{metrics.availableDevices} in stock</span>
          </div>
        </div>

        {/* Financed (HP) */}
        <div className="metis-card p-4 sm:p-5 rounded-xl border border-slate-800/80 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Hire Purchase</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <FileText className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-white mt-2 tracking-tight">
            {loading ? <div className="w-10 h-7 bg-slate-800 animate-pulse rounded" /> : metrics.activeFinancingCount}
          </div>
          <div className="text-[11px] text-indigo-300 mt-1 font-medium">
            Ownership conditional
          </div>
        </div>

        {/* Leased (Rentals) */}
        <div className="metis-card p-4 sm:p-5 rounded-xl border border-slate-800/80 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Active Rentals</span>
            <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
              <Repeat className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-white mt-2 tracking-tight">
            {loading ? <div className="w-10 h-7 bg-slate-800 animate-pulse rounded" /> : metrics.activeRentalCount}
          </div>
          <div className="text-[11px] text-purple-300 mt-1 font-medium">
            Title strictly retained
          </div>
        </div>

        {/* Restricted (Locked) */}
        <div className="metis-card p-4 sm:p-5 rounded-xl border border-slate-800/80 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Locked / Restr.</span>
            <div className="w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
              <Lock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className={`text-xl sm:text-2xl font-extrabold mt-2 tracking-tight ${metrics.restrictedDevices > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
            {loading ? <div className="w-10 h-7 bg-slate-800 animate-pulse rounded" /> : metrics.restrictedDevices}
          </div>
          <div className="text-[11px] text-rose-300 mt-1 font-medium">
            {metrics.restrictedDevices > 0 ? 'Non-payment policy' : 'Fleet compliant'}
          </div>
        </div>

        {/* Grace Period */}
        <div className="metis-card p-4 sm:p-5 rounded-xl border border-slate-800/80 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Grace Period</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className={`text-xl sm:text-2xl font-extrabold mt-2 tracking-tight ${metrics.gracePeriodDevices > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
            {loading ? <div className="w-10 h-7 bg-slate-800 animate-pulse rounded" /> : metrics.gracePeriodDevices}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {metrics.gracePeriodDevices > 0 ? 'Lock warning pending' : 'Zero overdue grace'}
          </div>
        </div>

        {/* Customers */}
        <div className="metis-card p-4 sm:p-5 rounded-xl border border-slate-800/80 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Customers</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-white mt-2 tracking-tight">
            {loading ? <div className="w-10 h-7 bg-slate-800 animate-pulse rounded" /> : metrics.totalCustomers}
          </div>
          <div className="text-[11px] text-emerald-400 mt-1 font-medium">
            Verified accounts
          </div>
        </div>
      </div>

      {/* Financial Collections & Security Breakdown Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
        {/* Total Settled Collections */}
        <div className="metis-card p-5 sm:p-6 rounded-xl border border-slate-800/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold tracking-wider uppercase">
              <span>Settled Revenue</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <CreditCard className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-xs text-slate-400 font-medium">Total HatPesa & SonicPesa Reconciled:</div>
              <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1.5 font-mono tracking-tight">
                TZS {metrics.totalRevenueTZS.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">Customer Owned Devices:</span>
            <span className="font-bold text-purple-400 font-mono">{metrics.customerOwnedDevices} Transferred</span>
          </div>
        </div>

        {/* Operating Systems & Multi-Brand Distribution */}
        <div className="metis-card p-5 sm:p-6 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold tracking-wider uppercase mb-4">
            <span>Operating System Fleet</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Cpu className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="space-y-3.5">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300 font-medium">Windows Service (x64)</span>
                <span className="text-cyan-400 font-mono">{metrics.osDistribution.windows} devices</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-cyan-400 rounded-full transition-all"
                  style={{ width: `${metrics.totalDevices > 0 ? (metrics.osDistribution.windows / metrics.totalDevices) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300 font-medium">Linux systemd Daemon</span>
                <span className="text-emerald-400 font-mono">{metrics.osDistribution.linux} devices</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-400 rounded-full transition-all"
                  style={{ width: `${metrics.totalDevices > 0 ? (metrics.osDistribution.linux / metrics.totalDevices) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300 font-medium">Android Enterprise & Apple MDM</span>
                <span className="text-indigo-400 font-mono">{metrics.osDistribution.other} devices</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-indigo-400 rounded-full transition-all"
                  style={{ width: `${metrics.totalDevices > 0 ? (metrics.osDistribution.other / metrics.totalDevices) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Cryptographic Protection */}
        <div className="metis-card p-5 sm:p-6 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold tracking-wider uppercase mb-4">
            <span>Hardware Integrity</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Shield className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/80 border border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-slate-300 font-medium">TPM 2.0 & BitLocker Attested</span>
              </div>
              <span className="text-xs font-bold text-white font-mono">{metrics.hardwareSecurity.tpmSecured}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/80 border border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-cyan-400" />
                <span className="text-xs text-slate-300 font-medium">Standard Cryptographic Agent</span>
              </div>
              <span className="text-xs font-bold text-white font-mono">{metrics.hardwareSecurity.standard}</span>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 px-1 pt-1">
              <span>Pending ECDSA Lock Commands:</span>
              <span className={`font-mono font-bold ${metrics.pendingCommandsCount > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                {metrics.pendingCommandsCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        <Link
          href="/devices"
          className="metis-card p-5 sm:p-6 rounded-xl border border-slate-800/80 hover:border-cyan-500/40 transition-all hover:-translate-y-0.5 group"
        >
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mb-3.5 group-hover:scale-105 transition-transform">
            <Laptop className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white flex items-center justify-between">
            <span>Device Inventory</span>
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 transition-colors" />
          </h3>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Register new laptops, view hardware TPM attestation, and remotely dispatch signed lock/unlock commands.
          </p>
        </Link>

        <Link
          href="/customers"
          className="metis-card p-5 sm:p-6 rounded-xl border border-slate-800/80 hover:border-amber-500/40 transition-all hover:-translate-y-0.5 group"
        >
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-3.5 group-hover:scale-105 transition-transform">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white flex items-center justify-between">
            <span>Customer Directory</span>
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-amber-400 transition-colors" />
          </h3>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Register KYC verified customer accounts, verify national IDs, and trace assigned devices and contracts.
          </p>
        </Link>

        <Link
          href="/payments"
          className="metis-card p-5 sm:p-6 rounded-xl border border-slate-800/80 hover:border-emerald-500/40 transition-all hover:-translate-y-0.5 group"
        >
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3.5 group-hover:scale-105 transition-transform">
            <CreditCard className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white flex items-center justify-between">
            <span>HatPesa Collections</span>
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-400 transition-colors" />
          </h3>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Real-time reconciliation of mobile money payments with automatic signed unlock command broadcast.
          </p>
        </Link>
      </div>

      {/* Recent Devices & Recent Payments Live Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        {/* Recent Devices */}
        <div className="metis-card rounded-xl border border-slate-800/90 overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/50">
            <div className="flex items-center gap-2">
              <Laptop className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-bold text-white">Recent Inventory Enrolled</h2>
            </div>
            <Link href="/devices" className="text-xs text-cyan-400 hover:text-cyan-300 font-medium">
              View All &rarr;
            </Link>
          </div>

          <div className="divide-y divide-slate-800/60">
            {recentDevices.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No devices enrolled in inventory yet.
              </div>
            ) : (
              recentDevices.map(d => (
                <div key={d.id} className="p-3.5 sm:p-4 flex items-center justify-between hover:bg-slate-800/40 transition-colors text-xs">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-slate-800/80 text-slate-300 shrink-0 border border-slate-700/60">
                      {d.currentOS === 'ANDROID' || d.currentOS === 'IOS' ? (
                        <Smartphone className="w-4 h-4 text-indigo-400" />
                      ) : (
                        <Laptop className="w-4 h-4 text-cyan-400" />
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-white">
                        {d.manufacturer} {d.model}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                        S/N: {d.serialNumber}
                      </div>
                    </div>
                  </div>

                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                    d.status === 'AVAILABLE'
                      ? 'bg-slate-800 text-slate-300 border border-slate-700'
                      : d.status === 'ACTIVE'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : d.status === 'RESTRICTED'
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  }`}>
                    {d.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Payments */}
        <div className="metis-card rounded-xl border border-slate-800/90 overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/50">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-white">Recent Settlements (HatPesa)</h2>
            </div>
            <Link href="/payments" className="text-xs text-emerald-400 hover:text-emerald-300 font-medium">
              View All &rarr;
            </Link>
          </div>

          <div className="divide-y divide-slate-800/60">
            {recentPayments.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No recent payment transactions found.
              </div>
            ) : (
              recentPayments.map(p => (
                <div key={p.id} className="p-3.5 sm:p-4 flex items-center justify-between hover:bg-slate-800/40 transition-colors text-xs">
                  <div>
                    <div className="font-semibold text-white font-mono">
                      TZS {p.amountTZS.toLocaleString()}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      Ref: {p.reference || p.externalTransactionId || 'HP_TRANS'}
                    </div>
                  </div>

                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                    p.status === 'SUCCESS' || (p.status as string) === 'COMPLETED'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : p.status === 'PENDING'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  }`}>
                    {p.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
