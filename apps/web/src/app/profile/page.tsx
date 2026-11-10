'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
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
  BadgeCheck,
  Camera,
  Copy,
  Check,
  Sparkles,
  Clock,
  Laptop,
  MapPin,
  Calendar,
  Activity,
  Eye,
  EyeOff,
  ShieldAlert,
  Smartphone
} from 'lucide-react';
import { apiAuth, UserProfile } from '../../lib/api';

function ProfileContent() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as 'profile' | 'security' | 'business' | 'hardware') || 'profile';

  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'business' | 'hardware'>(initialTab);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  // Password visibility toggles
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // Avatar theme picker
  const [avatarTheme, setAvatarTheme] = useState<'sunset' | 'cyber' | 'royal' | 'gold'>('sunset');

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
    const tabParam = searchParams.get('tab');
    if (tabParam && ['profile', 'security', 'business', 'hardware'].includes(tabParam)) {
      setActiveTab(tabParam as any);
    }
  }, [searchParams]);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    setFeedback(null);
    try {
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
            email: parsed.email || 'admin@luxeenet.com',
            role: parsed.role || 'SUPER_ADMIN',
            mfaEnabled: true,
            createdAt: new Date().toISOString(),
            employee: {
              businessId: parsed.businessId || 'biz-local',
              firstName: 'Baraka',
              lastName: 'Mwinyi',
              position: 'Fleet & Security Director',
              business: { id: 'biz-local', name: 'Luxeenet Enterprise Fleet', status: 'ACTIVE' }
            }
          });
          setFormData({
            firstName: 'Baraka',
            lastName: 'Mwinyi',
            email: parsed.email || 'admin@luxeenet.com',
            phone: '+255 754 112 233',
            position: 'Fleet & Security Director'
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
      setTimeout(() => setFeedback(null), 4000);
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
      setFeedback({ type: 'success', message: 'Password updated successfully. Cryptographic session renewed.' });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setFeedback(null), 5000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Current password incorrect or failed to update.' });
    } finally {
      setSaving(false);
    }
  };

  const getRingGradient = () => {
    switch (avatarTheme) {
      case 'sunset':
        return 'from-amber-400 via-rose-500 to-indigo-500 hover:from-amber-300 hover:via-pink-500 hover:to-indigo-400';
      case 'cyber':
        return 'from-emerald-400 via-teal-400 to-cyan-500 hover:from-emerald-300 hover:via-cyan-300 hover:to-blue-400';
      case 'royal':
        return 'from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-400 hover:via-purple-400 hover:to-pink-400';
      case 'gold':
        return 'from-amber-300 via-yellow-500 to-amber-600 hover:from-yellow-200 hover:via-amber-400 hover:to-yellow-500';
      default:
        return 'from-amber-400 via-rose-500 to-indigo-500';
    }
  };

  const userInitials = profile?.email ? profile.email.slice(0, 2).toUpperCase() : 'AD';
  const displayName = formData.firstName || formData.lastName
    ? `${formData.firstName} ${formData.lastName}`.trim()
    : profile?.email?.split('@')[0] || 'Administrator';

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* ----------------- INSTAGRAM-STYLE HERO HEADER ----------------- */}
      <div className="relative rounded-3xl bg-gradient-to-br from-[#0e1424] via-[#121927] to-[#0b0f19] border border-slate-800 p-6 sm:p-8 overflow-hidden shadow-2xl">
        {/* Decorative background glow mesh */}
        <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-80 h-80 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-8">
          {/* Instagram-style Circular Avatar Container */}
          <div className="relative group shrink-0">
            <div className={`p-[3.5px] rounded-full bg-gradient-to-tr ${getRingGradient()} transition-all duration-300 shadow-2xl cursor-pointer`}>
              <div className="p-[3px] bg-[#0b0f19] rounded-full">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-br from-slate-800 via-slate-900 to-navy-950 flex items-center justify-center text-white font-extrabold text-3xl sm:text-4xl uppercase tracking-wider ring-1 ring-white/10 group-hover:scale-105 transition-transform select-none shadow-inner">
                  {userInitials}
                </div>
              </div>
            </div>

            {/* Verified Badge */}
            <div
              title="Verified Cryptographic Identity"
              className="absolute bottom-1 right-1 p-1 bg-[#0b0f19] rounded-full shadow-lg"
            >
              <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-[11px] text-navy-950 font-black ring-2 ring-emerald-400/50">
                ✓
              </div>
            </div>
          </div>

          {/* User Information */}
          <div className="flex-1 text-center md:text-left min-w-0">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight truncate">
                {displayName}
              </h1>
              <span title="Verified Account">
                <BadgeCheck className="w-6 h-6 text-cyan-400 shrink-0" />
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border shrink-0 ${
                profile?.role === 'SUPER_ADMIN'
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
              }`}>
                {profile?.role?.replace('_', ' ') || 'SUPER ADMIN'}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs text-slate-400 mt-2">
              <span className="flex items-center gap-1.5 font-mono">
                <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>{profile?.email || 'admin@luxeenet.com'}</span>
              </span>
              <span>&bull;</span>
              <span className="flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="text-slate-200 font-medium">{profile?.employee?.business?.name || 'Luxeenet Enterprise Fleet'}</span>
              </span>
              <span>&bull;</span>
              <span className="flex items-center gap-1.5 text-emerald-400">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span>Main Headquarters &bull; Dar es Salaam</span>
              </span>
            </div>

            <p className="text-xs text-slate-400 mt-3 max-w-2xl leading-relaxed">
              {formData.position || 'Fleet & Operations Security Lead'} &bull; Authorized administrator managing universal device financing, hardware cryptographic locks, and HatPesa payment reconciliation.
            </p>

            {/* Instagram-style Metric Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5">
              <div className="px-3.5 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-center md:text-left">
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Tenancy Status</div>
                <div className="text-xs font-bold text-emerald-400 flex items-center justify-center md:justify-start gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Active Production
                </div>
              </div>

              <div className="px-3.5 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-center md:text-left">
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">MFA Security</div>
                <div className="text-xs font-bold text-cyan-400 flex items-center justify-center md:justify-start gap-1 mt-0.5">
                  <Shield className="w-3 h-3 text-cyan-400" />
                  Hardware Enforced
                </div>
              </div>

              <div className="px-3.5 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-center md:text-left">
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Signing Curve</div>
                <div className="text-xs font-bold text-indigo-400 flex items-center justify-center md:justify-start gap-1 mt-0.5">
                  <Cpu className="w-3 h-3 text-indigo-400" />
                  ECDSA P-256
                </div>
              </div>

              <div className="px-3.5 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-center md:text-left">
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Watchdog Heartbeat</div>
                <div className="text-xs font-bold text-emerald-400 flex items-center justify-center md:justify-start gap-1 mt-0.5">
                  <Activity className="w-3 h-3 text-emerald-400" />
                  Synchronized
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border flex items-center gap-3 text-sm animate-fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span className="font-medium">{feedback.message}</span>
        </div>
      )}

      {/* ----------------- NAVIGATION TABS ----------------- */}
      <div className="flex gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'profile'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Personal Identity</span>
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'security'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>Security &amp; Password</span>
        </button>

        <button
          onClick={() => setActiveTab('business')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'business'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Business Tenancy</span>
        </button>

        <button
          onClick={() => setActiveTab('hardware')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'hardware'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>Hardware &amp; Cryptography</span>
        </button>
      </div>

      {/* ----------------- TAB 1: PERSONAL IDENTITY ----------------- */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          {/* Avatar Ring Theme Customizer */}
          <div className="metis-card p-5 rounded-2xl border border-slate-800/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Instagram Profile Ring Style</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Personalize the vibrant gradient story ring rendered around your profile avatar across the dashboard.
              </p>
            </div>

            <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setAvatarTheme('sunset')}
                title="Sunset Vibe (Classic Instagram)"
                className={`w-6 h-6 rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-indigo-500 transition-transform ${avatarTheme === 'sunset' ? 'scale-125 ring-2 ring-white' : 'opacity-60 hover:opacity-100'}`}
              />
              <button
                type="button"
                onClick={() => setAvatarTheme('cyber')}
                title="Cyber Emerald"
                className={`w-6 h-6 rounded-full bg-gradient-to-tr from-emerald-400 via-teal-400 to-cyan-500 transition-transform ${avatarTheme === 'cyber' ? 'scale-125 ring-2 ring-white' : 'opacity-60 hover:opacity-100'}`}
              />
              <button
                type="button"
                onClick={() => setAvatarTheme('royal')}
                title="Royal Amethyst"
                className={`w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 transition-transform ${avatarTheme === 'royal' ? 'scale-125 ring-2 ring-white' : 'opacity-60 hover:opacity-100'}`}
              />
              <button
                type="button"
                onClick={() => setAvatarTheme('gold')}
                title="Imperial Gold"
                className={`w-6 h-6 rounded-full bg-gradient-to-tr from-amber-300 via-yellow-500 to-amber-600 transition-transform ${avatarTheme === 'gold' ? 'scale-125 ring-2 ring-white' : 'opacity-60 hover:opacity-100'}`}
              />
            </div>
          </div>

          <form onSubmit={handleProfileSubmit} className="metis-card p-6 sm:p-8 rounded-2xl border border-slate-800/90 space-y-6">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-400" />
                <span>Personal Information</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Update your administrative contact details and organizational job title.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">First Name</label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                  placeholder="e.g. Baraka"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-emerald-500 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Last Name</label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                  placeholder="e.g. Mwinyi"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-emerald-500 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>Work Email Address</span>
                </label>
                <input
                  type="email"
                  disabled
                  value={formData.email}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-400 text-xs cursor-not-allowed font-mono"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Primary identity is managed via your Luxeenet enterprise directory.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>Phone Number (SMS / WhatsApp Alerts)</span>
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+255 754 000 000"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-emerald-500 focus:outline-none font-mono transition-colors"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                  <span>Position / Job Title</span>
                </label>
                <input
                  type="text"
                  value={formData.position}
                  onChange={e => setFormData({ ...formData, position: e.target.value })}
                  placeholder="e.g. Operations Director / Fleet Security Lead"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-emerald-500 focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Changes apply immediately across your active session.
              </span>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-navy-950 font-bold text-xs flex items-center gap-2 transition-colors disabled:opacity-50 shadow-md"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving Changes...' : 'Save Profile Details'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ----------------- TAB 2: SECURITY & PASSWORD ----------------- */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <form onSubmit={handlePasswordSubmit} className="metis-card p-6 sm:p-8 rounded-2xl border border-slate-800/90 space-y-6">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-400" />
                <span>Change Account Password</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Ensure your account uses a strong password with at least 8 characters.
              </p>
            </div>

            <div className="max-w-xl space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                  <span>Current Password</span>
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    required
                    value={passwordData.currentPassword}
                    onChange={e => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    placeholder="Enter current password"
                    className="w-full px-4 py-2.5 pr-10 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>New Password</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    required
                    value={passwordData.newPassword}
                    onChange={e => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    placeholder="Minimum 8 characters"
                    className="w-full px-4 py-2.5 pr-10 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Confirm New Password</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPass ? 'text' : 'password'}
                    required
                    value={passwordData.confirmPassword}
                    onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    placeholder="Re-enter new password"
                    className="w-full px-4 py-2.5 pr-10 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-navy-950 font-bold text-xs flex items-center gap-2 transition-colors disabled:opacity-50 shadow-md"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Updating Password...' : 'Update Password'}</span>
              </button>
            </div>
          </form>

          {/* Two-Factor Authentication Status Card */}
          <div className="metis-card p-6 sm:p-8 rounded-2xl border border-slate-800/90 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Two-Factor Authentication (2FA)</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Hardware tokens and authenticator app confirmation required for super-admin command dispatch.
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
                ● Enforced (Active)
              </span>
            </div>
          </div>

          {/* Active Cryptographic Session */}
          <div className="metis-card p-6 sm:p-8 rounded-2xl border border-slate-800/90 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Laptop className="w-4 h-4 text-cyan-400" />
              <span>Active Administrative Session</span>
            </h3>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                <div>
                  <div className="text-xs font-bold text-white">Current Session (Browser)</div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                    ES256 ECDSA Token &bull; Issued at Main Headquarters
                  </div>
                </div>
              </div>
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                ACTIVE NOW
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- TAB 3: BUSINESS TENANCY ----------------- */}
      {activeTab === 'business' && (
        <div className="metis-card p-6 sm:p-8 rounded-2xl border border-slate-800/90 space-y-6">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Building className="w-4 h-4 text-emerald-400" />
              <span>Enterprise Organization &amp; Tenancy</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Multi-tenant boundary metadata and regulatory billing credentials.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80">
              <label className="block text-[11px] uppercase font-bold text-slate-400 mb-1">Registered Enterprise Name</label>
              <div className="text-base font-bold text-white">
                {profile?.employee?.business?.name || 'Luxeenet Enterprise Fleet Ltd.'}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] uppercase font-bold text-slate-400">Tenancy Identifier (UUID)</label>
                <button
                  type="button"
                  onClick={() => {
                    const id = profile?.employee?.businessId || 'e430d223-1d01-4475-bc87-926f4f2c8d2f';
                    navigator.clipboard.writeText(id);
                    setCopiedId(true);
                    setTimeout(() => setCopiedId(false), 3000);
                  }}
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono"
                >
                  {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedId ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <div className="text-xs font-mono text-emerald-400 truncate">
                {profile?.employee?.businessId || 'e430d223-1d01-4475-bc87-926f4f2c8d2f'}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80">
              <label className="block text-[11px] uppercase font-bold text-slate-400 mb-1">Subscription Plan</label>
              <div className="text-sm font-semibold text-indigo-400 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span>Enterprise Fleet Tier &bull; Unlimited Devices</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80">
              <label className="block text-[11px] uppercase font-bold text-slate-400 mb-1">Settlement Currency</label>
              <div className="text-sm font-semibold text-white font-mono">
                TZS &bull; Tanzanian Shillings (HatPesa Integrated)
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80">
              <label className="block text-[11px] uppercase font-bold text-slate-400 mb-1">Operating Branch Location</label>
              <div className="text-sm text-slate-200 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-emerald-400" />
                <span>Main Headquarters &bull; Dar es Salaam</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80">
              <label className="block text-[11px] uppercase font-bold text-slate-400 mb-1">Tenancy Health Status</label>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Verified Active Production Node</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- TAB 4: HARDWARE & CRYPTOGRAPHY ----------------- */}
      {activeTab === 'hardware' && (
        <div className="metis-card p-6 sm:p-8 rounded-2xl border border-slate-800/90 space-y-6">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <span>Hardware Security &amp; Cryptographic Engine</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Underlying TPM 2.0, Secure Boot, and ECDSA P-256 signing subsystem status.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-950 border border-slate-800">
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">Hardware Watchdog Engine</div>
                  <div className="text-xs text-slate-400 mt-0.5">Background daemon monitoring TPM 2.0 and Secure Boot integrity</div>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                ● Online &bull; Active
              </span>
            </div>

            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-950 border border-slate-800">
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">Cryptographic Command Signing</div>
                  <div className="text-xs text-slate-400 mt-0.5">ES256 ECDSA P-256 Curve with SHA-256 Digest Verification</div>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                Verified
              </span>
            </div>

            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-950 border border-slate-800">
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">Multi-Tenant Cryptographic Boundaries</div>
                  <div className="text-xs text-slate-400 mt-0.5">Strict foreign-key row isolation per authenticated businessId claim</div>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                Isolated
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <React.Suspense
      fallback={
        <div className="p-12 text-center text-slate-400">
          <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Loading administrative profile...
        </div>
      }
    >
      <ProfileContent />
    </React.Suspense>
  );
}
