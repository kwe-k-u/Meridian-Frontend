import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ApiService } from '../services/api-service';
import { useApp } from '../contexts/AppContext';
import type { CustomerResponse } from '../types/app';
import '../styles/Travelers.css';

// ── Travelers ──────────────────────────────────────────────────
// Purpose: CRUD page for managing travelers (customers) — list, create,
//          edit, and delete with modal forms.
// State: customers, loading, showModal, editingId, form, saving, confirmDelete.
// API: ApiService.getCustomers, .createCustomer, .updateCustomer, .deleteCustomer.

const statusColors: Record<string, { bg: string; fg: string }> = {
  active: { bg: '#E3F7EF', fg: '#0E9F6E' },
  inactive: { bg: '#EEF0F4', fg: '#8A90A2' },
  archived: { bg: '#FDECEC', fg: '#D64545' },
};

const getInitials = (first: string, last: string) =>
  (first?.[0] ?? '') + (last?.[0] ?? '');

const avatarColors = ['#2B63F6', '#0E9F6E', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#0E7C8F', '#C13584'];

const emptyForm = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  nationality: '',
  notes: '',
};

export default function Travelers() {
  const { user } = useAuth();
  const ctx = useApp();
  const defaultCompanyId = user?.companies?.[0]?.company_id ?? '';

  const [customers, setCustomers] = useState<CustomerResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ApiService.getCustomers();
      setCustomers(res.data);
    } catch (err) {
      ctx.toastAction?.('Failed to load travelers');
    } finally {
      setLoading(false);
    }
  }, [ctx]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (c: CustomerResponse) => {
    setEditingId(c.customer_id);
    setForm({
      first_name: c.first_name,
      last_name: c.last_name,
      email: c.email ?? '',
      phone: c.phone ?? '',
      nationality: c.nationality ?? '',
      notes: c.notes ?? '',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      ctx.toastAction?.('First and last name are required');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await ApiService.updateCustomer(editingId, {
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email || null,
          phone: form.phone || null,
          nationality: form.nationality || null,
          notes: form.notes || null,
        });
        ctx.toastAction?.('Traveler updated');
      } else {
        await ApiService.createCustomer({
          company_id: defaultCompanyId,
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email || null,
          phone: form.phone || null,
          nationality: form.nationality || null,
          notes: form.notes || null,
        });
        ctx.toastAction?.('Traveler created');
      }
      closeModal();
      fetchCustomers();
    } catch (err) {
      ctx.toastAction?.('Failed to save traveler');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await ApiService.deleteCustomer(id);
      ctx.toastAction?.('Traveler deleted');
      setConfirmDelete(null);
      fetchCustomers();
    } catch (err) {
      ctx.toastAction?.('Failed to delete traveler');
    }
  };

  return (
    <div className="travelers-page">
      <div className="travelers-toolbar">
        <h2 className="travelers-title">Travelers</h2>
        <button className="travelers-add-btn" onClick={openCreate}>
          + Add traveler
        </button>
      </div>

      {loading ? (
        <div className="travelers-loading">Loading...</div>
      ) : customers.length === 0 ? (
        <div className="travelers-empty">
          <p>No travelers yet.</p>
          <button className="travelers-add-btn" onClick={openCreate}>Add your first traveler</button>
        </div>
      ) : (
        <div className="card">
          <div className="table-header travelers-table-header">
            <span className="table-th">Traveler</span>
            <span className="table-th">Email / Phone</span>
            <span className="table-th">Nationality</span>
            <span className="table-th">Status</span>
            <span className="table-th">Actions</span>
          </div>
          {customers.map((c, i) => {
            const sc = statusColors[c.status] ?? { bg: '#EEF0F4', fg: '#5B6172' };
            return (
              <div key={c.customer_id} className="table-row travelers-table-row">
                <div className="flex-row gap-12" style={{ cursor: 'pointer' }} onClick={() => openEdit(c)}>
                  <div className="avatar-circle" style={{ background: avatarColors[i % avatarColors.length] }}>
                    {getInitials(c.first_name, c.last_name)}
                  </div>
                  <span className="traveler-name">{c.first_name} {c.last_name}</span>
                </div>
                <span className="traveler-cell-text">
                  {c.email && <div>{c.email}</div>}
                  {c.phone && <div className="traveler-phone">{c.phone}</div>}
                  {!c.email && !c.phone && <span className="text-muted">—</span>}
                </span>
                <span className="traveler-cell-text">{c.nationality || '—'}</span>
                <span>
                  <span className="status-pill" style={{ background: sc.bg, color: sc.fg }}>{c.status}</span>
                </span>
                <span>
                  <button className="traveler-action-btn" onClick={() => openEdit(c)}>Edit</button>
                  <button className="traveler-action-btn traveler-action-delete" onClick={() => setConfirmDelete(c.customer_id)}>Delete</button>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingId ? 'Edit traveler' : 'Add traveler'}</h3>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">First name *</label>
                  <input className="form-input" name="first_name" value={form.first_name} onChange={handleChange} placeholder="First name" />
                </div>
                <div className="form-group">
                  <label className="form-label">Last name *</label>
                  <input className="form-input" name="last_name" value={form.last_name} onChange={handleChange} placeholder="Last name" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" name="email" value={form.email} onChange={handleChange} placeholder="email@example.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" name="phone" value={form.phone} onChange={handleChange} placeholder="+233 50 000 0000" />
              </div>
              <div className="form-group">
                <label className="form-label">Nationality</label>
                <input className="form-input" name="nationality" value={form.nationality} onChange={handleChange} placeholder="e.g. Ghanaian" />
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-input form-textarea" name="notes" value={form.notes} onChange={handleChange} placeholder="Any notes..." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="modal-backdrop" onClick={() => setConfirmDelete(null)}>
          <div className="modal-card modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete traveler</h3>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete this traveler? This action cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleDelete(confirmDelete)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
