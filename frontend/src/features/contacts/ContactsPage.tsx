'use client';

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { CustomSelect } from '@/components/ui/custom-select';
import { api } from '@/lib/api';
import { EASE_OUT } from '@/lib/framer-motion-constants';
import './contacts.css';

/* ── Types ── */

interface Contact {
  id: string;
  clientId: string;
  companyName: string;
  contactName: string;
  role: string | null;
  email: string | null;
  phone: string | null;
}

interface BackendContact {
  id: string;
  clientId: string;
  contactName: string;
  contactRole?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
}

interface ClientOption {
  id: string;
  name: string;
  commercialName?: string | null;
}

/* ── Helpers ── */

function getInitials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

const AVATAR_COLORS = ['#e8621a', '#2563eb', '#7c3aed', '#16a34a', '#d97706', '#dc2626', '#0891b2', '#be185d'];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function dn(c: ClientOption) {
  return c.commercialName?.trim() || c.name;
}

type SortKey = 'contactName' | 'role' | 'companyName' | 'email' | 'phone';
type SortDir = 'asc' | 'desc';

/* ── Contact Modal ── */

interface ContactFormState {
  clientId: string;
  contactName: string;
  contactRole: string;
  contactEmail: string;
  contactPhone: string;
}

const emptyForm = (): ContactFormState => ({
  clientId: '', contactName: '', contactRole: '', contactEmail: '', contactPhone: '',
});

function ContactModal({ open, onClose, onSaved, editContact }: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editContact?: Contact | null;
}) {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [form, setForm] = useState<ContactFormState>(emptyForm());
  const [status, setStatus] = useState('');
  const isEdit = !!editContact;

  useEffect(() => {
    if (!open) return;
    api.get<ClientOption[]>('/api/clients').then(({ data }) => setClients(data || [])).catch(() => {});
  }, [open]);

  useEffect(() => {
    if (editContact) {
      setForm({
        clientId: editContact.clientId,
        contactName: editContact.contactName,
        contactRole: editContact.role || '',
        contactEmail: editContact.email || '',
        contactPhone: editContact.phone || '',
      });
    } else {
      setForm(emptyForm());
    }
    setStatus('');
  }, [editContact, open]);

  function reset() { setForm(emptyForm()); setStatus(''); }

  async function handleSave() {
    if (!form.clientId) { setStatus('Veuillez sélectionner une entreprise.'); return; }
    if (!form.contactName.trim()) { setStatus('Le nom du contact est requis.'); return; }
    setStatus('Enregistrement…');

    const payload = {
      clientId: form.clientId,
      contactName: form.contactName.trim(),
      contactRole: form.contactRole || null,
      contactEmail: form.contactEmail || null,
      contactPhone: form.contactPhone || null,
    };

    try {
      if (isEdit) {
        await api.put(`/api/contacts/${editContact!.id}`, payload);
      } else {
        await api.post('/api/contacts', payload);
      }
      reset(); onSaved(); onClose();
    } catch {
      setStatus('Erreur — veuillez réessayer.');
    }
  }

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="ct-modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => { reset(); onClose(); }}
      >
        <motion.div
          className="ct-modal"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="ct-modal-header">
            <div className="ct-modal-icon">
              <svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
            </div>
            <div className="ct-modal-header-text">
              <h2 className="ct-modal-title">{isEdit ? 'Modifier le contact' : 'Nouveau contact'}</h2>
              <p className="ct-modal-subtitle">{isEdit ? 'Mettez à jour les informations du contact.' : 'Associez un contact à une entreprise.'}</p>
            </div>
            <button className="ct-modal-close" onClick={() => { reset(); onClose(); }}>
              <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <div className="ct-modal-body">
            <div className="ct-modal-field">
              <label>Entreprise <span className="ct-req">*</span></label>
              <CustomSelect
                value={form.clientId}
                onChange={(v) => setForm({ ...form, clientId: v })}
                options={clients.map((c) => ({ value: c.id, label: dn(c) }))}
                placeholder="Sélectionner une entreprise…"
              />
            </div>

            <div className="ct-modal-field">
              <label>Nom du contact <span className="ct-req">*</span></label>
              <input type="text" placeholder="ex: Ahmed Ben Ali" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
            </div>

            <div className="ct-modal-row">
              <div className="ct-modal-field">
                <label>Poste / Fonction</label>
                <input type="text" placeholder="ex: Directeur" value={form.contactRole} onChange={(e) => setForm({ ...form, contactRole: e.target.value })} />
              </div>
              <div className="ct-modal-field">
                <label>Email</label>
                <input type="email" placeholder="ex: contact@societe.tn" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
              </div>
            </div>

            <div className="ct-modal-field">
              <label>Téléphone</label>
              <input type="tel" placeholder="ex: +216 20 000 000" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
            </div>
          </div>

          <div className="ct-modal-footer">
            {status && <span className="ct-modal-status">{status}</span>}
            <div className="ct-modal-actions">
              <button className="ct-modal-btn-cancel" onClick={() => { reset(); onClose(); }}>Annuler</button>
              <button className="ct-modal-btn-save" onClick={handleSave}>{isEdit ? 'Mettre à jour' : 'Enregistrer'}</button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ── Main Page ── */

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [clientMap, setClientMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);

  const [search, setSearch] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('contactName');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: contactsData }, { data: clientsData }] = await Promise.all([
        api.get<BackendContact[]>('/api/contacts'),
        api.get<ClientOption[]>('/api/clients'),
      ]);

      const map = new Map((clientsData || []).map((c) => [c.id, c.commercialName?.trim() || c.name]));
      setClientMap(map);

      const mapped: Contact[] = (contactsData || [])
        .filter((c) => c.contactName?.trim())
        .map((c) => ({
          id: c.id,
          clientId: c.clientId,
          companyName: map.get(c.clientId) || '—',
          contactName: c.contactName,
          role: c.contactRole || null,
          email: c.contactEmail || null,
          phone: c.contactPhone || null,
        }));

      setContacts(mapped);
    } catch (err) {
      console.error('loadContacts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const companies = [...new Set(contacts.map((c) => c.companyName).filter((x) => x && x !== '—'))].sort() as string[];
  const roles = [...new Set(contacts.map((c) => c.role).filter(Boolean))].sort() as string[];

  let filtered = contacts;
  if (filterCompany) filtered = filtered.filter((c) => c.companyName === filterCompany);
  if (filterRole) filtered = filtered.filter((c) => c.role === filterRole);
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter((c) =>
      c.contactName.toLowerCase().includes(q) ||
      c.companyName.toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.role || '').toLowerCase().includes(q)
    );
  }

  filtered = [...filtered].sort((a, b) => {
    const av = (String(a[sortKey] || '')).toLowerCase();
    const bv = (String(b[sortKey] || '')).toLowerCase();
    return sortDir === 'asc'
      ? (av < bv ? -1 : av > bv ? 1 : 0)
      : (av > bv ? -1 : av < bv ? 1 : 0);
  });

  const hasFilters = search || filterCompany || filterRole;

  function clearFilters() { setSearch(''); setFilterCompany(''); setFilterRole(''); }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  function openEdit(c: Contact) { setEditContact(c); setShowModal(true); }
  function openAdd() { setEditContact(null); setShowModal(true); }

  async function handleDelete(id: string) {
    try {
      await api.delete(`/api/contacts/${id}`);
      load();
    } catch (err) {
      console.error('deleteContact:', err);
    }
  }

  const Th = ({ col, label }: { col: SortKey; label: string }) => (
    <th onClick={() => toggleSort(col)} className={sortKey === col ? 'sorted' : ''}>
      <div className="ct-th-inner">
        {label}
        <svg className="ct-sort-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          {sortKey === col
            ? sortDir === 'asc' ? <path d="M12 19V5M5 12l7-7 7 7"/> : <path d="M12 5v14M5 12l7 7 7-7"/>
            : <><path d="M12 5v14"/><path d="M5 9l7-7 7 7" opacity="0.4"/><path d="M5 15l7 7 7-7" opacity="0.4"/></>}
        </svg>
      </div>
    </th>
  );

  return (
    <div className="contacts-page">
      {/* ── Page switcher ── */}
      <motion.div
        style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE_OUT }}
      >
        <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 9999, background: 'var(--surface, #eaeff1)' }}>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
            <Link to="/about" style={{ display: 'block', padding: '9px 28px', borderRadius: 9999, border: '1px solid var(--border, #e0e0e5)', background: 'transparent', color: 'var(--muted, #888)', fontWeight: 600, fontSize: 14, textDecoration: 'none', whiteSpace: 'nowrap' }}>Clients</Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
            <Link to="/contacts" style={{ display: 'block', padding: '9px 28px', borderRadius: 9999, border: '1px solid transparent', background: '#f46a03', color: '#fff', fontWeight: 600, fontSize: 14, textDecoration: 'none', whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(244,106,3,0.3)' }}>Contacts</Link>
          </motion.div>
        </div>
      </motion.div>

      <div className="contacts-header">
        <div>
          <h1 className="contacts-title">Contacts</h1>
          <p className="contacts-subtitle">
            {filtered.length} contact{filtered.length !== 1 ? 's' : ''}
            {hasFilters ? ` sur ${contacts.length}` : ` enregistré${contacts.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <motion.button
          className="ct-add-btn"
          onClick={openAdd}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
        >
          <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Ajouter un contact
        </motion.button>
      </div>

      {/* Filters */}
      <div className="contacts-filters">
        <div className="ct-search-wrap">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            type="text"
            className="ct-search"
            placeholder="Rechercher un contact, entreprise, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="ct-filter-select">
          <CustomSelect
            value={filterCompany}
            onChange={setFilterCompany}
            options={companies.map((c) => ({ value: c, label: c }))}
            placeholder="Toutes les entreprises"
          />
        </div>

        <div className="ct-filter-select">
          <CustomSelect
            value={filterRole}
            onChange={setFilterRole}
            options={roles.map((r) => ({ value: r, label: r }))}
            placeholder="Tous les postes"
          />
        </div>

        <div className="ct-filter-select">
          <CustomSelect
            value={`${sortKey}-${sortDir}`}
            onChange={(v) => {
              const [k, d] = v.split('-') as [SortKey, SortDir];
              if (k && d) { setSortKey(k); setSortDir(d); }
            }}
            options={[
              { value: 'contactName-asc', label: 'Nom (A→Z)' },
              { value: 'contactName-desc', label: 'Nom (Z→A)' },
              { value: 'companyName-asc', label: 'Entreprise (A→Z)' },
              { value: 'companyName-desc', label: 'Entreprise (Z→A)' },
              { value: 'role-asc', label: 'Poste (A→Z)' },
              { value: 'role-desc', label: 'Poste (Z→A)' },
            ]}
            placeholder="Trier par…"
          />
        </div>

        {hasFilters && (
          <button className="ct-clear-btn" onClick={clearFilters}>Réinitialiser</button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="contacts-loading">Chargement…</div>
      ) : filtered.length === 0 ? (
        <motion.div className="contacts-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
          <p>{hasFilters ? 'Aucun contact trouvé' : 'Aucun contact'}</p>
          <span>{hasFilters ? 'Essayez de modifier vos filtres.' : 'Cliquez sur "Ajouter un contact" pour commencer.'}</span>
        </motion.div>
      ) : (
        <motion.div
          className="contacts-table-wrap"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          style={{ overflowX: 'auto' }}
        >
          <table className="contacts-table">
            <thead>
              <tr>
                <Th col="contactName" label="Nom" />
                <Th col="role" label="Poste" />
                <Th col="companyName" label="Entreprise" />
                <Th col="email" label="Email" />
                <Th col="phone" label="Téléphone" />
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <motion.tr
                  key={c.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.03 }}
                >
                  <td>
                    <div className="ct-name-cell">
                      <div className="ct-avatar" style={{ background: avatarColor(c.contactName) }}>
                        {getInitials(c.contactName)}
                      </div>
                      <div className="ct-name">{c.contactName}</div>
                    </div>
                  </td>
                  <td>{c.role || '—'}</td>
                  <td>
                    {c.companyName !== '—'
                      ? <Link to="/about" className="ct-company-link">{c.companyName}</Link>
                      : '—'}
                  </td>
                  <td>
                    {c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : '—'}
                  </td>
                  <td>
                    {c.phone ? <a href={`tel:${c.phone}`}>{c.phone}</a> : '—'}
                  </td>
                  <td>
                    <div className="ct-row-actions">
                      <button className="ct-action-btn" onClick={() => openEdit(c)} title="Modifier">
                        <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button className="ct-action-btn ct-action-btn--danger" onClick={() => handleDelete(c.id)} title="Supprimer">
                        <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      )}

      <ContactModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditContact(null); }}
        onSaved={load}
        editContact={editContact}
      />
    </div>
  );
}
