'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  MapPin,
  Laptop,
  CheckCircle2,
  AlertCircle,
  X,
  Trash2,
  RefreshCw,
  FileText,
  Repeat,
  CreditCard,
  Edit2,
  ChevronLeft,
  ChevronRight,
  Eye
} from 'lucide-react';
import { apiCustomers, Customer } from '../../lib/api';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Add Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    idNumber: '',
    address: '',
    city: 'Dar es Salaam',
    notes: ''
  });

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editFormData, setEditFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    idNumber: '',
    address: '',
    city: '',
    notes: ''
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Detailed Customer View Modal (with agreements & payments)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerDetail, setCustomerDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const loadCustomers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiCustomers.list();
      setCustomers(data.customers || []);
      setCurrentPage(1);
    } catch (err: any) {
      console.error('Failed to load customers:', err);
      setError(err.message || 'Failed to load customers from backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone || !formData.idNumber) {
        throw new Error('Please fill in all required KYC fields.');
      }

      const res = await apiCustomers.create(formData);
      setSuccess(`Customer ${res.customer.firstName} ${res.customer.lastName} successfully registered in PostgreSQL.`);
      setIsAddModalOpen(false);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        idNumber: '',
        address: '',
        city: 'Dar es Salaam',
        notes: ''
      });
      await loadCustomers();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to register customer.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (customer: Customer, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingCustomer(customer);
    setEditFormData({
      firstName: customer.firstName || '',
      lastName: customer.lastName || '',
      email: customer.email || '',
      phone: customer.phone || '',
      idNumber: customer.idNumber || '',
      address: customer.address || '',
      city: customer.city || '',
      notes: customer.notes || ''
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    setSavingEdit(true);
    setError(null);

    try {
      await apiCustomers.update(editingCustomer.id, editFormData);
      setSuccess(`Customer profile for ${editFormData.firstName} ${editFormData.lastName} updated.`);
      setIsEditModalOpen(false);
      setEditingCustomer(null);
      await loadCustomers();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to update customer profile.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleOpenDetail = async (customerId: string) => {
    setSelectedCustomerId(customerId);
    setLoadingDetail(true);
    try {
      const data = await apiCustomers.get(customerId);
      setCustomerDetail(data.customer);
    } catch (err: any) {
      setError(err.message || 'Failed to load detailed customer record.');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDeleteCustomer = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to deactivate customer ${name}?`)) return;

    try {
      await apiCustomers.delete(id);
      setSuccess(`Customer ${name} deactivated successfully.`);
      setSelectedCustomerId(null);
      setCustomerDetail(null);
      await loadCustomers();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to deactivate customer.');
    }
  };

  const filtered = customers.filter(c => {
    const term = searchTerm.toLowerCase();
    const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
    return (
      fullName.includes(term) ||
      (c.idNumber && c.idNumber.toLowerCase().includes(term)) ||
      (c.phone && c.phone.includes(term)) ||
      (c.email && c.email.toLowerCase().includes(term))
    );
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-amber-400" />
            Customer Portfolio & KYC Directory
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
            Verified identity records, assigned laptop fleet, and financial repayment profiles.
          </p>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3">
          <button
            onClick={loadCustomers}
            title="Refresh from PostgreSQL"
            className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-750 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-3.5 sm:px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Add Customer
          </button>
        </div>
      </div>

      {/* Notifications */}
      {success && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Search Bar & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 metis-card p-4 rounded-xl border border-slate-800/80">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by name, email, phone, or national ID..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900/90 border border-slate-700/80 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-colors"
          />
        </div>
        <div className="text-xs text-slate-400 flex items-center gap-4">
          <span>Total Customers: <strong className="text-white">{customers.length}</strong></span>
          <span>Showing: <strong className="text-amber-400 font-mono">{filtered.length}</strong></span>
        </div>
      </div>

      {/* Customers Grid */}
      {loading ? (
        <div className="metis-card p-12 text-center rounded-xl border border-slate-800 text-slate-400">
          <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <span>Connecting to PostgreSQL and fetching customer records...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="metis-card p-12 text-center rounded-xl border border-slate-800 text-slate-400">
          <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <div className="text-base font-semibold text-white">No customers found</div>
          <p className="text-xs text-slate-400 mt-1">
            {searchTerm ? 'No results matched your search criteria.' : 'No customers registered yet. Click "Add Customer" to register your first borrower.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {paginated.map(customer => {
            const agreementCount = (customer._count?.financingAgreements || 0) + (customer._count?.rentalAgreements || 0);

            return (
              <div
                key={customer.id}
                onClick={() => handleOpenDetail(customer.id)}
                className="metis-card p-5 sm:p-6 rounded-xl border border-slate-800/80 hover:border-amber-500/40 transition-all hover:-translate-y-0.5 cursor-pointer flex flex-col justify-between group"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-white text-base group-hover:text-amber-300 transition-colors">
                        {customer.firstName} {customer.lastName}
                      </div>
                      <div className="text-xs font-mono text-amber-400/90 mt-0.5">
                        ID: {customer.idNumber || 'KYC Pending'}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={e => handleOpenEdit(customer, e)}
                        title="Edit Customer"
                        className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Verified
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-300">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-mono">{customer.phone}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{customer.email}</span>
                    </div>
                    {customer.address && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{customer.address}, {customer.city}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Laptop className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>{agreementCount} Active Agreement(s)</span>
                  </div>
                  <span className="text-amber-400 font-medium group-hover:underline flex items-center gap-1">
                    Profile &rarr;
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {!loading && filtered.length > 0 && (
        <div className="glass-panel p-4 rounded-xl border border-slate-800 flex items-center justify-between text-xs text-slate-400 bg-navy-950/40">
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

      {/* Add Customer Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#121927] border border-slate-800 rounded-xl w-full max-w-lg p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg font-bold text-white">Register New Customer (KYC)</h2>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">First Name *</label>
                  <input
                    type="text"
                    name="firstName"
                    required
                    value={formData.firstName}
                    onChange={handleInputChange}
                    placeholder="e.g. Amina"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Last Name *</label>
                  <input
                    type="text"
                    name="lastName"
                    required
                    value={formData.lastName}
                    onChange={handleInputChange}
                    placeholder="e.g. Mwinyi"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Email Address *</label>
                  <input
                    type="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="amina@example.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Phone Number (HatPesa) *</label>
                  <input
                    type="tel"
                    name="phone"
                    required
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="+255 712 345 678"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">National ID / NIDA Number *</label>
                <input
                  type="text"
                  name="idNumber"
                  required
                  value={formData.idNumber}
                  onChange={handleInputChange}
                  placeholder="e.g. 19901234-12345-00001-23"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Street Address</label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    placeholder="Samora Avenue, Plot 14"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">City</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    placeholder="Dar es Salaam"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Notes / KYC Verification References</label>
                <textarea
                  name="notes"
                  rows={2}
                  value={formData.notes}
                  onChange={handleInputChange}
                  placeholder="Guarantor info, employer, or initial verification notes"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-navy-950 text-sm font-bold flex items-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50"
                >
                  {submitting ? 'Saving to Database...' : 'Save Customer Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {isEditModalOpen && editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#121927] border border-slate-800 rounded-xl w-full max-w-lg p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg font-bold text-white">Edit Customer Profile</h2>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 mt-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={editFormData.firstName}
                    onChange={e => setEditFormData({ ...editFormData, firstName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    value={editFormData.lastName}
                    onChange={e => setEditFormData({ ...editFormData, lastName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Phone</label>
                  <input
                    type="tel"
                    required
                    value={editFormData.phone}
                    onChange={e => setEditFormData({ ...editFormData, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={editFormData.email}
                    onChange={e => setEditFormData({ ...editFormData, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Street Address</label>
                  <input
                    type="text"
                    value={editFormData.address}
                    onChange={e => setEditFormData({ ...editFormData, address: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-300 mb-1">City</label>
                  <input
                    type="text"
                    value={editFormData.city}
                    onChange={e => setEditFormData({ ...editFormData, city: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={editFormData.notes}
                  onChange={e => setEditFormData({ ...editFormData, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
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
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-navy-950 font-bold disabled:opacity-50"
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Details & Portfolio Drawer / Modal */}
      {selectedCustomerId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#121927] border border-slate-800 rounded-xl w-full max-w-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            {loadingDetail || !customerDetail ? (
              <div className="p-12 text-center text-slate-400">
                <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                Loading complete customer portfolio from PostgreSQL...
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      {customerDetail.firstName} {customerDetail.lastName}
                    </h2>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">
                      National ID: {customerDetail.nationalId || customerDetail.idNumber || 'KYC Pending'}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedCustomerId(null);
                      setCustomerDetail(null);
                    }}
                    className="text-slate-400 hover:text-white p-1 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4 my-5 text-xs">
                  {/* Basic Profile Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                    <div>
                      <span className="text-slate-400">Phone Number</span>
                      <div className="font-medium text-white mt-0.5 font-mono">{customerDetail.phone}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Email Address</span>
                      <div className="font-medium text-white mt-0.5 truncate">{customerDetail.email}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Location</span>
                      <div className="font-medium text-white mt-0.5">{customerDetail.city || 'Tanzania'}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Joined</span>
                      <div className="font-medium text-white mt-0.5">
                        {new Date(customerDetail.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  {/* Active Financing Agreements */}
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                    <div className="font-bold text-white flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-400" />
                      Hire Purchase Financing Contracts
                    </div>
                    {!customerDetail.financingAgreements || customerDetail.financingAgreements.length === 0 ? (
                      <div className="text-slate-500 italic">No hire purchase agreements recorded.</div>
                    ) : (
                      <div className="space-y-2">
                        {customerDetail.financingAgreements.map((hp: any) => (
                          <div key={hp.id} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                            <div>
                              <span className="font-mono font-bold text-indigo-400">{hp.agreementNumber}</span>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                Device: {hp.device?.manufacturer} {hp.device?.model} (S/N: {hp.device?.serialNumber})
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                {hp.status}
                              </span>
                              <div className="font-mono text-emerald-400 text-[11px] mt-0.5">
                                Total: TZS {hp.purchasePriceTZS?.toLocaleString() || hp.totalAmountTZS?.toLocaleString()}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Active Rentals */}
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                    <div className="font-bold text-white flex items-center gap-2">
                      <Repeat className="w-4 h-4 text-purple-400" />
                      Equipment Rental Agreements
                    </div>
                    {!customerDetail.rentalAgreements || customerDetail.rentalAgreements.length === 0 ? (
                      <div className="text-slate-500 italic">No rental agreements recorded.</div>
                    ) : (
                      <div className="space-y-2">
                        {customerDetail.rentalAgreements.map((rt: any) => (
                          <div key={rt.id} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                            <div>
                              <span className="font-mono font-bold text-purple-400">{rt.agreementNumber}</span>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                Device: {rt.device?.manufacturer} {rt.device?.model}
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                {rt.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recent Payments */}
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                    <div className="font-bold text-white flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-emerald-400" />
                      Payment Transaction History
                    </div>
                    {!customerDetail.paymentTransactions || customerDetail.paymentTransactions.length === 0 ? (
                      <div className="text-slate-500 italic">No payments recorded for this customer.</div>
                    ) : (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {customerDetail.paymentTransactions.map((p: any) => (
                          <div key={p.id} className="p-2 rounded bg-slate-900 flex items-center justify-between font-mono text-[11px]">
                            <div>
                              <span className="text-white font-bold">TZS {p.amountTZS?.toLocaleString()}</span>
                              <span className="text-slate-500 ml-2">({p.reference || p.method})</span>
                            </div>
                            <span className={p.status === 'COMPLETED' || p.status === 'SUCCESS' ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                              {p.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                  <button
                    onClick={() => handleDeleteCustomer(customerDetail.id, `${customerDetail.firstName} ${customerDetail.lastName}`)}
                    className="px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Deactivate Customer
                  </button>

                  <button
                    onClick={() => {
                      setSelectedCustomerId(null);
                      setCustomerDetail(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
                  >
                    Close Profile
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
