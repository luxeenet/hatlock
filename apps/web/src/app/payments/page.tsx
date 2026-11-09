'use client';

import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Smartphone,
  AlertCircle,
  RefreshCw,
  X,
  FileText,
  Sliders,
  Send,
  Zap,
  Lock,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import {
  apiPayments,
  apiFinancing,
  apiRentals,
  PaymentTransaction,
  PaymentProviderInfo,
  FinancingAgreement,
  RentalAgreement
} from '../../lib/api';

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [providers, setProviders] = useState<PaymentProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'LEDGER' | 'PROVIDERS'>('LEDGER');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Checkout Modal State
  const [checkoutModal, setCheckoutModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'HATPESA' | 'SONICPESA'>('HATPESA');
  const [hpAgreements, setHpAgreements] = useState<FinancingAgreement[]>([]);
  const [rentalAgreements, setRentalAgreements] = useState<RentalAgreement[]>([]);
  const [agreementType, setAgreementType] = useState<'HIRE_PURCHASE' | 'RENTAL'>('HIRE_PURCHASE');
  const [selectedAgreementId, setSelectedAgreementId] = useState('');
  const [customerPhone, setCustomerPhone] = useState('+255 712 345 678');
  const [checkoutAmount, setCheckoutAmount] = useState('300000');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Payout Modal State
  const [payoutModal, setPayoutModal] = useState(false);
  const [payoutPhone, setPayoutPhone] = useState('+255 712 345 678');
  const [payoutName, setPayoutName] = useState('Vendor / Partner');
  const [payoutAmount, setPayoutAmount] = useState('50000');
  const [payoutPin, setPayoutPin] = useState('');
  const [submittingPayout, setSubmittingPayout] = useState(false);

  // Provider Testing State
  const [testingProvider, setTestingProvider] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [payData, provData] = await Promise.all([
        apiPayments.list(),
        apiPayments.getProviders().catch(() => ({ providers: [] }))
      ]);
      setPayments(payData.payments || []);
      setProviders(provData.providers || []);
    } catch (err: any) {
      console.error('Failed to load payments data:', err);
      setError(err.message || 'Failed to load payments.');
    } finally {
      setLoading(false);
    }
  };

  const loadAgreements = async () => {
    try {
      const [hpRes, rtRes] = await Promise.all([apiFinancing.list(), apiRentals.list()]);
      setHpAgreements(hpRes.agreements || []);
      setRentalAgreements(rtRes.rentals || []);
      if (hpRes.agreements?.length > 0) {
        setSelectedAgreementId(hpRes.agreements[0].id);
      }
    } catch (err) {
      console.warn('Failed to load agreements:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenModal = async () => {
    await loadAgreements();
    setCheckoutModal(true);
  };

  const handleSimulatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingPayment(true);
    setError(null);

    try {
      if (!selectedAgreementId) {
        throw new Error('Please select an active agreement.');
      }

      const res = await apiPayments.initiate({
        agreementType,
        agreementId: selectedAgreementId,
        amount: Number(checkoutAmount),
        phoneNumber: customerPhone,
        provider: selectedProvider,
        paymentMethod: selectedProvider === 'SONICPESA' ? 'SONICPESA_MOBILE' : 'HATPESA_MOBILE'
      });

      setCheckoutSuccess(
        `Payment initiated via ${selectedProvider} (Ref: ${res.reference}). Ledger updated in PostgreSQL and immediate hardware unlock queued.`
      );
      setCheckoutModal(false);
      await loadData();
      setTimeout(() => setCheckoutSuccess(null), 6000);
    } catch (err: any) {
      setError(err.message || 'Failed to initiate payment.');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleDispatchPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingPayout(true);
    setError(null);

    try {
      const res = await apiPayments.createPayout({
        amount: Number(payoutAmount),
        recipientPhone: payoutPhone,
        recipientName: payoutName,
        transactionPin: payoutPin,
        remarks: 'Authorized payout from admin console'
      });

      setCheckoutSuccess(`SonicPesa Payout of TZS ${Number(payoutAmount).toLocaleString()} dispatched successfully.`);
      setPayoutModal(false);
      setPayoutPin('');
      await loadData();
      setTimeout(() => setCheckoutSuccess(null), 6000);
    } catch (err: any) {
      setError(err.message || 'Payout failed. Verify administrative authority and PIN.');
    } finally {
      setSubmittingPayout(false);
    }
  };

  const handleTestProvider = async (providerName: string) => {
    setTestingProvider(providerName);
    setError(null);
    try {
      const res = await apiPayments.testProvider(providerName);
      setCheckoutSuccess(`${providerName} status: ${res.message}`);
      await loadData();
      setTimeout(() => setCheckoutSuccess(null), 5000);
    } catch (err: any) {
      setError(err.message || `Failed to test ${providerName}`);
    } finally {
      setTestingProvider(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-emerald-400" />
            Universal Payment Gateways & Ledger
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Multi-provider mobile money reconciliation (HatPesa & SonicPesa) with HMAC-SHA256 signature verification & immediate hardware unlock.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            title="Refresh Transactions"
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setPayoutModal(true)}
            className="px-4 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 text-sm font-semibold flex items-center gap-2 transition-all"
          >
            <Send className="w-4 h-4" />
            SonicPesa Payout
          </button>
          <button
            onClick={handleOpenModal}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-navy-950 text-sm font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
          >
            <Smartphone className="w-4 h-4" />
            Initiate Repayment
          </button>
        </div>
      </div>

      {checkoutSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 flex-shrink-0" />
          <span>{checkoutSuccess}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('LEDGER')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 ${
            activeTab === 'LEDGER'
              ? 'bg-slate-800 text-white border border-slate-700'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" />
          Reconciled Journal ({payments.length})
        </button>
        <button
          onClick={() => setActiveTab('PROVIDERS')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 ${
            activeTab === 'PROVIDERS'
              ? 'bg-slate-800 text-white border border-slate-700'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Sliders className="w-4 h-4" />
          Provider Connectors ({providers.length})
        </button>
      </div>

      {activeTab === 'LEDGER' ? (
        <>
          {/* Gateway Status Banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-panel p-5 rounded-xl border border-slate-800">
              <div className="text-xs text-slate-400 font-medium">Gateway Protocol</div>
              <div className="text-base font-bold text-white mt-1">Dual-Engine (HatPesa + SonicPesa)</div>
              <div className="text-[11px] text-emerald-400 mt-1 font-mono">HMAC-SHA256 Signed Webhooks</div>
            </div>

            <div className="glass-panel p-5 rounded-xl border border-slate-800">
              <div className="text-xs text-slate-400 font-medium">Reconciliation Engine</div>
              <div className="text-base font-bold text-emerald-400 mt-1">Active (Real-Time)</div>
              <div className="text-[11px] text-slate-400 mt-1">Direct PostgreSQL Double-Entry Ledger</div>
            </div>

            <div className="glass-panel p-5 rounded-xl border border-slate-800">
              <div className="text-xs text-slate-400 font-medium">Total Transactions</div>
              <div className="text-base font-bold text-cyan-400 mt-1">{payments.length} Recorded</div>
              <div className="text-[11px] text-slate-400 mt-1">M-Pesa / Tigo Pesa / Airtel Money / Halopesa</div>
            </div>
          </div>

          {/* Transaction Table */}
          <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Reconciled Financial Ledger</h2>
              <span className="text-xs text-slate-400">Live ledger query</span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-400">
                <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                Loading financial ledger from PostgreSQL...
              </div>
            ) : payments.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <CreditCard className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <div className="text-base font-semibold text-white">No payment transactions recorded</div>
                <p className="text-xs text-slate-400 mt-1">
                  Click &quot;Initiate Repayment&quot; to test a customer mobile money repayment.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-900/60 border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="p-4 pl-6">Reference / Gateway ID</th>
                      <th className="p-4">Provider</th>
                      <th className="p-4">Agreement Context</th>
                      <th className="p-4">Amount (TZS)</th>
                      <th className="p-4">Payment Channel</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right pr-6">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {payments.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(payment => (
                      <tr key={payment.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-4 pl-6">
                          <div className="font-mono text-xs font-bold text-emerald-400">
                            {payment.reference}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                            Ext: {payment.externalTransactionId || 'HMAC_VERIFIED'}
                          </div>
                        </td>

                        <td className="p-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold ${
                              payment.paymentProvider === 'SONICPESA'
                                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            }`}
                          >
                            {payment.paymentProvider || 'HATPESA'}
                          </span>
                        </td>

                        <td className="p-4">
                          <div className="font-mono text-xs text-white">
                            {payment.financingAgreement?.agreementNumber || payment.rentalAgreement?.agreementNumber || 'Contract'}
                          </div>
                        </td>

                        <td className="p-4 font-mono font-bold text-white">
                          TZS {payment.amountTZS.toLocaleString()}
                        </td>

                        <td className="p-4">
                          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-slate-800 border border-slate-700 text-slate-300">
                            {payment.method || 'MOBILE_MONEY'}
                          </span>
                        </td>

                        <td className="p-4">
                          {payment.status === 'SUCCESS' || (payment.status as string) === 'COMPLETED' ? (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 w-fit">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Reconciled
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1 w-fit">
                              <Clock className="w-3.5 h-3.5" />
                              {payment.status}
                            </span>
                          )}
                        </td>

                        <td className="p-4 pr-6 text-right text-xs text-slate-400 font-mono">
                          {new Date(payment.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {!loading && payments.length > 0 && (
              <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 bg-navy-950/40">
                <div>
                  Page <span className="font-semibold text-white">{currentPage}</span> of{' '}
                  <span className="font-semibold text-white">{Math.ceil(payments.length / itemsPerPage) || 1}</span>
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
                    onClick={() => setCurrentPage(prev => Math.min(Math.ceil(payments.length / itemsPerPage) || 1, prev + 1))}
                    disabled={currentPage === Math.ceil(payments.length / itemsPerPage) || currentPage * itemsPerPage >= payments.length}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors flex items-center gap-1"
                  >
                    Next
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Payment Provider Management View */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {providers.map(p => (
            <div key={p.provider} className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${p.provider === 'SONICPESA' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'}`}>
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">{p.name}</h3>
                    <div className="text-xs text-slate-400 font-mono">Provider: {p.provider}</div>
                  </div>
                </div>

                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
                  p.isEnabled ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${p.isEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                  {p.isEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-slate-400">Environment Mode:</span>
                  <span className="font-semibold text-white">{p.isTestMode ? 'Sandbox / Test Mode' : 'Production Live'}</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-slate-400">API Key:</span>
                  <span className="font-mono text-cyan-300">{p.maskedApiKey || 'System Environment Key'}</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-slate-400">Last Connectivity Probe:</span>
                  <span className="text-slate-300 font-medium">{p.lastTestedAt ? new Date(p.lastTestedAt).toLocaleString() : 'Ready'}</span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">HMAC-SHA256 signature verification active</span>
                <button
                  onClick={() => handleTestProvider(p.provider)}
                  disabled={testingProvider === p.provider}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingProvider === p.provider ? 'animate-spin' : ''}`} />
                  {testingProvider === p.provider ? 'Testing...' : 'Test Connection'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Checkout Modal */}
      {checkoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-navy-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Initiate Customer Mobile Repayment</h3>
              </div>
              <button
                onClick={() => setCheckoutModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSimulatePayment} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Payment Provider</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedProvider('HATPESA')}
                    className={`py-2 rounded-xl text-xs font-semibold border transition-colors ${
                      selectedProvider === 'HATPESA'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'border-slate-800 text-slate-400'
                    }`}
                  >
                    HatPesa Gateway
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedProvider('SONICPESA')}
                    className={`py-2 rounded-xl text-xs font-semibold border transition-colors ${
                      selectedProvider === 'SONICPESA'
                        ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
                        : 'border-slate-800 text-slate-400'
                    }`}
                  >
                    SonicPesa Gateway
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Contract Category</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAgreementType('HIRE_PURCHASE');
                      if (hpAgreements.length > 0) setSelectedAgreementId(hpAgreements[0].id);
                    }}
                    className={`py-2 rounded-xl text-xs font-semibold border transition-colors ${
                      agreementType === 'HIRE_PURCHASE'
                        ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
                        : 'border-slate-800 text-slate-400'
                    }`}
                  >
                    Hire Purchase
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAgreementType('RENTAL');
                      if (rentalAgreements.length > 0) setSelectedAgreementId(rentalAgreements[0].id);
                    }}
                    className={`py-2 rounded-xl text-xs font-semibold border transition-colors ${
                      agreementType === 'RENTAL'
                        ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                        : 'border-slate-800 text-slate-400'
                    }`}
                  >
                    Equipment Rental
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Target Contract</label>
                {agreementType === 'HIRE_PURCHASE' ? (
                  hpAgreements.length === 0 ? (
                    <div className="text-xs text-rose-400 p-2 bg-rose-500/10 rounded-lg">
                      No active Hire Purchase contracts found.
                    </div>
                  ) : (
                    <select
                      value={selectedAgreementId}
                      onChange={e => setSelectedAgreementId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                    >
                      {hpAgreements.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.agreementNumber} - Bal: TZS {a.remainingBalanceTZS.toLocaleString()}
                        </option>
                      ))}
                    </select>
                  )
                ) : (
                  rentalAgreements.length === 0 ? (
                    <div className="text-xs text-rose-400 p-2 bg-rose-500/10 rounded-lg">
                      No active Rental contracts found.
                    </div>
                  ) : (
                    <select
                      value={selectedAgreementId}
                      onChange={e => setSelectedAgreementId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                    >
                      {rentalAgreements.map(r => (
                        <option key={r.id} value={r.id}>
                          {r.agreementNumber} - Rate: TZS {Number(r.rentalRatePerPeriodTZS ?? r.rentalPriceTZS ?? 0).toLocaleString()}
                        </option>
                      ))}
                    </select>
                  )
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Customer Mobile Number</label>
                <input
                  type="text"
                  required
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Repayment Amount (TZS)</label>
                <input
                  type="number"
                  required
                  value={checkoutAmount}
                  onChange={e => setCheckoutAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCheckoutModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment || !selectedAgreementId}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-navy-950 text-sm font-bold disabled:opacity-50"
                >
                  {submittingPayment ? 'Processing...' : `Initiate ${selectedProvider}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payout Modal */}
      {payoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-navy-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Authorized SonicPesa Payout</h3>
              </div>
              <button
                onClick={() => setPayoutModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDispatchPayout} className="space-y-4 mt-4">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 flex items-center gap-2">
                <Lock className="w-4 h-4 flex-shrink-0" />
                <span>Restricted operation. Requires administrative PIN & audit logging.</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Recipient Mobile Number</label>
                <input
                  type="text"
                  required
                  value={payoutPhone}
                  onChange={e => setPayoutPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Recipient Name / Company</label>
                <input
                  type="text"
                  required
                  value={payoutName}
                  onChange={e => setPayoutName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Payout Amount (TZS)</label>
                <input
                  type="number"
                  required
                  value={payoutAmount}
                  onChange={e => setPayoutAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Administrative Transaction PIN</label>
                <input
                  type="password"
                  required
                  value={payoutPin}
                  onChange={e => setPayoutPin(e.target.value)}
                  placeholder="Enter 4-digit PIN"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPayoutModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayout || !payoutPin}
                  className="px-5 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-bold disabled:opacity-50"
                >
                  {submittingPayout ? 'Authorizing...' : 'Authorize & Dispatch Payout'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
