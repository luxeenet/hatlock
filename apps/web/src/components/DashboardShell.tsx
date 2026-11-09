'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Laptop,
  ShieldCheck,
  CreditCard,
  FileText,
  Users,
  Repeat,
  RotateCcw,
  BarChart3,
  ShieldAlert,
  Bell,
  LogOut,
  UserCheck,
  Building,
  UserPlus,
  Lock,
  User,
  Check,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  Menu,
  Search,
  Maximize2,
  Minimize2
} from 'lucide-react';

interface UserInfo {
  id?: string;
  email?: string;
  role?: string;
  businessName?: string;
}

interface NotificationItem {
  id: string;
  title: string;
  desc: string;
  time: string;
  unread: boolean;
  type: 'danger' | 'success' | 'info' | 'warning';
}

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile sidebar on route transition
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Notification Drawer State
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: '1',
      title: 'Device Restricted',
      desc: 'ThinkPad T14 (SN: PF-99214X) locked due to non-payment policy enforcement.',
      time: '12m ago',
      unread: true,
      type: 'danger'
    },
    {
      id: '2',
      title: 'Payment Reconciled',
      desc: 'TZS 250,000 received via HatPesa mobile money from Baraka Mwinyi.',
      time: '45m ago',
      unread: true,
      type: 'success'
    },
    {
      id: '3',
      title: 'Hardware Watchdog',
      desc: 'All 11 agent heartbeats verified. TPM & Secure Boot integrity intact.',
      time: '2h ago',
      unread: false,
      type: 'info'
    },
    {
      id: '4',
      title: 'Rental Due Soon',
      desc: 'Agreement RT-2024-000001 instalment due in 2 business days.',
      time: '4h ago',
      unread: true,
      type: 'warning'
    }
  ]);

  const notifRef = useRef<HTMLDivElement>(null);

  // Global Search State (Metis Style)
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut listener: Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsSearchOpen(true);
      } else if (e.key === 'Escape') {
        setIsSearchOpen(false);
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Click outside search container to close results
  useEffect(() => {
    function handleClickOutsideSearch(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutsideSearch);
    return () => document.removeEventListener('mousedown', handleClickOutsideSearch);
  }, []);

  useEffect(() => {
    if (pathname === '/login') {
      setAuthChecked(true);
      return;
    }

    const token = localStorage.getItem('hatlock_token');
    const storedUser = localStorage.getItem('hatlock_user');

    if (!token || !storedUser) {
      setUser(null);
      router.replace('/login');
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);

      // Super admin page protection
      if (pathname === '/super-admin' && parsedUser.role !== 'SUPER_ADMIN') {
        router.replace('/');
        return;
      }
    } catch {
      localStorage.removeItem('hatlock_token');
      localStorage.removeItem('hatlock_user');
      setUser(null);
      router.replace('/login');
      return;
    }

    setAuthChecked(true);
  }, [pathname, router]);

  // Click outside to close notifications
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fullscreen State and Toggle Handler
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen();
        } else if ((document.documentElement as any).webkitRequestFullscreen) {
          (document.documentElement as any).webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        }
      }
    } catch (err) {
      console.warn('Fullscreen request failed:', err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('hatlock_token');
    localStorage.removeItem('hatlock_refresh_token');
    localStorage.removeItem('hatlock_user');
    setUser(null);
    router.push('/login');
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const markSingleAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, unread: false } : n));
  };

  const unreadCount = notifications.filter(n => n.unread).length;

  // If on /login page, don't show the dashboard shell (sidebar & header)
  if (pathname === '/login') {
    return <main className="min-h-screen bg-navy-950 text-slate-100">{children}</main>;
  }

  // Prevent flash of protected dashboard content before authentication is verified
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center text-slate-400">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs tracking-wide uppercase font-semibold text-slate-500">Verifying session security...</p>
      </div>
    );
  }

  const primaryNavLinks = [
    { href: '/', label: 'Overview', icon: BarChart3, color: 'text-emerald-400' },
    { href: '/devices', label: 'Device Inventory', icon: Laptop, color: 'text-cyan-400' },
    { href: '/customers', label: 'Customers', icon: Users, color: 'text-amber-400' },
    { href: '/financing', label: 'Hire Purchase', icon: FileText, color: 'text-indigo-400' },
    { href: '/rentals', label: 'Rentals', icon: Repeat, color: 'text-purple-400' },
    { href: '/payments', label: 'Payments (HatPesa)', icon: CreditCard, color: 'text-emerald-400' },
    { href: '/returns', label: 'Returns & Inspection', icon: RotateCcw, color: 'text-rose-400' },
  ];

  const organizationNavLinks = [
    { href: '/employees', label: 'Team & Employees', icon: UserPlus, color: 'text-blue-400' },
    { href: '/branches', label: 'Branch Locations', icon: Building, color: 'text-teal-400' },
    { href: '/audit-logs', label: 'Security & Audit Logs', icon: Lock, color: 'text-orange-400' },
    { href: '/profile', label: 'Profile & Settings', icon: User, color: 'text-emerald-400' },
  ];

  const searchableRoutes = [
    { href: '/', title: 'Overview & Analytics', category: 'Analytics', icon: BarChart3, keywords: 'dashboard revenue metrics stats kpis' },
    { href: '/devices', title: 'Device Inventory & Lock State', category: 'Devices', icon: Laptop, keywords: 'hardware laptops imei lock serial' },
    { href: '/customers', title: 'Customer Records & KYC', category: 'CRM', icon: Users, keywords: 'clients identity national id verifications' },
    { href: '/financing', title: 'Hire Purchase Agreements', category: 'Financing', icon: FileText, keywords: 'contracts loans installments instalments' },
    { href: '/rentals', title: 'Hardware Rentals & Leases', category: 'Financing', icon: Repeat, keywords: 'short term leases security deposits' },
    { href: '/payments', title: 'Payments & HatPesa Ledger', category: 'Billing', icon: CreditCard, keywords: 'transactions mobile money collections' },
    { href: '/returns', title: 'Returns & Inspection Workflow', category: 'Operations', icon: RotateCcw, keywords: 'reclaimed deposits refund grading' },
    { href: '/employees', title: 'Team & Employee Directory', category: 'Organization', icon: UserPlus, keywords: 'staff managers roles agents' },
    { href: '/branches', title: 'Branch Hubs & Locations', category: 'Organization', icon: Building, keywords: 'offices stores locations' },
    { href: '/audit-logs', title: 'Security & Audit Trail', category: 'Security', icon: Lock, keywords: 'hashes cryptographic compliance logs' },
    { href: '/profile', title: 'Account Settings & Profile', category: 'Account', icon: User, keywords: 'security password email business' },
    ...(user?.role === 'SUPER_ADMIN' ? [{ href: '/super-admin', title: 'Super-Admin Governance', category: 'Governance', icon: ShieldAlert, keywords: 'tenants platform system configuration' }] : [])
  ];

  const filteredRoutes = searchableRoutes.filter(item => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return item.title.toLowerCase().includes(q) || item.category.toLowerCase().includes(q) || item.keywords.includes(q);
  });

  return (
    <div className="min-h-screen bg-navy-950 text-slate-100 flex">
      {/* Mobile Drawer Backdrop */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-navy-950/80 backdrop-blur-sm z-40 lg:hidden animate-fade-in"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar (Responsive drawer on mobile, fixed left on lg+) */}
      <aside
        className={`w-64 border-r border-slate-800/90 bg-[#0f172a] flex flex-col fixed inset-y-0 z-50 transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 sm:p-5 border-b border-slate-800/90 flex items-center justify-between bg-[#0b0f19]/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
                HatLock
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  PRO
                </span>
              </div>
              <div className="text-[11px] font-medium text-slate-400">by Luxeenet</div>
            </div>
          </div>
          {/* Close button for mobile */}
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 text-sm overflow-y-auto">
          <div className="px-3 pb-2 text-[10.5px] font-bold text-slate-400 uppercase tracking-widest">
            Operations
          </div>
          {primaryNavLinks.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 py-2 px-3 transition-all ${
                  isActive
                    ? 'bg-slate-800/70 text-white font-medium border-l-2 border-emerald-400 rounded-r-lg shadow-sm'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40 rounded-lg'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-400' : item.color}`} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}

          <div className="pt-3 mt-3 border-t border-slate-800/80">
            <div className="px-3 pb-2 text-[10.5px] font-bold text-slate-400 uppercase tracking-widest">
              Organization
            </div>
            {organizationNavLinks.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 py-2 px-3 transition-all ${
                    isActive
                      ? 'bg-slate-800/70 text-white font-medium border-l-2 border-emerald-400 rounded-r-lg shadow-sm'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40 rounded-lg'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-400' : item.color}`} />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Only display Super-Admin for SUPER_ADMIN role */}
          {user?.role === 'SUPER_ADMIN' && (
            <div className="pt-3 mt-3 border-t border-slate-800/80">
              <div className="px-3 pb-2 text-[10.5px] font-bold text-slate-400 uppercase tracking-widest">
                Governance
              </div>
              <Link
                href="/super-admin"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 py-2 px-3 transition-all ${
                  pathname === '/super-admin'
                    ? 'bg-amber-500/10 text-amber-300 font-medium border-l-2 border-amber-400 rounded-r-lg shadow-sm'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40 rounded-lg'
                }`}
              >
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="truncate">Super-Admin</span>
              </Link>
            </div>
          )}
        </nav>

        {/* Bottom user badge with direct link to profile */}
        <div className="p-3 border-t border-slate-800/90 bg-[#0b0f19]/70">
          <div className="flex items-center justify-between">
            <Link
              href="/profile"
              onClick={() => setIsMobileMenuOpen(false)}
              title="Manage Profile & Settings"
              className="flex items-center gap-2.5 truncate hover:bg-slate-800/60 p-2 rounded-xl transition-all flex-1 mr-1"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center font-bold text-xs text-navy-950 shrink-0 shadow-sm">
                {user?.email ? user.email.slice(0, 2).toUpperCase() : 'LX'}
              </div>
              <div className="truncate text-left">
                <div className="text-xs font-semibold text-white truncate">
                  {user?.email || 'Luxeenet Retail'}
                </div>
                <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                  <span>{user?.role || 'BUSINESS_OWNER'}</span>
                  <span className="text-[9px] text-slate-500">&bull; Settings</span>
                </div>
              </div>
            </Link>

            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen min-w-0">
        {/* Top Bar */}
        <header className="h-16 border-b border-slate-800/80 bg-[#0b0f19]/80 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6 lg:px-8 gap-3">
          <div className="flex items-center gap-3 shrink-0">
            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 border border-slate-800 transition-colors"
              aria-label="Toggle Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="text-xs font-medium text-slate-400 hidden xl:flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-600" />
              <span>Location:</span>
              <span className="text-slate-200 font-medium">Main Headquarters</span>
            </div>
            {user?.email && (
              <Link
                href="/profile"
                className="hidden 2xl:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800/80 text-slate-300 border border-slate-700/60 hover:border-emerald-500/40 hover:text-emerald-400 transition-colors truncate max-w-[200px]"
              >
                <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">{user.email}</span>
              </Link>
            )}
          </div>

          {/* Metis-inspired Global Search Bar */}
          <div className="relative flex-1 max-w-md mx-2" ref={searchContainerRef}>
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchOpen(true);
                }}
                onFocus={() => setIsSearchOpen(true)}
                placeholder="Search... (Ctrl+K)"
                className="w-full pl-9 pr-16 py-1.5 text-xs bg-slate-900/90 text-slate-100 placeholder-slate-400 border border-slate-700/80 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500/60 focus:border-emerald-500/80 transition-all shadow-inner"
                aria-label="Search dashboard"
              />
              <div className="absolute right-2 flex items-center gap-1 pointer-events-none">
                <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-medium text-slate-400 bg-slate-800/80 border border-slate-700 rounded shadow-xs">
                  Ctrl+K
                </kbd>
              </div>
            </div>

            {/* Search Results Dropdown */}
            {isSearchOpen && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#121927] border border-slate-700 shadow-2xl rounded-xl z-50 overflow-hidden divide-y divide-slate-800/80 animate-fade-in">
                <div className="px-3 py-2 text-[10.5px] font-bold text-slate-400 uppercase tracking-wider bg-[#0b0f19]/80 flex items-center justify-between">
                  <span>{searchQuery ? `Matching Results (${filteredRoutes.length})` : 'Quick Navigation'}</span>
                  <span className="text-[10px] lowercase text-slate-500 font-normal">esc to close</span>
                </div>
                <div className="max-h-72 overflow-y-auto py-1">
                  {filteredRoutes.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No matching destinations found for &quot;{searchQuery}&quot;.
                    </div>
                  ) : (
                    filteredRoutes.map((route) => {
                      const RouteIcon = route.icon;
                      return (
                        <button
                          key={route.href}
                          type="button"
                          onClick={() => {
                            router.push(route.href);
                            setIsSearchOpen(false);
                            setSearchQuery('');
                          }}
                          className="w-full px-3 py-2 text-left flex items-center justify-between hover:bg-slate-800/60 transition-colors group"
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <div className="w-7 h-7 rounded-md bg-slate-800 text-emerald-400 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/20 transition-colors">
                              <RouteIcon className="w-3.5 h-3.5" />
                            </div>
                            <div className="truncate">
                              <div className="text-xs font-medium text-slate-200 group-hover:text-white truncate">
                                {route.title}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate">
                                {route.href}
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] font-medium text-slate-400 px-1.5 py-0.5 rounded bg-slate-800/60 border border-slate-700/60 shrink-0 ml-2">
                            {route.category}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Hardware Watchdog Active
            </div>

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent hover:border-slate-700/60 transition-colors"
              title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
              aria-label="Toggle Full Screen"
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>

            {/* Notification Bell with Dropdown */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className={`p-2 rounded-xl transition-all relative ${
                  isNotificationsOpen
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
                title="System Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-navy-950 font-bold text-[10px] flex items-center justify-center animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Center Dropdown */}
              {isNotificationsOpen && (
                <div className="absolute right-0 mt-3 w-84 sm:w-96 rounded-2xl bg-navy-900 border border-slate-700 shadow-2xl z-50 overflow-hidden animate-fade-in">
                  <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-navy-950/80">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          {unreadCount} unread
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllAsRead}
                          className="text-xs text-slate-400 hover:text-emerald-400 transition-colors flex items-center gap-1"
                          title="Mark all as read"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Mark all
                        </button>
                      )}
                      {notifications.length > 0 && (
                        <button
                          onClick={clearAllNotifications}
                          className="text-xs text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-1 ml-2"
                          title="Clear all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 text-xs">
                        No notifications to display.
                      </div>
                    ) : (
                      notifications.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => markSingleAsRead(item.id)}
                          className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer hover:bg-slate-800/40 ${
                            item.unread ? 'bg-emerald-500/5' : ''
                          }`}
                        >
                          <div className="mt-0.5 shrink-0">
                            {item.type === 'danger' && (
                              <div className="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center">
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </div>
                            )}
                            {item.type === 'success' && (
                              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </div>
                            )}
                            {item.type === 'warning' && (
                              <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </div>
                            )}
                            {item.type === 'info' && (
                              <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                                <Info className="w-3.5 h-3.5" />
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-white truncate">
                                {item.title}
                              </span>
                              <span className="text-[10px] text-slate-500 whitespace-nowrap">
                                {item.time}
                              </span>
                            </div>
                            <p className="text-xs text-slate-300 mt-0.5 line-clamp-2 leading-relaxed">
                              {item.desc}
                            </p>
                          </div>

                          {item.unread && (
                            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 mt-1.5" />
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  <div className="p-2.5 text-center bg-navy-950/80 border-t border-slate-800">
                    <Link
                      href="/audit-logs"
                      onClick={() => setIsNotificationsOpen(false)}
                      className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      View all system audit logs &rarr;
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto min-w-0 max-w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
