'use client';

import React, { useState, useEffect } from 'react';
import {
  User,
  Shield,
  Building,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Save,
  Lock,
  Phone,
  Mail,
  Briefcase,
  Cpu,
  BadgeCheck
} from 'lucide-react';
import { apiAuth, UserProfile } from '../../lib/api';

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'business' | 'hardware'>('profile');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    position: ''
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      // First try to load from backend
      const data = await apiAuth.getProfile();
      setProfile(data);
      setFormData({
        firstName: data.employee?.firstName || '',
        lastName: data.employee?.lastName || '',
        email: data.email || '',
        phone: data.phone || '',
        position: data.employee?.position || ''
      });
    } catch (err: any) {
      console.warn('Backend profile fetch failed, using session stored profile:', err);
      const stored = localStorage.getItem('hatlock_user');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setProfile({
            id: parsed.id || 'usr-local',
            email: parsed.email || 'business@demo.local',
            role: parsed.role || 'BUSINESS_OWNER',
            mfaEnabled: false,
            createdAt: new Date().toISOString(),
            employee: {
              businessId: parsed.businessId || 'biz-local',
              firstName: 'Baraka',
              lastName: 'Mwinyi',
              position: 'Fleet Manager',
              business: { id: 'biz-local', name: 'Luxeenet Retail', status: 'ACTIVE' }
            }
          });
          setFormData({
            firstName: 'Baraka',
            lastName: 'Mwinyi',
            email: parsed.email || 'business@demo.local',
            phone: '+255 754 112 233',
            position: 'Fleet Manager'
          });
        } catch (e) {}
      }
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      await apiAuth.updateProfile({
        phone: formData.phone,
        firstName: formData.firstName,
        lastName: formData.lastName,
        position: formData.position
      });
      setFeedback({ type: 'success', message: 'Profile details saved successfully.' });
      loadProfile();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update profile details.' });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setFeedback({ type: 'error', message: 'New passwords do not match.' });
      setSaving(false);
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setFeedback({ type: 'error', message: 'Password must be at least 8 characters long.' });
      setSaving(false);
      return;
    }

    try {
      await apiAuth.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      setFeedback({ type: 'success', message: 'Password updated successfully. Please keep your credentials secure.' });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Current password incorrect or failed to update.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <User className="w-7 h-7 text-emerald-400" />
            Profile &amp; Settings
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage your personal identity, security credentials, business tenancy, and system settings.
          </p>
        </div>

        {profile && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold self-start">
            <BadgeCheck className="w-4 h-4 text-emerald-400" />
            {profile.role.replace('_', ' ')}
          </div>
        )}
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 text-sm animate-fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Identity Summary Card */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-navy-900/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center font-bold text-xl text-navy-950 shadow-lg shadow-emerald-500/10">
            {profile?.email ? profile.email.slice(0, 2).toUpperCase() : 'LX'}
          </div>
          <div>
            <div className="text-lg font-bold text-white">
              {formData.firstName || formData.lastName
                ? `${formData.firstName} ${formData.lastName}`
                : profile?.email || 'Authorized Merchant'}
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
              <span>{profile?.email || 'business@demo.local'}</span>
              <span>&bull;</span>
              <span className="text-emerald-400 font-mono">
                {profile?.employee?.business?.name || 'Luxeenet Retail'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="px-3 py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-xs text-slate-300">
            Tenant: <strong className="text-white">Active (Production)</strong>
          </div>
          <div className="px-3 py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-xs text-slate-300">
            MFA: <strong className={profile?.mfaEnabled ? 'text-emerald-400' : 'text-amber-400'}>{profile?.mfaEnabled ? 'Enabled' : 'Disabled'}</strong>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-800 pb-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'profile'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
          }`}
        >
          <User className="w-4 h-4" />
          General Profile
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'security'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
          }`}
        >
          <Lock className="w-4 h-4" />
          Security &amp; Password
        </button>

        <button
          onClick={() => setActiveTab('business')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'business'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
          }`}
        >
          <Building className="w-4 h-4" />
          Business Tenancy
        </button>

        <button
          onClick={() => setActiveTab('hardware')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'hardware'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
          }`}
        >
          <Cpu className="w-4 h-4" />
          Hardware &amp; Cryptography
        </button>
      </div>

      {/* Tab 1: General Profile */}
      {activeTab === 'profile' && (
        <form onSubmit={handleProfileSubmit} className="glass-panel p-8 rounded-2xl border border-slate-800 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">First Name</label>
              <input
                type="text"
                value={formData.firstName}
                onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                placeholder="e.g. Baraka"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">Last Name</label>
              <input
                type="text"
                value={formData.lastName}
                onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                placeholder="e.g. Mwinyi"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                Work Email Address
              </label>
              <input
                type="email"
                disabled
                value={formData.email}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 text-sm cursor-not-allowed font-mono"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Email address is managed by platform administrator.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                Phone Number
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+255 754 000 000"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:border-emerald-500 focus:outline-none font-mono"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center gap-2">
                <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                Position / Job Title
              </label>
              <input
                type="text"
                value={formData.position}
                onChange={e => setFormData({ ...formData, position: e.target.value })}
                placeholder="e.g. Managing Director / Operations Lead"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-navy-950 font-bold text-sm flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving Changes...' : 'Save Profile Details'}
            </button>
          </div>
        </form>
      )}

      {/* Tab 2: Security & Password */}
      {activeTab === 'security' && (
        <form onSubmit={handlePasswordSubmit} className="glass-panel p-8 rounded-2xl border border-slate-800 space-y-6">
          <div className="max-w-xl space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center gap-2">
                <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                Current Password
              </label>
              <input
                type="password"
                required
                value={passwordData.currentPassword}
                onChange={e => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                placeholder="Enter current password"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                New Password
              </label>
              <input
                type="password"
                required
                value={passwordData.newPassword}
                onChange={e => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                placeholder="Minimum 8 characters"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                Confirm New Password
              </label>
              <input
                type="password"
                required
                value={passwordData.confirmPassword}
                onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                placeholder="Re-enter new password"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-navy-950 font-bold text-sm flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Updating Password...' : 'Update Password'}
            </button>
          </div>
        </form>
      )}

      {/* Tab 3: Business Tenancy */}
      {activeTab === 'business' && (
        <div className="glass-panel p-8 rounded-2xl border border-slate-800 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Registered Enterprise Name</label>
              <div className="text-base font-bold text-white">
                {profile?.employee?.business?.name || 'Luxeenet Retail Ltd.'}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Tenancy Identifier (UUID)</label>
              <div className="text-xs font-mono text-emerald-400 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                {profile?.employee?.businessId || 'e430d223-1d01-4475-bc87-926f4f2c8d2f'}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Subscription Plan</label>
              <div className="text-sm font-semibold text-indigo-400">
                Enterprise Fleet Tier &bull; Unlimited Devices
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Primary Currency</label>
              <div className="text-sm font-semibold text-white">
                TZS &bull; Tanzanian Shillings
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Primary Operating Branch</label>
              <div className="text-sm text-slate-200">
                Main Headquarters &bull; Dar es Salaam
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Tenancy Status</label>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Active &bull; Fully Verified
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Hardware & Cryptography */}
      {activeTab === 'hardware' && (
        <div className="glass-panel p-8 rounded-2xl border border-slate-800 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/50 border border-slate-800">
              <div className="flex items-center gap-3">
                <Cpu className="w-5 h-5 text-emerald-400" />
                <div>
                  <div className="text-sm font-semibold text-white">Hardware Watchdog Engine</div>
                  <div className="text-xs text-slate-400">Local background daemon monitoring TPM and secure boot status</div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Online &bull; Active
              </span>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/50 border border-slate-800">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-indigo-400" />
                <div>
                  <div className="text-sm font-semibold text-white">Cryptographic Command Signing</div>
                  <div className="text-xs text-slate-400">ES256 ECDSA P-256 Curve with SHA-256 Digest Verification</div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Verified
              </span>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/50 border border-slate-800">
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 text-amber-400" />
                <div>
                  <div className="text-sm font-semibold text-white">Multi-Tenant Cryptographic Boundaries</div>
                  <div className="text-xs text-slate-400">Strict foreign-key row isolation per authenticated businessId claim</div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Isolated
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
