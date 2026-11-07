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
  ExternalLink,
  RefreshCw,
  FileText
} from 'lucide-react';
import { apiCustomers, Customer } from '../../lib/api';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
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

  const loadCustomers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiCustomers.list();
      setCustomers(data.customers || []);
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

  const handleDeleteCustomer = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete customer ${name}?`)) return;

    try {
      await apiCustomers.delete(id);
      setSuccess(`Customer ${name} deleted successfully.`);
      setSelectedCustomer(null);
      await loadCustomers();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete customer.');
    }
  };

  const filtered = customers.filter(c => {
    const term = searchTerm.toLowerCase();
    const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
    return (
      fullName.includes(term) ||
      c.idNumber.toLowerCase().includes(term) ||
      c.phone.includes(term) ||
      c.email.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-amber-400" />
            Customer Portfolio & KYC Directory
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Verified identity records, assigned laptop fleet, and financial repayment profiles.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadCustomers}
            title="Refresh from PostgreSQL"
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-navy-950 text-sm font-bold flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Add Customer
          </button>
        </div>
      </div>

      {/* Notifications */}
      {success && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Search Bar & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-4 rounded-xl border border-slate-800">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by name, email, phone, or national ID..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900/80 border border-slate-700/80 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>
        <div className="text-xs text-slate-400 flex items-center gap-4">
          <span>Total Customers: <strong className="text-white">{customers.length}</strong></span>
          <span>Showing: <strong className="text-amber-400">{filtered.length}</strong></span>
        </div>
      </div>

      {/* Customers Grid */}
      {loading ? (
        <div className="glass-panel p-12 text-center rounded-2xl border border-slate-800 text-slate-400">
          <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <span>Connecting to PostgreSQL and fetching customer records...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel p-12 text-center rounded-2xl border border-slate-800 text-slate-400">
          <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <div className="text-base font-semibold text-white">No customers found</div>
          <p className="text-xs text-slate-400 mt-1">
            {searchTerm ? 'No results matched your search criteria.' : 'No customers registered yet. Click "Add Customer" to register your first borrower.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(customer => {
            const agreementCount = (customer._count?.financingAgreements || 0) + (customer._count?.rentalAgreements || 0);

            return (
              <div
                key={customer.id}
                onClick={() => setSelectedCustomer(customer)}
                className="glass-panel p-6 rounded-2xl border border-slate-800 hover:border-amber-500/40 transition-all hover:-translate-y-0.5 cursor-pointer flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-white text-base">
                        {customer.firstName} {customer.lastName}
                      </div>
                      <div className="text-xs font-mono text-amber-400/90 mt-0.5">
                        ID: {customer.idNumber}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      KYC Verified
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-300">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{customer.phone}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate">{customer.email}</span>
                    </div>
                    {customer.address && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate">{customer.address}, {customer.city}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Laptop className="w-4 h-4 text-cyan-400" />
                    <span>{agreementCount} Active Device(s)</span>
                  </div>
                  <span className="text-amber-400 font-medium hover:underline flex items-center gap-1">
                    Details &rarr;
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Customer Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-navy-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
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
                    placeholder="e.g. Mwangi"
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
                  <label className="block text-xs font-medium text-slate-300 mb-1">Mobile Phone (M-Pesa) *</label>
                  <input
                    type="text"
                    name="phone"
                    required
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="+255 712 345 678"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">National ID / Passport Number *</label>
                <input
                  type="text"
                  name="idNumber"
                  required
                  value={formData.idNumber}
                  onChange={handleInputChange}
                  placeholder="e.g. 19920101-12345-00001-22"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
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

      {/* Customer Details Drawer / Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-navy-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-white">
                  {selectedCustomer.firstName} {selectedCustomer.lastName}
                </h2>
                <div className="text-xs text-slate-400 font-mono mt-0.5">
                  ID: {selectedCustomer.idNumber}
                </div>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 my-5 text-sm">
              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <div>
                  <div className="text-xs text-slate-400">Phone Number</div>
                  <div className="font-medium text-white mt-0.5">{selectedCustomer.phone}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Email Address</div>
                  <div className="font-medium text-white mt-0.5 truncate">{selectedCustomer.email}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Location</div>
                  <div className="font-medium text-white mt-0.5">
                    {selectedCustomer.address || 'N/A'}, {selectedCustomer.city || 'Tanzania'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Registered On</div>
                  <div className="font-medium text-white mt-0.5">
                    {new Date(selectedCustomer.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {selectedCustomer.notes && (
                <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 text-xs text-slate-300">
                  <strong className="text-slate-400 block mb-1">KYC Notes:</strong>
                  {selectedCustomer.notes}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <button
                onClick={() => handleDeleteCustomer(selectedCustomer.id, `${selectedCustomer.firstName} ${selectedCustomer.lastName}`)}
                className="px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Customer
              </button>

              <button
                onClick={() => setSelectedCustomer(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
