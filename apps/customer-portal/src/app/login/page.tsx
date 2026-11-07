'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Smartphone,
  ShieldCheck,
  ArrowRight,
  Lock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';

export default function CustomerLoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('+255 712 345 678');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'IDENTIFIER' | 'OTP'>('IDENTIFIER');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier) {
      setError('Please provide your phone number or agreement number');
      return;
    }
    setError(null);
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep('OTP');
    }, 600);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) {
      setError('Please enter the 4-digit verification code sent to your phone');
      return;
    }
    setError(null);
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      localStorage.setItem('hatlock_customer_phone', identifier);
      router.push('/');
    }, 600);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden text-slate-100">
      <div className="absolute top-1/4 -left-32 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 mb-4 shadow-lg shadow-emerald-500/10">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            HatLock Customer Portal
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Access your active laptop agreements, pay instalments, and check unlock status.
          </p>
        </div>

        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white">
              {step === 'IDENTIFIER' ? 'Borrower Sign In' : 'Enter Verification Code'}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {step === 'IDENTIFIER'
                ? 'Enter the mobile phone number registered on your device lease agreement.'
                : `We sent a one-time passcode (OTP) to ${identifier}`}
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {step === 'IDENTIFIER' ? (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Mobile Phone Number
                </label>
                <div className="relative">
                  <Smartphone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="+255 7XX XXX XXX"
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-emerald-500/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-semibold py-2.5 px-4 rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 group"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Continue with Phone</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  4-Digit Passcode (Demo: Any 4 digits)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    type="text"
                    maxLength={6}
                    autoFocus
                    required
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="1234"
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-emerald-500/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 tracking-widest text-center font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-semibold py-2.5 px-4 rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Verify & View My Agreements</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setStep('IDENTIFIER')}
                className="w-full text-xs text-slate-400 hover:text-white text-center pt-2 transition-colors"
              >
                Use a different phone number
              </button>
            </form>
          )}

          <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
            <Link
              href="/"
              className="text-xs text-emerald-400 hover:text-emerald-300 font-medium inline-flex items-center gap-1"
            >
              Directly view sample active agreement &rarr;
            </Link>
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-slate-500">
          HatPesa Instant Mobile Money Reconciliation &copy; {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}
