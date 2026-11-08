'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  customerApi,
  CustomerAgreement,
  CustomerPaymentRecord,
  CustomerPortalData
} from '../lib/api';
import {
  Laptop,
  CreditCard,
  FileText,
  Repeat,
  ShieldCheck,
  Lock,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Download,
  Smartphone,
  ArrowRight,
  X,
  LogOut,
  RefreshCw,
  User,
  ShieldAlert
} from 'lucide-react';

export default function CustomerDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [customer, setCustomer] = useState<CustomerPortalData['customer'] | null>(null);
  const [agreements, setAgreements] = useState<CustomerAgreement[]>([]);
  const [payments, setPayments] = useState<CustomerPaymentRecord[]>([]);

  const [activeTab, setActiveTab] = useState<'agreements' | 'payments'>('agreements');
  const [paymentModal, setPaymentModal] = useState<CustomerAgreement | null>(null);
  const [selectedGateway, setSelectedGateway] = useState<'HATPESA' | 'SONICPESA'>('HATPESA');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);
  const [paymentPendingNotice, setPaymentPendingNotice] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  // Authenticate session & load real customer data from backend
  const loadPortalData = async () => {
    setLoading(true);
    setLoadError(null);

    const token = typeof window !== 'undefined' ? localStorage.getItem('hatlock_customer_token') : null;
    if (!token) {
      router.replace('/login');
      return;
    }

    try {
      const data = await customerApi.getPortalData();
      setCustomer(data.customer);
      setAgreements(data.agreements || []);
      setPayments(data.payments || []);
      if (data.customer?.phone) {
        setPhoneNumber(data.customer.phone);
      }
    } catch (err: any) {
      if (err.message && err.message.includes('expired')) {
        router.replace('/login?expired=1');
      } else {
        setLoadError(err.message || 'Failed to load customer agreements. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortalData();
  }, []);

  const handleMakePayment = async () => {
    if (!paymentModal || paying) return;
    setPaymentError(null);

    const cleanPhone = phoneNumber.replace(/[^\d+]/g, '');
    if (!cleanPhone || cleanPhone.replace(/\D/g, '').length < 9) {
      setPaymentError('Please enter a valid phone number (at least 9 digits).');
      return;
    }

    const amountNum = Number(paymentAmount);
    if (!amountNum || isNaN(amountNum) || amountNum <= 0) {
      setPaymentError('Please enter a valid positive payment amount.');
      return;
    }

    setPaying(true);

    try {
      const res = await customerApi.initiatePayment({
        agreementType: paymentModal.type,
        agreementId: paymentModal.id,
        amount: amountNum,
        phoneNumber: cleanPhone,
        provider: selectedGateway
      });

      const backendRef = res.reference || res.payment?.transactionReference || 'PENDING';
      const backendStatus = res.payment?.status || (res.status === 'INITIATED' ? 'PENDING' : 'PENDING');

      if (backendStatus === 'COMPLETED') {
        // Confirmed settlement
        setPaymentSuccess(
          `Payment of TZS ${amountNum.toLocaleString()} confirmed successfully via ${selectedGateway}. Reference: ${backendRef}.`
        );
        setPaymentModal(null);
        await loadPortalData();
        setTimeout(() => setPaymentSuccess(null), 8000);
      } else {
        // Standard USSD prompt sent to customer handset
        setPaymentPendingNotice(
          `Payment prompt sent to ${cleanPhone}. Please authorize with your M-Pesa / Tigo PIN on your phone. Reference: ${backendRef}.`
        );
        setPaymentModal(null);
        await loadPortalData();
        setTimeout(() => setPaymentPendingNotice(null), 10000);
      }
    } catch (err: any) {
      setPaymentError(err.message || 'Payment initiation failed. Please check your phone number and try again.');
    } finally {
      setPaying(false);
    }
  };

  const handleDownloadReceipt = (ref: string, amount: number) => {
    const receiptContent = `HATLOCK PAYMENT RECEIPT\n---------------------------------\nTransaction Reference: ${ref}\nCustomer: ${customer ? `${customer.firstName} ${customer.lastName}` : 'Verified Customer'}\nPhone: ${customer?.phone || 'N/A'}\nAmount Paid: TZS ${amount.toLocaleString()}\nStatus: VERIFIED & RECONCILED\nDate: ${new Date().toISOString()}\nSecured by HatLock Cryptographic Device Security\n`;
    const blob = new Blob([receiptContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${ref}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    const headers = 'Reference,Date,Amount_TZS,Status,Provider\n';
    const rows = payments.map(p => `"${p.reference}","${p.date}",${p.amountTZS},"${p.status}","${p.provider}"`).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hatlock-payments-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs tracking-wide uppercase font-semibold text-slate-500">Loading your agreements & verified status...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 px-4">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-md w-full text-center shadow-xl">
          <ShieldAlert className="w-12 h-12 text-rose-400 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-white mb-2">Unable to Load Portal</h2>
          <p className="text-xs text-slate-400 mb-6">{loadError}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={loadPortalData}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
            <button
              onClick={() => customerApi.logout()}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 max-w-6xl mx-auto font-sans">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                HatLock Borrower Portal
              </h1>
              <p className="text-xs text-slate-400">
                {customer?.businessName ? `Financed via ${customer.businessName}` : 'Secure Device Lease & Payment Management'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {customer && (
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-white flex items-center gap-1.5 justify-end">
                <User className="w-3.5 h-3.5 text-emerald-400" />
                {customer.firstName} {customer.lastName}
              </div>
              <div className="text-[11px] text-slate-400 font-mono">{customer.phone}</div>
            </div>
          )}

          <button
            onClick={() => customerApi.logout()}
            className="px-3.5 py-1.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </header>

      {/* Global Alerts */}
      {paymentSuccess && (
        <div className="my-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-3 shadow-lg shadow-emerald-500/5">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{paymentSuccess}</span>
        </div>
      )}

      {paymentPendingNotice && (
        <div className="my-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-3 shadow-lg shadow-amber-500/5">
          <Clock className="w-5 h-5 text-amber-400 shrink-0 animate-pulse" />
          <span>{paymentPendingNotice}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 my-6">
        <button
          onClick={() => setActiveTab('agreements')}
          className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'agreements'
              ? 'border-emerald-400 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Laptop className="w-4 h-4" />
          Active Hardware Agreements ({agreements.length})
        </button>
        <button
          onClick={() => setActiveTab('payments')}
          className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'payments'
              ? 'border-emerald-400 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Payment Transactions ({payments.length})
        </button>
      </div>

      {/* Agreements Tab */}
      {activeTab === 'agreements' && (
        <div className="space-y-6">
          {agreements.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center border border-slate-800">
              <Laptop className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white mb-1">No Active Agreements Found</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                There are currently no active device financing or rental contracts associated with this verified phone number.
              </p>
            </div>
          ) : (
            agreements.map((agr) => {
              const progressPct = agr.totalAmountTZS > 0
                ? Math.min(100, Math.round((agr.paidAmountTZS / agr.totalAmountTZS) * 100))
                : 100;

              return (
                <div
                  key={agr.id}
                  className="bg-slate-900/60 backdrop-blur-md rounded-2xl p-6 border border-slate-800 shadow-xl relative overflow-hidden"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {agr.type === 'HIRE_PURCHASE' ? 'Hire Purchase' : 'Rental Lease'}
                        </span>
                        <span className="font-mono text-xs text-slate-400">
                          {agr.agreementNumber}
                        </span>
                      </div>
                      <h2 className="text-lg font-bold text-white mt-1">
                        {agr.device}
                      </h2>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">
                        Serial Number: <span className="text-slate-300">{agr.serialNumber}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {agr.isLocked ? (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold">
                          <Lock className="w-3.5 h-3.5" />
                          Device Restricted (Non-Payment)
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Hardware Unlocked & Active
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Financial Overview */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 my-2">
                    <div>
                      <div className="text-[11px] text-slate-400 font-medium">Total Agreement Value</div>
                      <div className="text-sm font-bold text-white font-mono mt-0.5">
                        TZS {agr.totalAmountTZS.toLocaleString()}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] text-slate-400 font-medium">Total Paid to Date</div>
                      <div className="text-sm font-bold text-emerald-400 font-mono mt-0.5">
                        TZS {agr.paidAmountTZS.toLocaleString()}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] text-slate-400 font-medium">Next Instalment Due</div>
                      <div className="text-sm font-bold text-cyan-400 font-mono mt-0.5">
                        TZS {agr.nextInstalmentTZS > 0 ? agr.nextInstalmentTZS.toLocaleString() : 'Settled'}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] text-slate-400 font-medium">Payment Due Date</div>
                      <div className="text-sm font-bold text-white font-mono mt-0.5">
                        {agr.nextDueDateStr}
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5 mb-4">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Repayment Progress</span>
                      <span className="font-mono text-slate-300">{progressPct}% complete</span>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                      <div
                        className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Legal Note & Pay Action */}
                  <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <p className="text-slate-400 text-[11px] max-w-lg leading-relaxed">
                      {agr.ownershipNote}
                    </p>

                    <button
                      onClick={() => {
                        setPaymentModal(agr);
                        setPaymentAmount(agr.nextInstalmentTZS > 0 ? String(agr.nextInstalmentTZS) : String(agr.outstandingBalanceTZS || 100000));
                        setPaymentError(null);
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all active:scale-95 shrink-0 cursor-pointer"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      Make Instalment Payment
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Payments Tab */}
      {activeTab === 'payments' && (
        <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl overflow-hidden border border-slate-800 shadow-xl">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">Verified Payment History</h2>
            {payments.length > 0 && (
              <button
                onClick={handleExportCSV}
                className="text-xs text-emerald-400 hover:underline flex items-center gap-1 font-medium cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
            )}
          </div>

          {payments.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs">
              No recorded payment transactions found for this account.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {payments.map((p) => (
                <div key={p.reference} className="p-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
                  <div>
                    <div className="font-mono text-xs text-cyan-400 font-semibold">{p.reference}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{p.date} • {p.provider} ({p.paymentMethod})</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-mono font-bold text-white text-sm">
                      TZS {p.amountTZS.toLocaleString()}
                    </span>
                    {p.status === 'SUCCESS' ? (
                      <span className="flex items-center gap-1 text-emerald-400 text-xs font-semibold">
                        <CheckCircle2 className="w-4 h-4" />
                        Verified
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-amber-400 text-xs font-semibold">
                        <Clock className="w-4 h-4" />
                        Pending
                      </span>
                    )}
                    <button
                      onClick={() => handleDownloadReceipt(p.reference, p.amountTZS)}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Download receipt"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Payment Modal */}
      {paymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Instant Mobile Money Repayment</h3>
              </div>
              <button
                onClick={() => {
                  setPaymentModal(null);
                  setPaymentError(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {paymentError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <span>{paymentError}</span>
              </div>
            )}

            <div className="space-y-4 my-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Payment Provider</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedGateway('HATPESA')}
                    className={`py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                      selectedGateway === 'HATPESA'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'border-slate-800 text-slate-400'
                    }`}
                  >
                    HatPesa Mobile
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedGateway('SONICPESA')}
                    className={`py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                      selectedGateway === 'SONICPESA'
                        ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
                        : 'border-slate-800 text-slate-400'
                    }`}
                  >
                    SonicPesa Gateway
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">M-Pesa / Mobile Phone Number</label>
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Amount to Pay (TZS)</label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300 space-y-1">
                <div className="font-semibold text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Instant Hardware Unlock Policy
                </div>
                <div>
                  Upon authorizing the prompt with your mobile PIN, verified settlement immediately updates your balance and dispatches an authentic unlock command.
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
              <button
                onClick={() => setPaymentModal(null)}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-sm cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={paying}
                onClick={handleMakePayment}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 cursor-pointer"
              >
                {paying ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  `Confirm & Pay via ${selectedGateway === 'HATPESA' ? 'HatPesa' : 'SonicPesa'}`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
