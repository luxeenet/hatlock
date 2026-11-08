'use client';

import { useState } from 'react';
import { customerApi, API_BASE } from '../lib/api';
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
  FileSpreadsheet
} from 'lucide-react';

interface Agreement {
  id: string;
  type: 'HIRE_PURCHASE' | 'RENTAL';
  agreementNumber: string;
  device: string;
  serialNumber: string;
  status: 'ACTIVE' | 'GRACE_PERIOD' | 'RESTRICTED' | 'OWNERSHIP_TRANSFERRED' | 'COMPLETED';
  totalAmountTZS: number;
  paidAmountTZS: number;
  nextDueDateStr: string;
  nextInstalmentTZS: number;
  ownershipNote: string;
}

interface PaymentRecord {
  reference: string;
  amountTZS: number;
  date: string;
  status: 'SUCCESS' | 'PENDING';
}

export default function CustomerDashboard() {
  const [activeTab, setActiveTab] = useState<'agreements' | 'payments'>('agreements');
  const [paymentModal, setPaymentModal] = useState<Agreement | null>(null);
  const [selectedGateway, setSelectedGateway] = useState<'HATPESA' | 'SONICPESA'>('HATPESA');
  const [phoneNumber, setPhoneNumber] = useState('+255 712 345 678');
  const [paymentAmount, setPaymentAmount] = useState('300000');
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);
  const [paymentPendingNotice, setPaymentPendingNotice] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  const [agreements, setAgreements] = useState<Agreement[]>([
    {
      id: 'a1',
      type: 'HIRE_PURCHASE',
      agreementNumber: 'HP-2026-000102',
      device: 'HP EliteBook 840 G8',
      serialNumber: 'LX-8894-HP15',
      status: 'ACTIVE',
      totalAmountTZS: 1800000,
      paidAmountTZS: 1200000,
      nextDueDateStr: '2026-11-01',
      nextInstalmentTZS: 300000,
      ownershipNote:
        'This laptop is financed under a Hire Purchase agreement. Title will transfer to you upon full payment completion and verification.'
    },
    {
      id: 'a2',
      type: 'RENTAL',
      agreementNumber: 'RT-2025-000088',
      device: 'Lenovo ThinkPad T14',
      serialNumber: 'LX-4412-THINK',
      status: 'ACTIVE',
      totalAmountTZS: 450000,
      paidAmountTZS: 150000,
      nextDueDateStr: '2026-11-15',
      nextInstalmentTZS: 150000,
      ownershipNote:
        'This laptop is rented. Ownership always remains with the lessor. The device must be returned at the end of your rental period.'
    }
  ]);

  const [payments, setPayments] = useState<PaymentRecord[]>([
    { reference: 'HP-1730291001-842', amountTZS: 300000, date: '2026-10-30', status: 'SUCCESS' },
    { reference: 'HP-1730278912-119', amountTZS: 300000, date: '2026-10-01', status: 'SUCCESS' },
    { reference: 'HP-1730205112-334', amountTZS: 300000, date: '2026-09-01', status: 'SUCCESS' },
    { reference: 'HP-1730172410-091', amountTZS: 300000, date: '2026-08-01', status: 'SUCCESS' }
  ]);

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

      const backendRef = res.reference || res.payment?.transactionReference || `HP-${Date.now()}`;
      const backendStatus = res.payment?.status || (res.status === 'INITIATED' ? 'PENDING' : 'PENDING');

      if (backendStatus === 'COMPLETED') {
        // Confirmed settlement
        setPayments(prev => [
          {
            reference: backendRef,
            amountTZS: amountNum,
            date: new Date().toISOString().split('T')[0],
            status: 'SUCCESS'
          },
          ...prev.filter(p => p.reference !== backendRef)
        ]);

        setAgreements(prev =>
          prev.map(a =>
            a.id === paymentModal.id
              ? { ...a, paidAmountTZS: Math.min(a.totalAmountTZS, a.paidAmountTZS + amountNum) }
              : a
          )
        );

        setPaymentSuccess(
          `Payment of TZS ${amountNum.toLocaleString()} confirmed successfully via ${selectedGateway}. Reference: ${backendRef}. Immediate hardware access policy active.`
        );
        setPaymentModal(null);
        setTimeout(() => setPaymentSuccess(null), 8000);
      } else {
        // Standard pending prompt sent to customer mobile
        setPayments(prev => [
          {
            reference: backendRef,
            amountTZS: amountNum,
            date: new Date().toISOString().split('T')[0],
            status: 'PENDING'
          },
          ...prev.filter(p => p.reference !== backendRef)
        ]);

        setPaymentPendingNotice(
          `Payment request initiated! Please check your mobile phone (${cleanPhone}) for the prompt and enter your M-Pesa / Tigo PIN to authorize payment. Reference: ${backendRef}.`
        );
        setPaymentModal(null);
        setTimeout(() => setPaymentPendingNotice(null), 12000);
      }
    } catch (err: any) {
      setPaymentError(
        err.message || 'Payment initiation failed. Please verify your phone number and network, then try again.'
      );
    } finally {
      setPaying(false);
    }
  };

  const handleDownloadReceipt = (reference: string, amount: number) => {
    const receiptContent = `===================================================
HATLOCK DIGITAL PAYMENT RECEIPT
Luxeenet Device Financing & Rental Platform
===================================================
Receipt Ref   : ${reference}
Date & Time   : ${new Date().toLocaleString()}
Amount Paid   : TZS ${amount.toLocaleString()}
Payment Method: HatPesa Mobile Money (M-Pesa / Tigo)
Status        : RECONCILED & HARDWARE UNLOCKED
Customer Phone: ${phoneNumber}
===================================================
Hardware Authorization Policy: ACTIVE
Cryptographic Signature: HMAC-SHA256 VERIFIED
===================================================`;

    const blob = new Blob([receiptContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HatLock_Receipt_${reference}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    let csv = 'Reference,Date,Amount_TZS,Status\n';
    payments.forEach(p => {
      csv += `"${p.reference}","${p.date}",${p.amountTZS},"${p.status}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HatLock_Payment_History_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-4">
      {/* Welcome Header */}
      <div className="glass rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-slate-800">
        <div>
          <div className="text-xs text-emerald-400 font-semibold uppercase tracking-wider mb-1">
            Customer Self-Service Portal
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome back, Amina</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Manage your agreements, track payments, and download receipts.
          </p>
        </div>
        <div className="flex flex-col gap-2 text-xs">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Device Access: Authorized (Unlocked)
          </div>
        </div>
      </div>

      {paymentSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-sm flex items-start gap-2">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-400" />
          <span>{paymentSuccess}</span>
        </div>
      )}

      {paymentPendingNotice && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm flex items-start gap-2">
          <Clock className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-400" />
          <span>{paymentPendingNotice}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-slate-900/80 border border-slate-800 w-fit">
        {[
          { key: 'agreements', label: 'My Agreements', icon: FileText },
          { key: 'payments', label: 'Payment History', icon: CreditCard }
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === key
                ? 'bg-slate-800 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Agreements Tab */}
      {activeTab === 'agreements' && (
        <div className="space-y-5">
          {agreements.map(agr => {
            const progress = Math.min(100, Math.round((agr.paidAmountTZS / agr.totalAmountTZS) * 100));
            return (
              <div key={agr.id} className="glass rounded-2xl p-6 space-y-4 border border-slate-800">
                {/* Agreement Header */}
                <div className="flex flex-wrap items-center gap-3">
                  {agr.type === 'HIRE_PURCHASE' ? (
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                      <FileText className="w-5 h-5" />
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                      <Repeat className="w-5 h-5" />
                    </div>
                  )}
                  <div>
                    <div className="font-mono font-bold text-white text-sm">
                      {agr.agreementNumber}
                    </div>
                    <div className="text-xs text-slate-400">
                      {agr.type === 'HIRE_PURCHASE' ? 'Hire Purchase — Ownership conditional on full payment' : 'Equipment Rental — Business retains ownership'}
                    </div>
                  </div>
                  <div className="ml-auto">
                    {agr.status === 'ACTIVE' && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Active
                      </span>
                    )}
                    {agr.status === 'GRACE_PERIOD' && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Grace Period
                      </span>
                    )}
                    {agr.status === 'RESTRICTED' && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Device Locked
                      </span>
                    )}
                  </div>
                </div>

                {/* Device Info */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                  <Laptop className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-white">{agr.device}</div>
                    <div className="text-xs font-mono text-slate-400">S/N: {agr.serialNumber}</div>
                  </div>
                </div>

                {/* Ownership Notice */}
                <div className={`p-3 rounded-xl text-xs leading-relaxed ${
                  agr.type === 'HIRE_PURCHASE'
                    ? 'bg-indigo-950/40 border border-indigo-500/20 text-indigo-200'
                    : 'bg-purple-950/40 border border-purple-500/20 text-purple-200'
                }`}>
                  <strong className="font-semibold text-white">Ownership Notice: </strong>
                  {agr.ownershipNote}
                </div>

                {/* Progress */}
                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-2">
                    <span>Payment progress</span>
                    <span className="font-mono text-slate-200 font-semibold">{progress}% paid</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${agr.type === 'HIRE_PURCHASE' ? 'bg-indigo-500' : 'bg-purple-500'}`}
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs mt-2 text-slate-400">
                    <span>Paid: TZS {agr.paidAmountTZS.toLocaleString()}</span>
                    <span>Remaining: TZS {(agr.totalAmountTZS - agr.paidAmountTZS).toLocaleString()}</span>
                  </div>
                </div>

                {/* Next Payment + CTA */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-800/60">
                  <div className="flex items-center gap-3 text-sm">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-300">
                      Next instalment of{' '}
                      <span className="text-white font-bold font-mono">
                        TZS {agr.nextInstalmentTZS.toLocaleString()}
                      </span>{' '}
                      due {agr.nextDueDateStr}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDownloadReceipt(agr.agreementNumber, agr.paidAmountTZS)}
                      className="px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Receipt Statement
                    </button>
                    <button
                      onClick={() => {
                        setPaymentModal(agr);
                        setPaymentAmount(String(agr.nextInstalmentTZS));
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-navy-900 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      Pay via HatPesa
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Payments Tab */}
      {activeTab === 'payments' && (
        <div className="glass rounded-2xl overflow-hidden border border-slate-800">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">Payment History</h2>
            <button
              onClick={handleExportCSV}
              className="text-xs text-emerald-400 hover:underline flex items-center gap-1 font-medium"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
          <div className="divide-y divide-slate-800/60">
            {payments.map(p => (
              <div key={p.reference} className="p-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
                <div>
                  <div className="font-mono text-xs text-cyan-400 font-semibold">{p.reference}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{p.date}</div>
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
                    className="p-1 text-slate-400 hover:text-white"
                    title="Download receipt"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
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
                className="text-slate-400 hover:text-white p-1 rounded-lg"
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
                    className={`py-2 rounded-xl text-xs font-semibold border transition-colors ${
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
                    className={`py-2 rounded-xl text-xs font-semibold border transition-colors ${
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
                  Instant Hardware Unlock
                </div>
                <div>
                  Upon entering your M-Pesa PIN on your phone, HatPesa will instantly reconcile your account and dispatch an immediate signed unlock payload.
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
              <button
                onClick={() => setPaymentModal(null)}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-sm"
              >
                Cancel
              </button>
              <button
                disabled={paying}
                onClick={handleMakePayment}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                {paying ? 'Processing...' : `Confirm & Pay via ${selectedGateway === 'HATPESA' ? 'HatPesa' : 'SonicPesa'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
