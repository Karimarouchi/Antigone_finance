import { useState, useEffect, useRef, useMemo } from 'react';
import { DatePicker } from '@/components/ui/date-picker';
import { CustomSelect } from '@/components/ui/custom-select';
import { motion, AnimatePresence } from 'motion/react';
import { EASE_OUT } from '@/lib/framer-motion-constants';
import { useSalaires, calculerFichePaie, brutFromNet, firstMonthWorkedDays, lastMonthWorkedDays, returnMonthWorkedDays, workingDaysInMonth } from '../hooks/useSalaires';
import type { CarryoverEntry } from '../hooks/useSalaires';
import type { ContractHistoryRow } from '../hooks/useContractHistory';
import { useMoisCourant } from '../MoisContext';
import type { Employee, GainsOptionnels, AutresRetenues, ContractType, SituationFamiliale, EmployeeMensuel, FichesPaie, SalaryElement } from '../types';
import { DEFAULT_SALARY_ELEMENTS } from '../types';
import type { PayrollRates, IrppBracket } from '../hooks/usePayrollRates';
import { DEFAULT_RATES } from '../hooks/usePayrollRates';
import type { SalaryMode, EmployeePayrollOverrides, EmployeePayrollSettings } from '../hooks/useEmployeePayrollSettingsDb';
import '@/features/clients/clients.css';
import '@/features/decaissements/decaissements.css';

function fmt(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Format a rate (0.0918) as "9,18" for display */
function fmtRate(r: number) {
  return (r * 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getInitials(prenom: string, nom: string) {
  return ([prenom[0], nom[0]].filter(Boolean).join('').toUpperCase()) || '?';
}

const AVATAR_COLORS = ['#e8621a', '#2563eb', '#7c3aed', '#16a34a', '#d97706', '#0891b2', '#be185d'];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

const CONTRACT_TYPES: ContractType[] = ['CDI', 'CDD', 'CIVP', 'Stage', 'Freelance'];
const SITUATIONS: SituationFamiliale[] = ['Célibataire', 'Marié(e)', 'Divorcé(e)', 'Veuf/Veuve'];

const GAINS_LABELS: Record<keyof GainsOptionnels, string> = {
  prime: 'Prime',
  bonus: 'Bonus',
  commission: 'Commission',
  heures_supp: 'Heures supplémentaires',
  indemnite_transport: 'Indemnité transport',
  indemnite_repas: 'Indemnité repas',
  indemnite_internet: 'Indemnité internet',
};

const RETENUES_LABELS: Record<keyof AutresRetenues, string> = {
  avances: 'Avances sur salaire',
  absences: 'Retenue absences',
};

/* ── Employee form modal ── */

const EXEMPT_CONTRACT_TYPES = new Set(['CIVP', 'Freelance', 'Stage']);

/** Uncontrolled-while-editing input: shows external value when idle, lets user type freely, commits on blur. */
function DraftInput({ displayValue, onCommit, ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'onBlur'> & {
  displayValue: string;
  onCommit: (raw: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      {...props}
      value={draft ?? displayValue}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        onCommit(raw); // commit immediately so parent state is always current
      }}
      onBlur={() => setDraft(null)} // clear draft so formatted displayValue takes over
    />
  );
}

type RateKey = keyof Omit<EmployeePayrollOverrides, 'irpp_brackets'>;

function EmpRateField({ label, fieldKey, value, onChange, disabled }: {
  label: string; fieldKey: RateKey; value: number;
  onChange: (key: RateKey, val: number) => void; disabled?: boolean;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="prs-rate-field">
        <DraftInput
          type="number" min="0" max="100" step="0.001" disabled={disabled}
          displayValue={(value * 100).toFixed(3)}
          onCommit={(raw) => { const n = parseFloat(raw); if (!isNaN(n)) onChange(fieldKey, n / 100); }}
        />
        <span className="prs-rate-pct">%</span>
      </div>
    </div>
  );
}

function EmployeeModal({
  open, employee, saving, onClose, onSave, currentGlobalBareme, initialSettings, rates,
}: {
  open: boolean;
  employee: Employee | null;
  saving?: boolean;
  onClose: () => void;
  onSave: (data: Partial<Employee>, payrollSettings: EmployeePayrollSettings) => void;
  currentGlobalBareme: IrppBracket[];
  initialSettings?: EmployeePayrollSettings;
  rates: PayrollRates;
}) {
  const isEdit = !!employee;
  const [form, setForm] = useState<Record<string, any>>({});

  /* ── Per-employee payroll settings ── */
  const [salaryMode,    setSalaryMode]    = useState<SalaryMode>('net');
  const [rateOverrides, setRateOverrides] = useState<EmployeePayrollOverrides>({});
  const prevOpenRef = useRef(false);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      if (employee?.id) {
        const stored = initialSettings ?? { salary_mode: 'net' as SalaryMode, overrides: {} };
        setSalaryMode(stored.salary_mode);
        const { irpp_brackets: _, ...restOverrides } = stored.overrides;
        setRateOverrides(restOverrides);
      } else {
        setSalaryMode('net');
        setRateOverrides({});
      }
    }
    prevOpenRef.current = open;
  }, [open, employee?.id]);

  // Effective rate: employee override first, then live global rate
  const effRate = (key: keyof Omit<EmployeePayrollOverrides, 'irpp_brackets'>): number =>
    (rateOverrides[key] as number | undefined) ?? (rates[key as keyof PayrollRates] as number);

  const setOverride = (key: keyof Omit<EmployeePayrollOverrides, 'irpp_brackets'>, val: number) =>
    setRateOverrides((prev) => ({ ...prev, [key]: val }));

  // Sync form when modal opens
  if (open && Object.keys(form).length === 0) {
    const base = employee ?? {
      nom: '', prenom: '', cin: '', date_naissance: '', lieu_naissance: '',
      situation_familiale: 'Célibataire', enfants: 0, adresse: '', telephone: '', email: '',
      poste: '', departement: '', type_contrat: 'CDI',
      date_debut: new Date().toISOString().slice(0, 10), date_fin: null,
      numero_cnss: '', banque: '', rib: '', salaire_base: 0,
      gains: { prime: 0, bonus: 0, commission: 0, heures_supp: 0, indemnite_transport: 0, indemnite_repas: 0, indemnite_internet: 0 },
      retenues: { avances: 0, absences: 0 },
    };
    setForm({ ...base });
  }

  function handleClose() {
    setForm({});
    setSalaryMode('net');
    setRateOverrides({});
    onClose();
  }
  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }));

  const hasDuration = form.type_contrat === 'CDD' || form.type_contrat === 'CIVP' || form.type_contrat === 'Stage';
  const isExempt = EXEMPT_CONTRACT_TYPES.has(form.type_contrat ?? '');

  // Live salary hint — mirrors full pipeline
  const salaryHint = (() => {
    const v = +form.salaire_base || 0;
    if (v <= 0 || isExempt) return null;
    const effectiveRates = { ...rates, ...rateOverrides, irpp_brackets: currentGlobalBareme };
    if (salaryMode === 'net') {
      return { label: 'Brut ≈', value: brutFromNet(v, effectiveRates) };
    }
    const cnss               = v * effectiveRates.cnss_employee;
    const imposable          = v - cnss;
    const abattement_rate    = effectiveRates.abattement ?? 0;
    const abat               = imposable * abattement_rate;
    const revenu_net_imposable = imposable - abat;
    const contribution_base  = abattement_rate > 0 ? revenu_net_imposable : imposable;
    const sol                = contribution_base * effectiveRates.solidarity_employee;
    let tax = 0, rest = revenu_net_imposable * 12, prev = 0;
    for (const { plafond, taux } of effectiveRates.irpp_brackets) {
      const p = (plafond === null ? Infinity : plafond) as number;
      const t = Math.min(rest, p - prev); if (t <= 0) break;
      tax += t * taux; rest -= t; prev = p;
    }
    return { label: 'Net ≈', value: +(v - cnss - sol - tax / 12).toFixed(3) };
  })();

  // Live avatar
  const hasName = !!(form.prenom || form.nom);
  const initials = getInitials(form.prenom || '', form.nom || '');
  const avatarBg = hasName ? avatarColor([form.prenom, form.nom].filter(Boolean).join(' ')) : undefined;

  function handleSave() {
    if (!form.nom || !form.prenom) return;
    const empData: Partial<Employee> = {
      ...form,
      enfants: +form.enfants || 0,
      salaire_base: +form.salaire_base || 0,
      date_fin: form.date_fin || null,
    };
    onSave(empData, { salary_mode: salaryMode, overrides: rateOverrides });
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="add-client-overlay"
          style={{ zIndex: 10000 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
        >
          <motion.div
            className="add-client-modal"
            initial={{ scale: 0.93, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.93, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Top bar ── */}
            <div className="modal-topbar">
              <motion.div
                className={`modal-topbar-icon${hasName ? ' has-initials' : ''}`}
                animate={{ background: avatarBg ?? 'var(--accent-bg, rgba(232,98,26,0.1))' }}
                transition={{ duration: 0.3 }}
              >
                {hasName
                  ? <span style={{ color: '#fff', fontSize: 14, fontWeight: 700, letterSpacing: '-0.02em' }}>{initials}</span>
                  : <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                }
              </motion.div>
              <div className="modal-topbar-text">
                <div className="add-client-modal-title">
                  {isEdit ? 'Modifier le profil' : 'Nouveau profil employ\u00e9'}
                </div>
                <div className="modal-topbar-sub">
                  {hasName
                    ? [form.prenom, form.nom].filter(Boolean).join(' ')
                    : 'Renseignez les informations de l\u2019employ\u00e9'
                  }
                </div>
              </div>
              <motion.button className="modal-close-btn" onClick={handleClose} whileTap={{ scale: 0.9 }}>
                <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </motion.button>
            </div>

            {/* ── Scrollable body ── */}
            <div className="modal-scroll-body">

              {/* ── IDENTITÉ (full-width) ── */}
              <div className="modal-section-card full-width">
                <div className="modal-section-hdr">
                  <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  <span className="modal-section-label">Identit&eacute;</span>
                </div>
                <div className="modal-section-body">
                  {/* Row 1: Prénom · Nom · CIN */}
                  <div className="modal-fields-3">
                    <div className="field">
                      <label>Pr&eacute;nom <span className="req">*</span></label>
                      <input type="text" placeholder="Prénom" value={form.prenom || ''} onChange={(e) => set('prenom', e.target.value)} autoFocus />
                    </div>
                    <div className="field">
                      <label>Nom <span className="req">*</span></label>
                      <input type="text" placeholder="Nom de famille" value={form.nom || ''} onChange={(e) => set('nom', e.target.value)} />
                    </div>
                    <div className="field">
                      <label>CIN</label>
                      <input type="text" placeholder="00000000" maxLength={8} value={form.cin || ''} onChange={(e) => set('cin', e.target.value)} />
                    </div>
                  </div>
                  {/* Row 2: Date naiss. · Lieu naiss. · Enfants */}
                  <div className="modal-fields-3">
                    <div className="field">
                      <label>Date de naissance</label>
                      <DatePicker value={form.date_naissance || ''} onChange={(v) => set('date_naissance', v)} />
                    </div>
                    <div className="field">
                      <label>Lieu de naissance</label>
                      <input type="text" placeholder="Ville" value={form.lieu_naissance || ''} onChange={(e) => set('lieu_naissance', e.target.value)} />
                    </div>
                    <div className="field">
                      <label>Enfants &agrave; charge</label>
                      <input type="number" min="0" placeholder="0" value={form.enfants || ''} onChange={(e) => set('enfants', +e.target.value)} />
                    </div>
                  </div>
                  {/* Row 3: Situation · Téléphone · Email */}
                  <div className="modal-fields-3">
                    <div className="field">
                      <label>Situation familiale</label>
                      <CustomSelect
                        value={form.situation_familiale || 'Célibataire'}
                        onChange={(v) => set('situation_familiale', v)}
                        options={SITUATIONS.map((s) => ({ value: s, label: s }))}
                      />
                    </div>
                    <div className="field">
                      <label>T&eacute;l&eacute;phone</label>
                      <input type="text" placeholder="+216 XX XXX XXX" value={form.telephone || ''} onChange={(e) => set('telephone', e.target.value)} />
                    </div>
                    <div className="field">
                      <label>Email</label>
                      <input type="email" placeholder="email@exemple.com" value={form.email || ''} onChange={(e) => set('email', e.target.value)} />
                    </div>
                  </div>
                  {/* Row 4: Adresse (full) */}
                  <div className="field">
                    <label>Adresse</label>
                    <input type="text" placeholder="Adresse complète" value={form.adresse || ''} onChange={(e) => set('adresse', e.target.value)} />
                  </div>
                </div>
              </div>

              {/* ── CONTRAT (left col) ── */}
              <div className="modal-section-card">
                <div className="modal-section-hdr">
                  <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <span className="modal-section-label">Contrat</span>
                </div>
                <div className="modal-section-body">
                  {isEdit && (
                    <div style={{ fontSize: 11, color: 'var(--faint)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 12, height: 12, flexShrink: 0 }}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                      Modifiable uniquement depuis &laquo;&nbsp;R&eacute;viser le contrat&nbsp;&raquo;
                    </div>
                  )}
                  {/* Poste · Département */}
                  <div className="modal-fields-row">
                    <div className="field">
                      <label>Poste</label>
                      <input type="text" placeholder="Titre du poste" value={form.poste || ''} onChange={(e) => set('poste', e.target.value)} disabled={isEdit} />
                    </div>
                    <div className="field">
                      <label>D&eacute;partement</label>
                      <input type="text" placeholder="ex: Marketing" value={form.departement || ''} onChange={(e) => set('departement', e.target.value)} disabled={isEdit} />
                    </div>
                  </div>
                  {/* Type de contrat — pill buttons */}
                  <div className="field">
                    <label>Type de contrat</label>
                    <div className="emp-contract-types">
                      {CONTRACT_TYPES.map((t) => {
                        const active = (form.type_contrat ?? 'CDI') === t;
                        return (
                          <button
                            key={t}
                            type="button"
                            className={`emp-contract-btn${active ? ` active active--${t.toLowerCase()}` : ''}`}
                            onClick={() => !isEdit && set('type_contrat', t)}
                            disabled={isEdit}
                          >
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {/* Dates */}
                  <div className="modal-fields-row">
                    <div className="field">
                      <label>Date de d&eacute;but</label>
                      <DatePicker value={form.date_debut || ''} onChange={(v) => !isEdit && set('date_debut', v)} disabled={isEdit} />
                    </div>
                    {hasDuration && (
                      <div className="field">
                        <label>Date de fin</label>
                        <DatePicker value={form.date_fin || ''} onChange={(v) => !isEdit && set('date_fin', v || null)} disabled={isEdit} />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── BANQUE (right col) ── */}
              <div className="modal-section-card">
                <div className="modal-section-hdr">
                  <svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>
                  <span className="modal-section-label">Coordonn&eacute;es bancaires</span>
                </div>
                <div className="modal-section-body">
                  <div className="field">
                    <label>Banque</label>
                    <input type="text" placeholder="Nom de la banque" value={form.banque || ''} onChange={(e) => set('banque', e.target.value)} />
                  </div>
                  <div className="field">
                    <label>RIB</label>
                    <input type="text" placeholder="XX XXX XXXXXXXX XX" maxLength={24} value={form.rib || ''} onChange={(e) => set('rib', e.target.value)} />
                  </div>
                  {/* Exempt notice */}
                  {isExempt && (
                    <div style={{ marginTop: 4, padding: '10px 12px', background: 'rgba(124,58,237,0.07)', borderRadius: 10, border: '1px solid rgba(124,58,237,0.15)', fontSize: 12, color: '#7c3aed', lineHeight: 1.45 }}>
                      <strong>Contrat {form.type_contrat}</strong> — exon&eacute;r&eacute; de CNSS et d&apos;IRPP. Le co&ucirc;t employeur est &eacute;gal au salaire brut.
                    </div>
                  )}
                </div>
              </div>

              {/* ── PARAMÈTRES DE PAIE (full-width) ── */}
              <div className="modal-section-card full-width">
                <div className="modal-section-hdr">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M17.66 6.34l-1.41 1.41M4.93 19.07l1.41-1.41"/></svg>
                  <span className="modal-section-label">Param&egrave;tres de paie</span>
                  {isEdit && (
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--faint)', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 12, height: 12 }}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                      Modifiable via &laquo;&nbsp;R&eacute;viser le contrat&nbsp;&raquo;
                    </span>
                  )}
                </div>
                <div className="modal-section-body">
                  {/* N° CNSS + Mode de salaire */}
                  <div className="modal-fields-row">
                    <div className="field">
                      <label>N&deg; CNSS</label>
                      <input type="text" placeholder="Num&eacute;ro d&apos;affiliation" value={form.numero_cnss || ''} onChange={(e) => set('numero_cnss', e.target.value)} />
                    </div>
                    <div className="field">
                      <label>Mode de salaire</label>
                      <div className="emp-contract-types">
                        <button type="button" disabled={isEdit} className={`emp-contract-btn${salaryMode === 'net' ? ' active active--cdi' : ''}`} onClick={() => setSalaryMode('net')}>Salaire net</button>
                        <button type="button" disabled={isEdit} className={`emp-contract-btn${salaryMode === 'base' ? ' active active--cdd' : ''}`} onClick={() => setSalaryMode('base')}>Salaire de base</button>
                      </div>
                    </div>
                  </div>
                  {/* Salary input */}
                  <div className="field">
                    <label>{salaryMode === 'net' ? 'Salaire net (TND)' : 'Salaire de base (TND)'}</label>
                    <input
                      type="number" min="0" step="0.001" placeholder="0.000"
                      value={form.salaire_base || ''}
                      onChange={(e) => set('salaire_base', +e.target.value)}
                      disabled={isEdit}
                    />
                    {salaryHint && (
                      <div className="emp-salary-hint">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 11, height: 11, flexShrink: 0 }}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/></svg>
                        {salaryHint.label}&nbsp;<span className="hint-brut">{fmt(salaryHint.value)} TND</span>
                      </div>
                    )}
                  </div>
                  {/* Rate overrides — hidden for exempt contract types */}
                  {!isExempt && (
                    <>
                      <div className="prs-section-title">Abattement forfaitaire</div>
                      <div className="modal-fields-row">
                        <EmpRateField label="Abattement (%)" fieldKey="abattement" value={effRate('abattement')} onChange={setOverride} disabled={isEdit} />
                      </div>
                      <div className="prs-section-title">Cotisations salari&eacute;</div>
                      <div className="modal-fields-row">
                        <EmpRateField label="CNSS salari&eacute;" fieldKey="cnss_employee" value={effRate('cnss_employee')} onChange={setOverride} disabled={isEdit} />
                        <EmpRateField label="Solidarit&eacute; salari&eacute;" fieldKey="solidarity_employee" value={effRate('solidarity_employee')} onChange={setOverride} disabled={isEdit} />
                      </div>
                      <div className="prs-section-title">Charges patronales</div>
                      <div className="modal-fields-row">
                        <EmpRateField label="CNSS employeur" fieldKey="cnss_employer" value={effRate('cnss_employer')} onChange={setOverride} disabled={isEdit} />
                        <EmpRateField label="TFP" fieldKey="tfp" value={effRate('tfp')} onChange={setOverride} disabled={isEdit} />
                      </div>
                      <div className="modal-fields-row">
                        <EmpRateField label="FOPROLOS" fieldKey="foprolos" value={effRate('foprolos')} onChange={setOverride} disabled={isEdit} />
                        <EmpRateField label="Accidents du travail" fieldKey="at" value={effRate('at')} onChange={setOverride} disabled={isEdit} />
                      </div>
                    </>
                  )}

                </div>
              </div>

            </div>

            {/* ── Action bar ── */}
            <div className="modal-action-bar">
              <motion.button className="btn-cancel" onClick={handleClose} whileTap={{ scale: 0.95 }} disabled={saving}>
                Annuler
              </motion.button>
              <motion.button
                className="btn-save"
                disabled={saving || !form.nom || !form.prenom}
                onClick={handleSave}
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: saving ? 1 : 1.02 }}
                style={{ opacity: (saving || !form.nom || !form.prenom) ? 0.6 : 1 }}
              >
                {saving ? 'Enregistrement\u2026' : isEdit ? 'Enregistrer' : 'Cr\u00e9er le profil'}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Monthly adjustment modal (bonus, acompte, jours_absent) ── */

/* ── Toggle switch ── */

function ToggleSwitch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => { if (!disabled) onChange(!checked); }}
      className={`adj-toggle${checked ? ' adj-toggle--on' : ''}${disabled ? ' adj-toggle--disabled' : ''}`}
      style={disabled ? { pointerEvents: 'none', opacity: 0.4 } : undefined}
    >
      <span className="adj-toggle-knob" />
    </button>
  );
}

/* ── Icon for a salary element (matches the original SVGs) ── */

function ElementIcon({ element }: { element: SalaryElement }) {
  if (element.id === 'bonus') {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/></svg>;
  }
  if (element.id === 'acompte') {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>;
  }
  if (element.id === 'absence') {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="14" x2="8.01" y2="14" strokeWidth="3"/></svg>;
  }
  // Generic fallback for custom elements
  if (element.type === 'gain') {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>;
}

/* ── Absence type options ── */

const ABSENCE_TYPES = [
  { value: 'Jours d\'absence',  label: 'Jours d\'absence' },
  { value: 'Chômé non payé',   label: 'Chômé non payé' },
  { value: 'Congé sans solde', label: 'Congé sans solde' },
  { value: '__custom__',       label: 'Autre (personnalisé)' },
];
const ABSENCE_PRESET_VALUES = ABSENCE_TYPES.filter((o) => o.value !== '__custom__').map((o) => o.value);

/* ── Dynamic salary element card ── */

function SalaryElementCard({
  element,
  onChange,
  onDelete,
  hasNameError,
  onNameErrorClear,
  showAmountError,
}: {
  element: SalaryElement;
  onChange: (next: SalaryElement) => void;
  onDelete?: () => void;
  hasNameError?: boolean;
  onNameErrorClear?: () => void;
  showAmountError?: boolean;
}) {
  const iconClass =
    element.icon === 'amber' ? 'adj-field-icon--amber' :
    element.icon === 'red'   ? 'adj-field-icon--red'   :
                               'adj-field-icon--green';
  const isDays = element.unit === 'days';
  const unitLabel = isDays ? 'j' : 'TND';
  const isNameEditable = element.id === 'custom' || element.id.startsWith('custom_');
  const isAbsence = element.id === 'absence';

  // For the absence element: determine which dropdown value is selected
  const absenceDropdownValue = isAbsence
    ? (ABSENCE_PRESET_VALUES.includes(element.name) ? element.name : '__custom__')
    : '';
  const isCustomAbsence = isAbsence && absenceDropdownValue === '__custom__';

  function handleAbsenceTypeChange(val: string) {
    if (val === '__custom__') {
      onChange({ ...element, name: '' });
    } else {
      onChange({ ...element, name: val });
    }
  }

  return (
    <div className="adj-field" style={{ opacity: element.enabled ? 1 : 0.55, transition: 'opacity 0.15s' }}>
      <div className="adj-field-header">
        <div className={`adj-field-icon ${iconClass}`}>
          <ElementIcon element={element} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {isAbsence ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <CustomSelect
                value={absenceDropdownValue}
                onChange={handleAbsenceTypeChange}
                options={ABSENCE_TYPES}
                size="sm"
                disabled={!element.enabled}
              />
              {isCustomAbsence && (
                <>
                  <input
                    className="adj-name-input"
                    value={element.name}
                    onChange={(e) => { onNameErrorClear?.(); onChange({ ...element, name: e.target.value }); }}
                    placeholder="Nom de l'absence…"
                    autoFocus
                    style={hasNameError ? { borderColor: 'var(--danger, #ef4444)', outline: '1px solid var(--danger, #ef4444)' } : undefined}
                  />
                  {hasNameError && (
                    <div style={{ fontSize: 11, color: 'var(--danger, #ef4444)', marginTop: 2, fontWeight: 600 }}>
                      Veuillez saisir un nom pour l'absence personnalisée.
                    </div>
                  )}
                </>
              )}
            </div>
          ) : isNameEditable ? (
            <input
              className="adj-name-input"
              value={element.name}
              onChange={(e) => onChange({ ...element, name: e.target.value })}
              placeholder="Nom de l'élément"
            />
          ) : (
            <div className="adj-field-label">{element.name}</div>
          )}
          {element.description && !isNameEditable && !isAbsence && <div className="adj-field-sub">{element.description}</div>}
        </div>
        {onDelete && (
          <button type="button" className="adj-delete-btn" onClick={onDelete} title="Supprimer">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
        <ToggleSwitch checked={element.enabled} onChange={(v) => onChange({ ...element, enabled: v })} />
      </div>
      <div className={`adj-pill-input-wrap${showAmountError ? ' adj-pill-input-wrap--error' : ''}${!element.enabled ? ' adj-pill-input-wrap--disabled' : ''}`}>
        <input
          type="number"
          min={0}
          step={isDays ? 0.5 : 1}
          className="adj-pill-input"
          value={element.amount || ''}
          disabled={!element.enabled}
          placeholder="0"
          onChange={(e) => {
            const amount = +e.target.value || 0;
            onChange({ ...element, amount, enabled: amount > 0 ? element.enabled : false });
          }}
        />
        <span className="adj-pill-unit">{unitLabel}</span>
      </div>
      {showAmountError && (
        <div style={{ fontSize: 11, color: 'var(--danger, #ef4444)', marginTop: 2, fontWeight: 600 }}>
          Veuillez saisir un montant avant de sauvegarder.
        </div>
      )}
      {element.type !== 'net_only' && (
        <div className="adj-tax-pills">
          <button
            type="button"
            disabled={!element.enabled}
            className={`adj-tax-pill${element.affects_cnss !== false ? ' adj-tax-pill--active' : ''}`}
            title="Inclus dans la base de calcul des cotisations CNSS"
            onClick={() => onChange({ ...element, affects_cnss: element.affects_cnss === false })}
          >
            CNSS
          </button>
          <button
            type="button"
            disabled={!element.enabled}
            className={`adj-tax-pill${element.affects_irpp !== false ? ' adj-tax-pill--active' : ''}`}
            title="Inclus dans la base imposable à l'IRPP"
            onClick={() => onChange({ ...element, affects_irpp: element.affects_irpp === false })}
          >
            IRPP
          </button>
        </div>
      )}
    </div>
  );
}

function AjustementModal({
  open,
  emp,
  mois,
  mensuel,
  onClose,
  onSave,
}: {
  open: boolean;
  emp: Employee;
  mois: string;
  mensuel: EmployeeMensuel;
  onClose: () => void;
  onSave: (elements: SalaryElement[]) => void;
}) {
  const [elements, setLocalElements] = useState<SalaryElement[]>([]);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [absenceNameError, setAbsenceNameError] = useState(false);
  const [amountRequiredError, setAmountRequiredError] = useState(false);
  const originalRef = useRef<SalaryElement[]>([]);

  useEffect(() => {
    if (open) {
      const clone = mensuel.salary_elements.map((e) => ({ ...e }));
      setLocalElements(clone);
      originalRef.current = clone;
      setConfirmDiscard(false);
      setAbsenceNameError(false);
      setAmountRequiredError(false);
    }
  }, [open, mensuel]);

  const isDirty = elements.some((el, idx) => {
    const orig = originalRef.current[idx];
    if (!orig) return el.enabled && el.amount > 0;
    const amountChanged = el.enabled && el.amount > 0 && (el.amount !== orig.amount || !orig.enabled);
    const cnssChanged   = el.affects_cnss !== orig.affects_cnss;
    const irppChanged   = el.affects_irpp !== orig.affects_irpp;
    const nameChanged   = el.name !== orig.name;
    return amountChanged || cnssChanged || irppChanged || nameChanged;
  });

  function updateElement(idx: number, next: SalaryElement) {
    setAmountRequiredError(false);
    setLocalElements((prev) => prev.map((e, i) => (i === idx ? next : e)));
  }

  function resetElements() {
    setLocalElements(DEFAULT_SALARY_ELEMENTS.map((e) => ({ ...e })));
  }

  function requestClose() {
    if (isDirty) { setConfirmDiscard(true); } else { onClose(); }
  }

  const displayName = [emp.prenom, emp.nom].filter(Boolean).join(' ');
  const [y, m] = mois.split('-').map(Number);
  const FR_MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const moisLabel = `${FR_MONTHS[m - 1]} ${y}`;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="add-client-overlay"
          style={{ zIndex: 10002 }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={requestClose}
        >
          <motion.div
            className="add-client-modal adj-modal-grid"
            style={{ position: 'relative' }}
            initial={{ scale: 0.93, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.93, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-topbar">
              <div className="modal-topbar-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/>
                </svg>
              </div>
              <div className="modal-topbar-text">
                <div className="add-client-modal-title">Ajustements du mois</div>
                <div className="modal-topbar-sub">{displayName} — {moisLabel}</div>
              </div>
              <motion.button className="modal-close-btn" onClick={resetElements} whileTap={{ scale: 0.9 }} title="Réinitialiser">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{ width: 13, height: 13 }}>
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                  <path d="M3 3v5h5"/>
                </svg>
              </motion.button>
              <motion.button className="modal-close-btn" onClick={requestClose} whileTap={{ scale: 0.9 }}>
                <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </motion.button>
            </div>

            {/* Unsaved changes confirmation card */}
            <AnimatePresence>
              {confirmDiscard && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{ position: 'absolute', inset: 0, zIndex: 10, borderRadius: 'inherit', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}
                >
                  <motion.div
                    initial={{ scale: 0.88, opacity: 0, y: 16 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.88, opacity: 0, y: 16 }}
                    transition={{ type: 'spring', damping: 24, stiffness: 360 }}
                    style={{ background: 'var(--white, #fff)', borderRadius: 28, padding: '32px 28px 26px', width: '100%', maxWidth: 360, boxShadow: '0 24px 64px rgba(0,0,0,0.28)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={{ width: 52, height: 52, borderRadius: 18, background: 'rgba(234,179,8,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="#ca8a04" strokeWidth="2" strokeLinecap="round" style={{ width: 24, height: 24 }}>
                        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', marginBottom: 6, letterSpacing: '-0.02em' }}>Modifications non sauvegardées</div>
                      <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>Voulez-vous sauvegarder vos ajustements avant de fermer ?</div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                      <motion.button
                        whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.02 }}
                        onClick={() => { onClose(); setConfirmDiscard(false); }}
                        style={{ flex: 1, fontSize: 14, fontWeight: 600, padding: '11px 0', borderRadius: 999, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)', cursor: 'pointer' }}
                      >
                        Ignorer
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.02 }}
                        onClick={() => {
                          const emptyEnabled = elements.some((e) => e.enabled && !(e.amount > 0));
                          if (emptyEnabled) {
                            setConfirmDiscard(false);
                            setAmountRequiredError(true);
                            return;
                          }
                          const absEl = elements.find((e) => e.id === 'absence');
                          const needsName = absEl?.enabled && absEl.amount > 0 && !ABSENCE_PRESET_VALUES.includes(absEl.name) && !absEl.name.trim();
                          if (needsName) {
                            setConfirmDiscard(false);
                            setAbsenceNameError(true);
                          } else {
                            onSave(elements); onClose(); setConfirmDiscard(false);
                          }
                        }}
                        style={{ flex: 1, fontSize: 14, fontWeight: 700, padding: '11px 0', borderRadius: 999, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', boxShadow: '0 4px 16px rgba(232,98,26,0.35)' }}
                      >
                        Sauvegarder
                      </motion.button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
              <div className="adj-elements-grid">
                {elements.filter((el) => el.id !== 'acompte' && el.id !== 'bonus').map((el) => {
                  const idx = elements.findIndex((e) => e.id === el.id);
                  return (
                    <SalaryElementCard
                      key={el.id}
                      element={el}
                      onChange={(next) => updateElement(idx, next)}
                      hasNameError={el.id === 'absence' && absenceNameError}
                      onNameErrorClear={() => setAbsenceNameError(false)}
                      showAmountError={amountRequiredError && el.enabled && !(el.amount > 0)}
                    />
                  );
                })}
              </div>
            </div>

            <div className="modal-action-bar">
              <motion.button className="btn-cancel" onClick={requestClose} whileTap={{ scale: 0.95 }}>Annuler</motion.button>
              {(() => {
                const absEl = elements.find((e) => e.id === 'absence');
                const customNameMissing = absEl?.enabled && !ABSENCE_PRESET_VALUES.includes(absEl.name) && !absEl.name.trim();
                const emptyEnabled = elements.some((e) => e.enabled && !(e.amount > 0));
                const blocked = customNameMissing || emptyEnabled;
                const title = customNameMissing
                  ? 'Saisissez un nom pour l\'absence personnalisée'
                  : emptyEnabled
                  ? 'Remplissez tous les champs activés avant d\'appliquer'
                  : undefined;
                return (
                  <motion.button
                    className="btn-save"
                    onClick={() => { if (!blocked) { onSave(elements); onClose(); } }}
                    disabled={blocked}
                    style={{ opacity: blocked ? 0.5 : 1 }}
                    whileTap={{ scale: blocked ? 1 : 0.95 }}
                    whileHover={{ scale: blocked ? 1 : 1.02 }}
                    title={title}
                  >
                    Appliquer
                  </motion.button>
                );
              })()}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Payslip drawer ── */

function PayslipDrawer({ emp, mois, rates, mensuel, empSettings, onClose }: { emp: Employee; mois: string; rates: PayrollRates; mensuel: EmployeeMensuel; empSettings: EmployeePayrollSettings; onClose: () => void }) {
  const effectiveRates = { ...rates, ...empSettings.overrides };
  const salaryMode = empSettings.salary_mode;
  const fiche = calculerFichePaie(emp, mois, rates, mensuel, empSettings);
  const displayName = [emp.prenom, emp.nom].filter(Boolean).join(' ');

  // Determine which pro-ration scenario applies (mirrors calculerFichePaie order)
  const lastDays   = lastMonthWorkedDays(emp, mois);
  const retourDays = returnMonthWorkedDays(emp, mois);
  const firstDays  = firstMonthWorkedDays(emp, mois);
  const isSameMonthGap = lastDays !== null && retourDays !== null;
  const workedDays = isSameMonthGap
    ? lastDays + retourDays
    : lastDays ?? retourDays ?? firstDays;
  const totalWorkDays = workingDaysInMonth(mois);
  const isProrated = workedDays !== null;
  const prorationType: 'gap' | 'last' | 'return' | 'first' | null =
    isSameMonthGap    ? 'gap'    :
    lastDays != null  ? 'last'   :
    retourDays != null ? 'return' :
    firstDays != null ? 'first'  : null;

  return (
    <AnimatePresence>
      <motion.div
        className="add-client-overlay"
        style={{ zIndex: 9999 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="add-client-modal"
          style={{ maxWidth: 560 }}
          initial={{ scale: 0.93, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.93, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-topbar">
            <div className="modal-topbar-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <div className="modal-topbar-text">
              <div className="add-client-modal-title">Fiche de paie</div>
              <div className="modal-topbar-sub">{displayName}</div>
            </div>
            <motion.button className="modal-close-btn" onClick={onClose} whileTap={{ scale: 0.9 }}>
              <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </motion.button>
          </div>

          <div style={{ overflowY: 'auto', flex: 1, padding: '20px 28px' }}>

            {/* Pro-ration banner */}
            {isProrated && (() => {
              const bannerContent = prorationType === 'gap' ? (
                <div style={{ fontSize: 11, color: '#92400e', marginTop: 2 }}>
                  Archiv&eacute; le {emp.archived_at ? new Date(emp.archived_at).toLocaleDateString('fr-FR') : '—'}
                  &nbsp;({lastDays}j) + retour le {emp.date_retour ? new Date(emp.date_retour).toLocaleDateString('fr-FR') : '—'}
                  &nbsp;({retourDays}j) = {workedDays} jours ouvr&eacute;s sur {totalWorkDays}
                  &nbsp;·&nbsp;Taux&nbsp;: {((workedDays! / totalWorkDays) * 100).toFixed(1)}%
                </div>
              ) : (() => {
                const bannerMeta = {
                  last:   { title: 'Dernier mois — sortie en cours de mois',  dateLabel: 'Dernier jour',   dateVal: emp.archived_at },
                  return: { title: 'Retour — réactivation en cours de mois', dateLabel: 'Date de retour', dateVal: emp.date_retour },
                  first:  { title: '1er mois — entrée en cours de mois',     dateLabel: "Date d'entrée", dateVal: emp.date_debut },
                }[prorationType!];
                return (
                  <div style={{ fontSize: 11, color: '#92400e', marginTop: 2 }}>
                    {bannerMeta.dateLabel}&nbsp;: {bannerMeta.dateVal ? new Date(bannerMeta.dateVal).toLocaleDateString('fr-FR') : '—'}
                    &nbsp;·&nbsp;{workedDays} jour{workedDays !== 1 ? 's' : ''} ouvr&eacute;{workedDays !== 1 ? 's' : ''} sur {totalWorkDays}
                    &nbsp;·&nbsp;Taux&nbsp;: {((workedDays! / totalWorkDays) * 100).toFixed(1)}%
                  </div>
                );
              })();

              const bannerTitle = prorationType === 'gap'
                ? 'Mois mixte — archivage et réactivation'
                : {
                    last:   'Dernier mois — sortie en cours de mois',
                    return: 'Retour — réactivation en cours de mois',
                    first:  '1er mois — entrée en cours de mois',
                  }[prorationType!];

              return (
                <div style={{
                  marginBottom: 14, borderRadius: 10,
                  background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)',
                  padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 10,
                }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2" strokeLinecap="round" style={{ width: 16, height: 16, flexShrink: 0, marginTop: 1 }}>
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#b45309' }}>
                      Salaire pro-rat&eacute; — {bannerTitle}
                    </div>
                    {bannerContent}
                  </div>
                </div>
              );
            })()}

            {/* Gains */}
            <div className="modal-section-card" style={{ marginBottom: 12 }}>
              <div className="modal-section-hdr">
                <svg viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/></svg>
                <span className="modal-section-label">Gains</span>
              </div>
              <div className="modal-section-body" style={{ gap: 8 }}>
                {salaryMode === 'net' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--muted)' }}>Salaire net saisi</span>
                    <span style={{ fontWeight: 600 }}>{fmt(emp.salaire_base)} TND</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--muted)' }}>{salaryMode === 'net' ? 'Salaire brut (calculé)' : 'Salaire de base (brut)'}</span>
                  <span style={{ fontWeight: 600 }}>{fmt(fiche.salaire_brut)} TND</span>
                </div>
                {fiche.bonus > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--muted)' }}>Bonus brut ce mois</span>
                    <span style={{ fontWeight: 600, color: '#16a34a' }}>+{fmt(fiche.bonus)} TND</span>
                  </div>
                )}
                {mensuel.salary_elements
                  .filter((e) => e.enabled && e.type === 'gain' && e.id !== 'bonus')
                  .map((e) => {
                    const amt = e.unit === 'days' ? fiche.salaire_brut / 22 * e.amount : e.amount;
                    if (!amt) return null;
                    return (
                      <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ color: 'var(--muted)' }}>{e.name}</span>
                        <span style={{ fontWeight: 600, color: '#16a34a' }}>+{fmt(amt)} TND</span>
                      </div>
                    );
                  })}
                {mensuel.salary_elements
                  .filter((e) => e.enabled && e.type === 'deduction' && e.id !== 'absence')
                  .map((e) => {
                    const amt = e.unit === 'days' ? fiche.salaire_brut / 22 * e.amount : e.amount;
                    if (!amt) return null;
                    return (
                      <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ color: 'var(--muted)' }}>{e.name}</span>
                        <span style={{ fontWeight: 600, color: '#ef4444' }}>−{fmt(amt)} TND</span>
                      </div>
                    );
                  })}
                {fiche.deduction_absences > 0 && (() => {
                  const absEl = mensuel.salary_elements.find((e) => e.id === 'absence');
                  const days = absEl && absEl.enabled ? absEl.amount : 0;
                  return (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--muted)' }}>{absEl?.name || 'Retenue absences'} ({days} j)</span>
                      <span style={{ fontWeight: 600, color: '#ef4444' }}>−{fmt(fiche.deduction_absences)} TND</span>
                    </div>
                  );
                })()}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, borderTop: '1.5px solid var(--border)', paddingTop: 8 }}>
                  <span>Salaire brut</span>
                  <span>{fmt(fiche.brut_effectif)} TND</span>
                </div>
              </div>
            </div>

            {/* Déductions */}
            <div className="modal-section-card" style={{ marginBottom: 12 }}>
              <div className="modal-section-hdr">
                <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                <span className="modal-section-label">D&eacute;ductions salari&eacute;</span>
              </div>
              <div className="modal-section-body" style={{ gap: 8 }}>

                {/* 1. CNSS */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--muted)' }}>CNSS salari&eacute; ({fmtRate(effectiveRates.cnss_employee)}%)</span>
                  <span style={{ fontWeight: 600, color: '#ef4444' }}>−{fmt(fiche.cnss_salarie)} TND</span>
                </div>

                {/* 2. Salaire imposable = brut − CNSS */}
                <div className="fiche-intermediate-row">
                  <span>Salaire imposable</span>
                  <span>{fmt(fiche.salaire_imposable)} TND</span>
                </div>

                {/* 3. Abattement (only when > 0) */}
                {fiche.abattement_amount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--muted)' }}>
                      Abattement ({fmtRate(effectiveRates.abattement ?? 0)}%)
                    </span>
                    <span style={{ fontWeight: 600, color: '#ef4444' }}>−{fmt(fiche.abattement_amount)} TND</span>
                  </div>
                )}

                {/* 4. Revenu net imposable (only when abattement present) */}
                {fiche.abattement_amount > 0 && (
                  <div className="fiche-intermediate-row">
                    <span>Revenu net imposable</span>
                    <span>{fmt(fiche.revenu_net_imposable)} TND</span>
                  </div>
                )}

                {/* 5. Contribution sociale — dynamic base */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--muted)' }}>
                    Contribution sociale ({fmtRate(effectiveRates.solidarity_employee)}%){' '}
                    <span style={{ fontSize: 11, color: 'var(--muted)', opacity: 0.7 }}>
                      {fiche.abattement_amount > 0 ? 'sur revenu net imposable' : 'sur salaire imposable'}
                    </span>
                  </span>
                  <span style={{ fontWeight: 600, color: '#ef4444' }}>−{fmt(fiche.solidarity_salarie)} TND</span>
                </div>

                {/* 6. IRPP — on revenu net imposable */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--muted)' }}>IRPP mensuel</span>
                  <span style={{ fontWeight: 600, color: '#ef4444' }}>−{fmt(fiche.irpp_mensuel)} TND</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, borderTop: '1.5px solid var(--border)', paddingTop: 8, color: '#16a34a' }}>
                  <span>Net d&ucirc;</span>
                  <span>{fmt(fiche.net)} TND</span>
                </div>
                {mensuel.salary_elements
                  .filter((e) => e.enabled && e.type === 'net_only' && e.id !== 'acompte' && e.amount > 0)
                  .map((e) => (
                    <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--muted)' }}>{e.name}</span>
                      <span style={{ fontWeight: 600, color: '#ef4444' }}>−{fmt(e.amount)} TND</span>
                    </div>
                  ))}
                {fiche.acompte > 0 && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--muted)' }}>Acompte versé</span>
                      <span style={{ fontWeight: 600, color: '#ef4444' }}>−{fmt(fiche.acompte)} TND</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800, borderTop: '1.5px solid var(--border)', paddingTop: 8, color: '#16a34a' }}>
                      <span>Net à payer</span>
                      <span>{fmt(fiche.net_a_payer)} TND</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Charges employeur */}
            <div className="modal-section-card">
              <div className="modal-section-hdr">
                <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
                <span className="modal-section-label">Charges employeur</span>
              </div>
              <div className="modal-section-body" style={{ gap: 8 }}>
                {[
                  { label: `CNSS patronale (${fmtRate(effectiveRates.cnss_employer)}%)`, val: fiche.detail_employeur.cnss },
                  { label: `TFP (${fmtRate(effectiveRates.tfp)}%)`, val: fiche.detail_employeur.tfp },
                  { label: `FOPROLOS (${fmtRate(effectiveRates.foprolos)}%)`, val: fiche.detail_employeur.foprolos },
                  { label: `AT (${fmtRate(effectiveRates.at)}%)`, val: fiche.detail_employeur.at },
                ].map(({ label, val }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--muted)' }}>{label}</span>
                    <span style={{ fontWeight: 600 }}>{fmt(val)} TND</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, borderTop: '1.5px solid var(--border)', paddingTop: 8, color: '#2563eb' }}>
                  <span>Coût total employeur</span>
                  <span>{fmt(fiche.cout_total)} TND</span>
                </div>
              </div>
            </div>
          </div>

          <div className="modal-action-bar">
            <motion.button className="btn-save" onClick={onClose} whileTap={{ scale: 0.95 }}>Fermer</motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ── Payroll settings card ── */

/* ── Main page ── */

type Tab = 'salaires' | 'employes';
type ViewMode = 'grid' | 'table';

function contractColor(t: ContractType | undefined) {
  if (t === 'CDI') return 'green';
  if (t === 'CDD') return 'blue';
  if (t === 'CIVP') return 'amber';
  if (t === 'Stage') return 'purple';
  return 'amber';
}

/* ── Salary payment date modal ── */

/* ── Acompte modal (single employee, single month) ── */

function AcompteModal({
  open, emp, moisLabel, fiche, onClose, onConfirm,
}: {
  open: boolean;
  emp: Employee | null;
  moisLabel: string;
  fiche: FichesPaie | null;
  onClose: () => void;
  onConfirm: (amount: number, dateISO: string) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today);

  useEffect(() => {
    if (open && fiche) {
      setAmount(String(Math.max(0, fiche.net_a_payer)));
      setDate(new Date().toISOString().slice(0, 10));
    }
  }, [open, emp?.id]);

  if (!open || !emp || !fiche) return null;

  const displayName = [emp.prenom, emp.nom].filter(Boolean).join(' ') || 'Employé';
  const parsed = Math.max(0, parseFloat(amount) || 0);
  const remaining = Math.max(0, fiche.net_a_payer);
  const capped = Math.min(parsed, remaining);
  const isValid = capped > 0;

  function handleConfirm() {
    if (!isValid) return;
    onConfirm(capped, date ? new Date(date).toISOString() : new Date().toISOString());
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="add-client-overlay"
          style={{ zIndex: 10002 }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="add-client-modal"
            style={{ maxWidth: 420 }}
            initial={{ scale: 0.93, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.93, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-topbar">
              <div className="modal-topbar-icon" style={{ background: 'rgba(3,105,161,0.1)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#0369a1" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
                </svg>
              </div>
              <div className="modal-topbar-text">
                <div className="add-client-modal-title">Acompte — {displayName}</div>
                <div className="modal-topbar-sub">{moisLabel}</div>
              </div>
              <motion.button className="modal-close-btn" onClick={onClose} whileTap={{ scale: 0.9 }}>
                <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </motion.button>
            </div>

            <div className="modal-scroll-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Summary */}
              <div className="modal-section-card full-width" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                <div style={{ padding: '14px 18px', borderRight: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--faint)', marginBottom: 4 }}>Net à payer</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{fmt(fiche.net)} TND</div>
                </div>
                <div style={{ padding: '14px 18px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--faint)', marginBottom: 4 }}>Reste à verser</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: remaining > 0 ? '#b45309' : '#16a34a', fontVariantNumeric: 'tabular-nums' }}>{fmt(remaining)} TND</div>
                  {fiche.acompte > 0 && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>dont {fmt(fiche.acompte)} déjà versé</div>}
                </div>
              </div>

              {/* Amount + date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="modal-section-card full-width">
                  <div className="modal-section-hdr"><span className="modal-section-label">Montant de l&apos;acompte</span></div>
                  <div className="modal-section-body">
                    <div className="field">
                      <input
                        type="number"
                        autoFocus
                        min={0}
                        max={remaining}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
                        placeholder={`Max ${fmt(remaining)}`}
                        style={{ width: '100%', padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 999, fontSize: 14, fontWeight: 700, outline: 'none', background: 'var(--surface)', color: 'var(--text)', fontVariantNumeric: 'tabular-nums', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-section-card full-width">
                  <div className="modal-section-hdr"><span className="modal-section-label">Date de versement</span></div>
                  <div className="modal-section-body">
                    <div className="field"><DatePicker value={date} onChange={setDate} /></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-action-bar">
              <motion.button className="btn-cancel" onClick={onClose} whileTap={{ scale: 0.95 }}>Annuler</motion.button>
              <motion.button
                className="btn-save"
                onClick={handleConfirm}
                disabled={!isValid}
                whileTap={{ scale: 0.95 }}
                style={{ opacity: isValid ? 1 : 0.5, background: '#0369a1' }}
              >
                Enregistrer l&apos;acompte
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Multi-month salary payment modal ── */

interface PayableSalaryItem {
  moisKey: string;
  label: string;
  fiche: FichesPaie;
  isCurrent: boolean;
  montant_paye: number;
}

function SalaryPaymentModal({
  open,
  emp,
  currentMois,
  currentMoisLabel,
  currentFiche,
  currentPaye,
  currentMontantPaye,
  carryover,
  onClose,
  onConfirm,
}: {
  open: boolean;
  emp: Employee | null;
  currentMois: string;
  currentMoisLabel: string;
  currentFiche: FichesPaie | null;
  currentPaye: boolean;
  currentMontantPaye: number;
  carryover: CarryoverEntry[];
  onClose: () => void;
  onConfirm: (selected: { moisKey: string; fiche: FichesPaie; dateISO: string; amount: number }[]) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [selections, setSelections] = useState<Record<string, boolean>>({});
  const [acompteMois, setAcompteMois] = useState('');
  const [acompteAmount, setAcompteAmount] = useState('');

  const allItems = useMemo((): PayableSalaryItem[] => {
    if (!emp) return [];
    const items: PayableSalaryItem[] = carryover.map((c) => ({
      moisKey: c.moisKey, label: c.label, fiche: c.fiche, isCurrent: false, montant_paye: c.fiche.acompte,
    }));
    if (currentFiche && !currentPaye && currentFiche.net_a_payer > 0) {
      items.push({
        moisKey: currentMois, label: currentMoisLabel, fiche: currentFiche, isCurrent: true, montant_paye: currentMontantPaye,
      });
    }
    return items;
  }, [emp, carryover, currentFiche, currentPaye, currentMois, currentMoisLabel, currentMontantPaye]);

  // The month targeted for acompte (may be any payable month, or '' for none)
  const acompteItem = acompteMois ? (allItems.find((i) => i.moisKey === acompteMois) ?? null) : null;
  // Months shown in the full-payment checkbox list (excludes the acompte month)
  const fullPayItems = allItems.filter((i) => i.moisKey !== acompteMois);

  useEffect(() => {
    if (!open || !emp) return;
    const initSel: Record<string, boolean> = {};
    allItems.forEach((item) => { initSel[item.moisKey] = true; });
    setSelections(initSel);
    // Default acompte target = current month if it's payable, else first item, else none
    const defaultMois = allItems.find((i) => i.isCurrent)?.moisKey ?? allItems[0]?.moisKey ?? '';
    setAcompteMois(defaultMois);
    const defaultItem = allItems.find((i) => i.moisKey === defaultMois);
    setAcompteAmount(defaultItem ? String(Math.max(0, defaultItem.fiche.net_a_payer)) : '');
    setDate(new Date().toISOString().slice(0, 10));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, emp?.id]);

  function handleAcompteMoisChange(moisKey: string) {
    setAcompteMois(moisKey);
    const item = allItems.find((i) => i.moisKey === moisKey);
    setAcompteAmount(item ? String(Math.max(0, item.fiche.net_a_payer)) : '');
  }

  const acompteRemaining = acompteItem ? Math.max(0, acompteItem.fiche.net_a_payer) : 0;
  const parsedAcompte = Math.min(Math.max(0, parseFloat(acompteAmount) || 0), acompteRemaining);
  const isPartialAcompte = acompteItem !== null && parsedAcompte < acompteRemaining && parsedAcompte > 0;

  const fullPayTotal = fullPayItems.reduce((s, item) => selections[item.moisKey] ? s + Math.max(0, item.fiche.net_a_payer) : s, 0);
  const total = fullPayTotal + (acompteItem && parsedAcompte > 0 ? parsedAcompte : 0);

  const allFullChecked = fullPayItems.length > 0 && fullPayItems.every((item) => selections[item.moisKey]);
  function toggleAll() {
    const next = !allFullChecked;
    setSelections((prev) => {
      const updated = { ...prev };
      fullPayItems.forEach((item) => { updated[item.moisKey] = next; });
      return updated;
    });
  }

  function handleConfirm() {
    const dateISO = date ? new Date(date).toISOString() : new Date().toISOString();
    const selected: { moisKey: string; fiche: FichesPaie; dateISO: string; amount: number }[] = [];
    fullPayItems.filter((i) => selections[i.moisKey]).forEach((item) => {
      selected.push({ moisKey: item.moisKey, fiche: item.fiche, dateISO, amount: Math.max(0, item.fiche.net_a_payer) });
    });
    if (acompteItem && parsedAcompte > 0) {
      selected.push({ moisKey: acompteItem.moisKey, fiche: acompteItem.fiche, dateISO, amount: parsedAcompte });
    }
    if (selected.length > 0) onConfirm(selected);
    onClose();
  }

  const displayName = emp ? ([emp.prenom, emp.nom].filter(Boolean).join(' ') || 'Employé') : '';
  const totalRestant = allItems.reduce((s, item) => s + Math.max(0, item.fiche.net_a_payer), 0);

  return (
    <AnimatePresence>
      {open && emp && (
        <motion.div
          className="add-client-overlay"
          style={{ zIndex: 10001 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="add-client-modal"
            style={{ maxWidth: 520 }}
            initial={{ scale: 0.93, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.93, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-topbar">
              <div className="modal-topbar-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round">
                  <rect x="2" y="5" width="20" height="14" rx="2"/>
                  <path d="M2 10h20"/>
                </svg>
              </div>
              <div className="modal-topbar-text">
                <div className="add-client-modal-title">Paiement — {displayName}</div>
                <div className="modal-topbar-sub">
                  {allItems.length} mois &agrave; r&eacute;gler · reste : {fmt(totalRestant)} TND
                </div>
              </div>
              <motion.button className="modal-close-btn" onClick={onClose} whileTap={{ scale: 0.9 }}>
                <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </motion.button>
            </div>

            <div className="modal-scroll-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Month rows */}
              <div className="modal-section-card full-width">
                <div className="modal-section-hdr" style={{ justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ width: 14, height: 14 }}>
                      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    <span className="modal-section-label">Mois &agrave; payer</span>
                  </div>
                  {fullPayItems.length > 1 && (
                    <button
                      onClick={toggleAll}
                      style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
                    >
                      {allFullChecked ? 'Tout décocher' : 'Tout cocher'}
                    </button>
                  )}
                </div>

                <div className="modal-section-body" style={{ padding: 0 }}>
                  {fullPayItems.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr auto', gap: 10, padding: '8px 18px', borderBottom: '1px solid var(--border)', fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--faint)', textTransform: 'uppercase' }}>
                      <span/>
                      <span>Mois</span>
                      <span style={{ textAlign: 'right' }}>Restant</span>
                    </div>
                  )}

                  {fullPayItems.length === 0 && (
                    <div style={{ padding: '14px 18px', fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>
                      Tous les mois sont trait&eacute;s via la section Acompte.
                    </div>
                  )}

                  {fullPayItems.map((item, i) => {
                    const checked = selections[item.moisKey] ?? true;
                    const isLast = i === fullPayItems.length - 1;
                    const remaining = Math.max(0, item.fiche.net_a_payer);
                    const hasExistingPayments = item.montant_paye > 0;
                    const fullNet = item.fiche.net + item.montant_paye;
                    return (
                      <div
                        key={item.moisKey}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '24px 1fr auto',
                          gap: 10,
                          alignItems: 'center',
                          padding: '10px 18px',
                          borderBottom: isLast ? 'none' : '1px solid var(--border)',
                          background: item.isCurrent ? 'rgba(99,102,241,0.04)' : 'transparent',
                          opacity: checked ? 1 : 0.45,
                          transition: 'opacity 0.15s',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => setSelections((prev) => ({ ...prev, [item.moisKey]: e.target.checked }))}
                          style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--accent)' }}
                        />
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                            <span style={{ fontWeight: 600, fontSize: 13, color: item.isCurrent ? 'var(--accent)' : 'var(--text)', textTransform: 'capitalize' }}>
                              {item.label}
                            </span>
                            {item.isCurrent ? (
                              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent)', background: 'rgba(99,102,241,0.12)', borderRadius: 4, padding: '1px 5px', letterSpacing: '0.06em' }}>
                                CE MOIS
                              </span>
                            ) : (
                              <span style={{ fontSize: 9, fontWeight: 700, color: '#b45309', background: 'rgba(234,179,8,0.12)', borderRadius: 4, padding: '1px 5px', letterSpacing: '0.06em' }}>
                                REPORT&Eacute;
                              </span>
                            )}
                            {hasExistingPayments && (
                              <span style={{ fontSize: 9, fontWeight: 700, color: '#0369a1', background: 'rgba(14,165,233,0.1)', borderRadius: 4, padding: '1px 5px', letterSpacing: '0.06em' }}>
                                PARTIEL
                              </span>
                            )}
                          </div>
                          {hasExistingPayments && (
                            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                              Acompte vers&eacute; : {fmt(item.montant_paye)} · Net total : {fmt(fullNet)} TND
                            </div>
                          )}
                        </div>
                        <span style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                          {fmt(remaining)} <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--muted)' }}>TND</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Acompte section — always visible, month selector when multiple months */}
              {allItems.length > 0 && (
                <div className="modal-section-card full-width" style={{ border: '1px solid rgba(3,105,161,0.2)', background: 'rgba(3,105,161,0.03)' }}>
                  <div className="modal-section-hdr">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#0369a1" strokeWidth="1.8" strokeLinecap="round" style={{ width: 13, height: 13 }}>
                      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
                    </svg>
                    <span className="modal-section-label" style={{ color: '#0369a1' }}>Acompte</span>
                  </div>
                  <div className="modal-section-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Month selector — only shown when there are multiple months */}
                    {allItems.length > 1 && (
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                          Mois cibl&eacute;
                        </div>
                        <CustomSelect
                          value={acompteMois}
                          onChange={handleAcompteMoisChange}
                          options={allItems.map((i) => ({ value: i.moisKey, label: i.label + (i.isCurrent ? ' (ce mois)' : ' — reporté') }))}
                        />
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'end' }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                          Montant vers&eacute;
                        </div>
                        <input
                          type="number"
                          min={0}
                          max={acompteRemaining}
                          value={acompteAmount}
                          onChange={(e) => setAcompteAmount(e.target.value)}
                          onBlur={() => {
                            const val = parseFloat(acompteAmount);
                            if (!val || val <= 0) setAcompteAmount(String(acompteRemaining));
                            else if (val > acompteRemaining) setAcompteAmount(String(acompteRemaining));
                          }}
                          style={{ width: '100%', padding: '8px 12px', border: '1.5px solid rgba(3,105,161,0.35)', borderRadius: 999, fontSize: 14, fontWeight: 700, outline: 'none', background: 'var(--surface)', color: 'var(--text)', fontVariantNumeric: 'tabular-nums', boxSizing: 'border-box' }}
                        />
                        {isPartialAcompte && (
                          <div style={{ fontSize: 10, color: '#b45309', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                            Reste apr&egrave;s acompte : {fmt(acompteRemaining - parsedAcompte)} TND
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Net &agrave; payer</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{fmt(acompteRemaining)} TND</div>
                        {acompteItem && acompteItem.montant_paye > 0 && (
                          <div style={{ fontSize: 10, color: 'var(--muted)' }}>dont {fmt(acompteItem.montant_paye)} d&eacute;j&agrave; vers&eacute;</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Date + total */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="modal-section-card full-width">
                  <div className="modal-section-hdr">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ width: 13, height: 13 }}>
                      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    <span className="modal-section-label">Date de paiement</span>
                  </div>
                  <div className="modal-section-body">
                    <div className="field">
                      <DatePicker value={date} onChange={setDate} />
                    </div>
                  </div>
                </div>

                <div className="modal-section-card full-width" style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.18)' }}>
                  <div className="modal-section-hdr">
                    <span className="modal-section-label" style={{ color: 'var(--accent)' }}>Total &agrave; payer</span>
                  </div>
                  <div className="modal-section-body" style={{ paddingTop: 4 }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em' }}>
                      {fmt(total)} <span style={{ fontSize: 13, fontWeight: 600 }}>TND</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                      {fullPayItems.filter((m) => selections[m.moisKey]).length + (acompteItem && parsedAcompte > 0 ? 1 : 0)} mois s&eacute;lectionn&eacute;s
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-action-bar">
              <motion.button className="btn-cancel" onClick={onClose} whileTap={{ scale: 0.95 }}>Annuler</motion.button>
              <motion.button
                className="btn-save"
                onClick={handleConfirm}
                disabled={total <= 0}
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.02 }}
                style={{ opacity: total <= 0 ? 0.5 : 1 }}
              >
                {isPartialAcompte ? 'Enregistrer l\'acompte' : 'Confirmer le paiement'}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── IrppBaremeModal ── */

function IrppBaremeModal({
  open, onClose, currentBareme, onSave, saving,
}: {
  open: boolean;
  onClose: () => void;
  currentBareme: IrppBracket[];
  onSave: (effectiveFrom: string, brackets: IrppBracket[]) => void;
  saving: boolean;
}) {
  const [brackets, setBrackets] = useState<IrppBracket[]>([]);
  const [effectiveFrom, setEffectiveFrom] = useState('');

  useEffect(() => {
    if (open) {
      setBrackets(currentBareme.map((b) => ({ ...b })));
      setEffectiveFrom('');
    }
  }, [open]);

  function addBracket() {
    const last = brackets[brackets.length - 1];
    const prevPlafond = brackets.length > 1 ? (brackets[brackets.length - 2].plafond as number) : 0;
    setBrackets([
      ...brackets.slice(0, -1),
      { plafond: prevPlafond + 10000, taux: last.taux },
      { plafond: Infinity, taux: last.taux },
    ]);
  }

  function updateBracket(i: number, patch: Partial<IrppBracket>) {
    setBrackets((prev) => prev.map((b, j) => j === i ? { ...b, ...patch } : b));
  }

  function removeBracket(i: number) {
    setBrackets((prev) => prev.filter((_, j) => j !== i));
  }

  const canSave = !!effectiveFrom && brackets.length >= 2;

  function rateStyle(pct: number): { accent: string; bg: string; text: string } {
    if (pct === 0)  return { accent: '#22c55e', bg: 'rgba(34,197,94,0.12)',   text: '#4ade80' };
    if (pct <= 15)  return { accent: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  text: '#60a5fa' };
    if (pct <= 25)  return { accent: '#eab308', bg: 'rgba(234,179,8,0.12)',   text: '#ca8a04' };
    if (pct <= 30)  return { accent: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  text: '#d97706' };
    if (pct <= 33)  return { accent: '#f97316', bg: 'rgba(249,115,22,0.12)',  text: '#ea580c' };
    if (pct <= 36)  return { accent: '#ef4444', bg: 'rgba(239,68,68,0.12)',   text: '#dc2626' };
    if (pct <= 38)  return { accent: '#ec4899', bg: 'rgba(236,72,153,0.12)',  text: '#db2777' };
    return          { accent: '#a855f7', bg: 'rgba(168,85,247,0.12)',  text: '#9333ea' };
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="add-client-overlay"
          style={{ zIndex: 10002 }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="add-client-modal"
            style={{ maxWidth: 660 }}
            initial={{ opacity: 0, y: 32, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="modal-topbar">
              <div className="modal-topbar-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                  <path d="M2 17l10 5 10-5"/>
                  <path d="M2 12l10 5 10-5"/>
                </svg>
              </div>
              <div className="modal-topbar-text">
                <div className="add-client-modal-title">Bar&egrave;me I.R.P.P. annuel</div>
                <div className="modal-topbar-sub">Tranches d&apos;imposition — affect &agrave; tous les employ&eacute;s</div>
              </div>
              <motion.button className="modal-close-btn" onClick={onClose} whileTap={{ scale: 0.9 }}>
                <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </motion.button>
            </div>

            <div className="modal-scroll-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* Progression bar */}
              <div style={{ display: 'flex', height: 6, borderRadius: 999, overflow: 'hidden', gap: 2 }}>
                {brackets.map((b, i) => {
                  const pct = Math.round(b.taux * 100);
                  const { accent } = rateStyle(pct);
                  return <div key={i} style={{ flex: 1, background: accent, borderRadius: 999 }} />;
                })}
              </div>

              {/* Column headers */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 110px 36px', gap: 12, padding: '0 18px' }}>
                {['De', 'Jusqu\'à', 'Taux', ''].map((h) => (
                  <span key={h} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--faint)' }}>{h}</span>
                ))}
              </div>

              {/* Bracket rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {brackets.map((b, i, arr) => {
                  const prevPlafond = i === 0 ? 0 : arr[i - 1].plafond;
                  const isLast = b.plafond === Infinity || b.plafond == null;
                  const pct = Math.round(b.taux * 100);
                  const { accent, bg, text } = rateStyle(pct);
                  return (
                    <motion.div
                      key={i}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1.4fr 110px 36px',
                        gap: 12,
                        alignItems: 'center',
                        padding: '8px 18px',
                        borderRadius: 14,
                        background: 'var(--surface)',
                        border: '1px solid var(--border-light)',
                        borderLeft: `3px solid ${accent}`,
                      }}
                    >
                      {/* From — read-only */}
                      <span style={{ fontSize: 13, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                        {prevPlafond === Infinity ? '∞' : (prevPlafond as number).toLocaleString('fr-FR')} TND
                      </span>

                      {/* Ceiling — editable pill or ∞ */}
                      {!isLast ? (
                        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg, var(--background))', border: '1px solid var(--border)', borderRadius: 999, overflow: 'hidden', height: 34 }}>
                          <DraftInput
                            type="number" min="0" step="1000"
                            displayValue={String(b.plafond as number)}
                            onCommit={(raw) => { const n = parseFloat(raw); if (!isNaN(n)) updateBracket(i, { plafond: n }); }}
                            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 13, padding: '0 12px', height: '100%', fontVariantNumeric: 'tabular-nums' }}
                          />
                          <span style={{ fontSize: 11, color: 'var(--faint)', paddingRight: 12, flexShrink: 0 }}>TND</span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', height: 34, padding: '0 12px' }}>
                          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>∞ TND</span>
                        </div>
                      )}

                      {/* Rate pill — editable */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, background: bg, borderRadius: 999, height: 34, padding: '0 4px' }}>
                        <DraftInput
                          type="number" min="0" max="100" step="1"
                          displayValue={(b.taux * 100).toFixed(0)}
                          onCommit={(raw) => { const n = parseFloat(raw); if (!isNaN(n)) updateBracket(i, { taux: n / 100 }); }}
                          style={{ width: 44, background: 'transparent', border: 'none', outline: 'none', color: text, fontWeight: 800, fontSize: 15, textAlign: 'center', padding: 0 }}
                        />
                        <span style={{ color: text, fontWeight: 700, fontSize: 13, marginRight: 4 }}>%</span>
                      </div>

                      {/* Delete */}
                      {!isLast && arr.length > 2 ? (
                        <button type="button" className="prs-irpp-del" onClick={() => removeBracket(i)} style={{ justifySelf: 'center' }}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      ) : <span />}
                    </motion.div>
                  );
                })}
              </div>

              {/* Add bracket */}
              <button
                type="button"
                className="emp-contract-btn"
                style={{ fontSize: 12, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0' }}
                onClick={addBracket}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ width: 13, height: 13, flexShrink: 0 }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Ajouter une tranche
              </button>

              {/* Date */}
              <div style={{ paddingTop: 6, borderTop: '1px solid var(--border-light)', display: 'flex', alignItems: 'flex-end', gap: 16 }}>
                <div className="field" style={{ flex: '0 0 240px' }}>
                  <label>
                    Applicable &agrave; partir du
                    <span style={{ color: 'var(--accent)', marginLeft: 3 }}>*</span>
                  </label>
                  <DatePicker value={effectiveFrom} onChange={setEffectiveFrom} placeholder="Choisir une date" />
                  {effectiveFrom ? (
                    <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                      Avant <strong>{fmtMois(effectiveFrom)}</strong> : inchang&eacute;
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--accent)', marginTop: 4 }}>
                      Requis pour enregistrer
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 11, color: 'var(--faint)', lineHeight: 1.6, paddingBottom: 2 }}>
                  Les mois ant&eacute;rieurs conservent le bar&egrave;me en vigueur &agrave; leur date.
                </span>
              </div>
            </div>

            <div className="modal-action-bar">
              <motion.button className="btn-cancel" onClick={onClose} whileTap={{ scale: 0.95 }}>Annuler</motion.button>
              <motion.button
                className="btn-save"
                disabled={saving || !canSave}
                style={{ opacity: (saving || !canSave) ? 0.6 : 1 }}
                onClick={() => onSave(effectiveFrom, brackets)}
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: saving || !canSave ? 1 : 1.02 }}
              >
                {saving ? 'Enregistrement…' : 'Enregistrer le barème'}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── ContractChangeModal ── */

function fmtMois(dateOrYM: string) {
  // accepts both 'YYYY-MM' and 'YYYY-MM-DD'
  const [y, m] = dateOrYM.slice(0, 7).split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

interface ContractDiffItem { label: string; from: string; to: string; }

const RATE_DIFF_KEYS: Array<[keyof EmployeePayrollOverrides, string]> = [
  ['cnss_employee',       'CNSS sal.'],
  ['solidarity_employee', 'Solidarité'],
  ['cnss_employer',       'CNSS emp.'],
  ['tfp',                 'TFP'],
  ['foprolos',            'FOPROLOS'],
  ['at',                  'AT'],
  ['abattement',          'Abattement'],
];

function computeContractDiff(curr: ContractHistoryRow, prev: ContractHistoryRow): ContractDiffItem[] {
  const d: ContractDiffItem[] = [];
  const fmtTnd = (n: number) => `${fmt(n)} TND`;
  const fmtPct = (v: number | undefined) => v !== undefined ? `${(v * 100).toLocaleString('fr-FR', { maximumFractionDigits: 3 })}%` : 'défaut';

  if (curr.salaire_base !== prev.salaire_base)
    d.push({ label: 'Salaire', from: fmtTnd(prev.salaire_base), to: fmtTnd(curr.salaire_base) });
  if (curr.type_contrat !== prev.type_contrat)
    d.push({ label: 'Contrat', from: prev.type_contrat, to: curr.type_contrat });
  if ((curr.poste ?? '') !== (prev.poste ?? ''))
    d.push({ label: 'Poste', from: prev.poste || '—', to: curr.poste || '—' });
  if ((curr.departement ?? '') !== (prev.departement ?? ''))
    d.push({ label: 'Dépt', from: prev.departement || '—', to: curr.departement || '—' });
  if (curr.salary_mode !== prev.salary_mode)
    d.push({ label: 'Mode', from: prev.salary_mode === 'net' ? 'Net' : 'Base', to: curr.salary_mode === 'net' ? 'Net' : 'Base' });

  for (const [key, label] of RATE_DIFF_KEYS) {
    const pv = prev.payroll_overrides[key] as number | undefined;
    const cv = curr.payroll_overrides[key] as number | undefined;
    if (pv !== cv) d.push({ label, from: fmtPct(pv), to: fmtPct(cv) });
  }
  return d;
}

function nextMonthFirstDay() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  d.setDate(1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

/* ── Archive date modal ── */
function ArchiveDateModal({ employee, onConfirm, onClose, isPaidMonth }: {
  employee: Employee;
  onConfirm: (date: string) => void;
  onClose: () => void;
  isPaidMonth: (mois: string) => boolean;
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const displayName = [employee.prenom, employee.nom].filter(Boolean).join(' ') || 'Sans nom';
  const minDate = employee.date_debut || '';
  const maxDate = new Date().toISOString().slice(0, 10);
  const isTooEarly = minDate && date < minDate;
  const isFuture = date > maxDate;
  const selectedMois = date.slice(0, 7);
  const isPaid = isPaidMonth(selectedMois);
  const lastDay = (() => {
    const [y, m] = selectedMois.split('-').map(Number);
    const d = new Date(y, m, 0); // day 0 of next month = last day of current month
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const isPaidBlocked = isPaid && date !== lastDay;
  const isInvalid = isTooEarly || isFuture || isPaidBlocked;
  return (
    <motion.div className="add-client-overlay" style={{ zIndex: 10002 }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}>
      <motion.div className="add-client-modal" style={{ maxWidth: 420 }}
        initial={{ scale: 0.93, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.93, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        onClick={(e) => e.stopPropagation()}>
        <div className="modal-topbar">
          <div className="modal-topbar-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          </div>
          <div className="modal-topbar-text">
            <div className="add-client-modal-title">Archiver l&apos;employé</div>
            <div className="modal-topbar-sub">{displayName}</div>
          </div>
          <motion.button className="modal-close-btn" onClick={onClose} whileTap={{ scale: 0.9 }}>
            <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </motion.button>
        </div>
        <div className="modal-scroll-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
            Saisissez le <strong>dernier jour travaillé</strong>. Le salaire de ce mois sera calculé au prorata des jours ouvrés jusqu&apos;à cette date.
          </p>
          {minDate && (
            <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 13, height: 13, flexShrink: 0 }}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Date de début : <strong>{new Date(minDate).toLocaleDateString('fr-FR')}</strong>
            </div>
          )}
          <div className="field">
            <label>Dernier jour travaillé</label>
            <DatePicker value={date} onChange={setDate} />
            {isTooEarly && (
              <span style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>
                La date doit être égale ou postérieure à la date de début ({new Date(minDate).toLocaleDateString('fr-FR')}).
              </span>
            )}
            {isFuture && (
              <span style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>
                La date ne peut pas être dans le futur.
              </span>
            )}
            {isPaidBlocked && !isTooEarly && !isFuture && (
              <span style={{ fontSize: 11, color: '#ef4444', marginTop: 2, display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 12, height: 12, flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                Le salaire de {new Date(selectedMois + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })} a déjà été viré. Seul le dernier jour du mois ({new Date(lastDay).toLocaleDateString('fr-FR')}) est autorisé.
              </span>
            )}
          </div>
        </div>
        <div className="modal-action-bar">
          <motion.button className="btn-cancel" onClick={onClose} whileTap={{ scale: 0.95 }}>Annuler</motion.button>
          <motion.button
            className="btn-save"
            style={{ background: '#ef4444', opacity: isInvalid ? 0.5 : 1 }}
            onClick={() => { if (!isInvalid) onConfirm(date); }}
            disabled={isInvalid}
            whileTap={{ scale: 0.95 }}
            whileHover={{ scale: isInvalid ? 1 : 1.02 }}
          >
            Archiver
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Restore date modal ── */
function RestoreDateModal({ employee, onConfirm, onClose }: {
  employee: Employee;
  onConfirm: (date: string) => void;
  onClose: () => void;
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const displayName = [employee.prenom, employee.nom].filter(Boolean).join(' ') || 'Sans nom';

  const minDate = employee.archived_at ?? '';
  const isTooEarly = minDate && date < minDate;
  const isInvalid = !!isTooEarly;

  return (
    <motion.div className="add-client-overlay" style={{ zIndex: 10002 }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}>
      <motion.div className="add-client-modal" style={{ maxWidth: 420 }}
        initial={{ scale: 0.93, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.93, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        onClick={(e) => e.stopPropagation()}>
        <div className="modal-topbar">
          <div className="modal-topbar-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>
          </div>
          <div className="modal-topbar-text">
            <div className="add-client-modal-title">Réactiver l&apos;employé</div>
            <div className="modal-topbar-sub">{displayName}</div>
          </div>
          <motion.button className="modal-close-btn" onClick={onClose} whileTap={{ scale: 0.9 }}>
            <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </motion.button>
        </div>
        <div className="modal-scroll-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
            Saisissez le <strong>premier jour de retour</strong>. Le salaire du mois de retour sera calculé au prorata des jours ouvrés à partir de cette date.
          </p>
          <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.18)', fontSize: 12, color: '#166534' }}>
            Archiv&eacute; le {employee.archived_at ? new Date(employee.archived_at).toLocaleDateString('fr-FR') : '—'} — toutes les donn&eacute;es historiques sont conserv&eacute;es.
          </div>
          <div className="field">
            <label>Premier jour de retour</label>
            <DatePicker value={date} onChange={setDate} />
            {isTooEarly && (
              <span style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>
                La date doit être égale ou postérieure à la date d&apos;archivage ({new Date(minDate).toLocaleDateString('fr-FR')}).
              </span>
            )}
          </div>
          {minDate && (
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Date d&apos;archivage : <strong>{new Date(minDate).toLocaleDateString('fr-FR')}</strong>
            </div>
          )}
        </div>
        <div className="modal-action-bar">
          <motion.button className="btn-cancel" onClick={onClose} whileTap={{ scale: 0.95 }}>Annuler</motion.button>
          <motion.button
            className="btn-save"
            style={{ background: isInvalid ? '#ef4444' : '#16a34a', opacity: isInvalid ? 0.7 : 1 }}
            disabled={isInvalid}
            onClick={() => onConfirm(date)}
            whileTap={{ scale: 0.95 }}
            whileHover={{ scale: isInvalid ? 1 : 1.02 }}
          >
            R&eacute;activer
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ContractChangeModal({
  open, employee, history, saving,
  onClose, onSave, initialSettings, rates,
}: {
  open: boolean;
  employee: Employee | null;
  history: ContractHistoryRow[];
  saving: boolean;
  onClose: () => void;
  onSave: (salaire_base: number, type_contrat: ContractType, poste: string, departement: string, effectiveFrom: string, note: string, payrollSettings: EmployeePayrollSettings) => void;
  initialSettings?: EmployeePayrollSettings;
  rates: PayrollRates;
}) {
  const [salaire, setSalaire] = useState('');
  const [contrat, setContrat] = useState<ContractType>('CDI');
  const [poste, setPoste] = useState('');
  const [departement, setDepartement] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(nextMonthFirstDay());
  const [note, setNote] = useState('');

  // Payroll settings state
  const [salaryMode, setSalaryMode] = useState<SalaryMode>('net');
  const [rateOverrides, setRateOverrides] = useState<EmployeePayrollOverrides>({});

  const setOverride = (key: RateKey, val: number) =>
    setRateOverrides((prev) => ({ ...prev, [key]: val }));

  const effRate = (key: RateKey): number =>
    (rateOverrides[key] as number | undefined) ?? (rates[key as keyof PayrollRates] as number);

  useEffect(() => {
    if (open && employee) {
      setSalaire(String(employee.salaire_base || ''));
      setContrat(employee.type_contrat as ContractType);
      setPoste(employee.poste || '');
      setDepartement(employee.departement || '');
      setEffectiveFrom('');
      setNote('');
      // Load payroll settings
      const stored = initialSettings ?? { salary_mode: 'net' as SalaryMode, overrides: {} };
      setSalaryMode(stored.salary_mode);
      setRateOverrides(stored.overrides ?? {});
    }
  }, [open, employee]);

  if (!employee) return null;

  const displayName = [employee.prenom, employee.nom].filter(Boolean).join(' ') || 'Sans nom';
  const isExempt = EXEMPT_CONTRACT_TYPES.has(contrat);
  const salaryHint = (() => {
    const v = +salaire || 0;
    if (v <= 0 || isExempt) return null;
    if (salaryMode === 'net') return { label: 'Brut estimé :', value: brutFromNet(v, { ...rates, ...rateOverrides }) };
    return null;
  })();

  function handleSave() {
    const s = +salaire;
    if (!s || s <= 0 || !effectiveFrom) return;
    onSave(s, contrat, poste.trim(), departement.trim(), effectiveFrom, note.trim(), { salary_mode: salaryMode, overrides: rateOverrides });
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="add-client-overlay"
          style={{ zIndex: 10001 }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="add-client-modal"
            style={{ maxWidth: 680 }}
            initial={{ opacity: 0, y: 32, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="modal-topbar">
              <div className="modal-topbar-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <path d="M9 15l2 2 4-4"/>
                </svg>
              </div>
              <div className="modal-topbar-text">
                <div className="add-client-modal-title">Réviser le contrat</div>
                <div className="modal-topbar-sub">{displayName}</div>
              </div>
              <motion.button className="modal-close-btn" onClick={onClose} whileTap={{ scale: 0.9 }}>
                <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </motion.button>
            </div>

            <div className="modal-scroll-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Current contract pill */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border-light)' }}>
                <span className={`table-tag table-tag--${contractColor(employee.type_contrat)}`} style={{ fontSize: 11, flexShrink: 0 }}>
                  <span className="tag-dot" />{employee.type_contrat}
                </span>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>Contrat actuel ·</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{fmt(employee.salaire_base)} TND</span>
              </div>

              {/* Form fields — 4 columns */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, alignItems: 'start' }}>
                <div className="field">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4, whiteSpace: 'nowrap' }}>
                    <label style={{ margin: 0 }}>Salaire (TND)</label>
                    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                      <button type="button" className={`emp-contract-btn${salaryMode === 'net' ? ' active active--cdi' : ''}`} style={{ fontSize: 9, padding: '1px 6px' }} onClick={() => setSalaryMode('net')}>Net</button>
                      <button type="button" className={`emp-contract-btn${salaryMode === 'base' ? ' active active--cdi' : ''}`} style={{ fontSize: 9, padding: '1px 6px' }} onClick={() => setSalaryMode('base')}>Base</button>
                    </div>
                  </div>
                  <input type="number" min="0" step="0.001" value={salaire} onChange={(e) => setSalaire(e.target.value)} placeholder="Ex : 1 500" />
                  {salaryHint !== null && (
                    <span style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>
                      {salaryHint.label} <strong>{fmt(salaryHint.value)} TND</strong>
                    </span>
                  )}
                </div>
                <div className="field">
                  <label>Type de contrat</label>
                  <CustomSelect
                    value={contrat}
                    onChange={(v) => setContrat(v as ContractType)}
                    options={CONTRACT_TYPES.map((t) => ({ value: t, label: t }))}
                  />
                </div>
                <div className="field">
                  <label>Poste</label>
                  <input type="text" value={poste} onChange={(e) => setPoste(e.target.value)} placeholder="Ex : Développeur" />
                </div>
                <div className="field">
                  <label>Département</label>
                  <input type="text" value={departement} onChange={(e) => setDepartement(e.target.value)} placeholder="Ex : Informatique" />
                </div>
              </div>

              {/* Paramètres de paie — 4 columns */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="prs-section-title" style={{ marginTop: 0, marginBottom: 0 }}>Param&egrave;tres de paie</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  <EmpRateField label="Abattement" fieldKey="abattement" value={effRate('abattement')} onChange={setOverride} />
                  <EmpRateField label="CNSS salarié" fieldKey="cnss_employee" value={effRate('cnss_employee')} onChange={setOverride} />
                  <EmpRateField label="Solidarité salarié" fieldKey="solidarity_employee" value={effRate('solidarity_employee')} onChange={setOverride} />
                  <EmpRateField label="CNSS employeur" fieldKey="cnss_employer" value={effRate('cnss_employer')} onChange={setOverride} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  <EmpRateField label="TFP" fieldKey="tfp" value={effRate('tfp')} onChange={setOverride} />
                  <EmpRateField label="FOPROLOS" fieldKey="foprolos" value={effRate('foprolos')} onChange={setOverride} />
                  <EmpRateField label="Accidents du travail" fieldKey="at" value={effRate('at')} onChange={setOverride} />
                </div>
              </div>

              {/* Applicable à partir du + Note — above history */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingTop: 4, borderTop: '1px solid var(--border-light)' }}>
                <div className="field">
                  <label>
                    Applicable &agrave; partir du
                    <span style={{ color: 'var(--accent)', marginLeft: 3 }}>*</span>
                  </label>
                  <DatePicker value={effectiveFrom} onChange={setEffectiveFrom} placeholder="Choisir une date" />
                  {effectiveFrom ? (
                    <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                      Avant <strong>{fmtMois(effectiveFrom)}</strong> : inchang&eacute;
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--accent)', marginTop: 4 }}>
                      Requis pour enregistrer
                    </span>
                  )}
                </div>
                <div className="field">
                  <label>Note <span style={{ color: 'var(--faint)', fontWeight: 400 }}>(optionnel)</span></label>
                  <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex : Renégociation annuelle" maxLength={200} />
                </div>
              </div>

              {/* History */}
              {history.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--muted)' }}>
                    Historique des révisions
                  </div>
                  {history.map((h, i) => {
                    const prev = history[i + 1];
                    const diffs = prev ? computeContractDiff(h, prev) : [];
                    const isInitial = i === history.length - 1;
                    return (
                      <div key={h.id} style={{
                        display: 'flex', flexDirection: 'column', gap: 5,
                        padding: '8px 12px', borderRadius: 10,
                        background: i === 0 ? 'rgba(232,98,26,0.05)' : 'var(--surface)',
                        border: `1px solid ${i === 0 ? 'rgba(232,98,26,0.18)' : 'var(--border-light)'}`,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', minWidth: 90 }}>{fmtMois(h.effective_from)}</span>
                          <span className={`table-tag table-tag--${contractColor(h.type_contrat as ContractType)}`} style={{ fontSize: 10 }}>
                            <span className="tag-dot" />{h.type_contrat}
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--muted)', flex: 1 }}>{fmt(h.salaire_base)} TND</span>
                          {i === 0 && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', background: 'rgba(232,98,26,0.1)', borderRadius: 4, padding: '1px 6px', flexShrink: 0 }}>Actuel</span>}
                          {isInitial && <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', background: 'var(--surface-2)', borderRadius: 4, padding: '1px 6px', flexShrink: 0 }}>Initial</span>}
                        </div>
                        {(h.poste || h.departement) && (
                          <div style={{ display: 'flex', gap: 8, paddingLeft: 2 }}>
                            {h.poste && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{h.poste}</span>}
                            {h.poste && h.departement && <span style={{ fontSize: 11, color: 'var(--faint)' }}>·</span>}
                            {h.departement && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{h.departement}</span>}
                          </div>
                        )}
                        {diffs.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingTop: 2 }}>
                            {diffs.map((d, j) => (
                              <span key={j} style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                fontSize: 10, borderRadius: 999, padding: '2px 7px',
                                background: 'rgba(232,98,26,0.06)', border: '1px solid rgba(232,98,26,0.16)',
                              }}>
                                <span style={{ color: 'var(--muted)', fontWeight: 600 }}>{d.label}</span>
                                <span style={{ color: 'var(--faint)', textDecoration: 'line-through' }}>{d.from}</span>
                                <svg viewBox="0 0 16 16" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" style={{ width: 9, height: 9, flexShrink: 0 }}><path d="M3 8h10M9 4l4 4-4 4"/></svg>
                                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{d.to}</span>
                              </span>
                            ))}
                          </div>
                        )}
                        {h.note && <span style={{ fontSize: 11, color: 'var(--faint)', fontStyle: 'italic' }}>{h.note}</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="modal-action-bar">
              <motion.button className="btn-cancel" onClick={onClose} whileTap={{ scale: 0.95 }}>
                Annuler
              </motion.button>
              <motion.button
                className="btn-save"
                onClick={handleSave}
                disabled={saving || !(+salaire > 0) || !effectiveFrom}
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.02 }}
                style={{ opacity: (saving || !(+salaire > 0) || !effectiveFrom) ? 0.6 : 1 }}
              >
                {saving ? 'Enregistrement…' : 'Enregistrer la révision'}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Ordre de Virement Modal ── */

async function generateOrdreVirementPDF(params: {
  compte: string;
  moisLabel: string;
  rows: { nom: string; rib: string; montant: number }[];
  total: number;
}) {
  const html2pdf = (await import('html2pdf.js')).default;

  const rowsHtml = params.rows.map((r, i) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : '#f5f7fa'};">
      <td style="border:1px solid #d0d0d0;padding:12px 20px;font-size:13px;font-weight:700;color:#1e3a5f;">${r.nom}</td>
      <td style="border:1px solid #d0d0d0;padding:12px 20px;font-family:monospace;font-size:12px;letter-spacing:0.04em;color:#374151;">${r.rib}</td>
      <td style="border:1px solid #d0d0d0;padding:12px 20px;text-align:right;font-weight:700;font-size:13px;font-family:monospace;color:#1e3a5f;">${r.montant.toLocaleString('fr-FR',{minimumFractionDigits:3,maximumFractionDigits:3})} TND</td>
    </tr>`).join('');

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;padding:0;background:#fff;width:297mm;height:210mm;box-sizing:border-box;display:flex;align-items:center;justify-content:center;">
      <div style="width:257mm;padding:0;">

        <!-- Header -->
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;padding-bottom:18px;border-bottom:2.5px solid #1e3a5f;">
          <div>
            <div style="font-size:17px;font-weight:800;color:#1e3a5f;letter-spacing:-0.01em;margin-bottom:5px;">SOCIÉTÉ ANTIGONE CONSULTING</div>
            <div style="font-size:12px;color:#6b7280;margin-bottom:2px;">Objet : <strong style="color:#1e3a5f;">Salaires du mois de ${params.moisLabel}</strong></div>
            <div style="font-size:12px;color:#6b7280;">Compte : <strong style="color:#1e3a5f;font-family:monospace;">${params.compte}</strong></div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:24px;font-weight:800;color:#1e3a5f;letter-spacing:-0.02em;">Ordre de virement</div>
          </div>
        </div>

        <!-- Table -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
          <thead>
            <tr style="background:#1e3a5f;">
              <th style="border:1px solid #1e3a5f;padding:11px 20px;font-weight:700;font-size:12px;text-align:left;color:#fff;letter-spacing:0.05em;text-transform:uppercase;">Nom et Prénom</th>
              <th style="border:1px solid #1e3a5f;padding:11px 20px;font-weight:700;font-size:12px;text-align:left;color:#fff;letter-spacing:0.05em;text-transform:uppercase;">RIB</th>
              <th style="border:1px solid #1e3a5f;padding:11px 20px;font-weight:700;font-size:12px;text-align:right;color:#fff;letter-spacing:0.05em;text-transform:uppercase;">Montant (TND)</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>

        <!-- Total -->
        <div style="display:flex;justify-content:flex-end;margin-bottom:36px;">
          <div style="background:#1e3a5f;border-radius:8px;padding:13px 28px;display:flex;align-items:center;gap:48px;min-width:320px;">
            <span style="font-size:13px;font-weight:700;color:#93c5fd;letter-spacing:0.1em;text-transform:uppercase;">Total</span>
            <span style="font-size:17px;font-weight:800;color:#fff;font-family:monospace;margin-left:auto;">${params.total.toLocaleString('fr-FR',{minimumFractionDigits:3,maximumFractionDigits:3})} TND</span>
          </div>
        </div>

        <!-- Signature -->
        <div style="padding-top:18px;border-top:1px solid #e5e7eb;">
          <div style="width:220px;">
            <div style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:36px;">Établi par</div>
            <div style="border-bottom:1px solid #d1d5db;width:180px;"></div>
            <div style="font-size:10px;color:#9ca3af;margin-top:4px;">Signature & cachet</div>
          </div>
        </div>

      </div>
    </div>`;

  const el = document.createElement('div');
  el.innerHTML = html;
  el.style.cssText = 'position:fixed;left:-9999px;top:0;width:297mm;';
  document.body.appendChild(el);
  await html2pdf().set({
    margin: 0,
    filename: `ordre-virement-${params.moisLabel.replace(' ', '-')}.pdf`,
    image: { type: 'jpeg', quality: 0.99 },
    html2canvas: { scale: 2, logging: false, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
  }).from(el.firstElementChild).save();
  document.body.removeChild(el);
}

function OrdreVirementModal({
  open,
  employees,
  fiches,
  mois,
  moisLabel,
  onClose,
}: {
  open: boolean;
  employees: Employee[];
  fiches: Map<string, FichesPaie>;
  mois: string;
  moisLabel: string;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const DEFAULT_COMPTE = '0881100010864';
  const [compte, setCompte] = useState(DEFAULT_COMPTE);
  const [generating, setGenerating] = useState(false);
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSelected(new Set(employees.map((e) => e.id)));
      setCompte(DEFAULT_COMPTE);
      const amounts: Record<string, string> = {};
      employees.forEach((e) => { amounts[e.id] = String(fiches.get(e.id)?.net_a_payer ?? 0); });
      setCustomAmounts(amounts);
    }
  }, [open]);

  function toggle(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAll() {
    setSelected(selected.size === employees.length ? new Set() : new Set(employees.map((e) => e.id)));
  }

  const selectedList = employees.filter((e) => selected.has(e.id));
  const getAmount = (id: string) => parseFloat(customAmounts[id] ?? '0') || 0;
  const total = selectedList.reduce((s, e) => s + getAmount(e.id), 0);
  const allSelected = selected.size === employees.length && employees.length > 0;
  const someSelected = selected.size > 0 && !allSelected;
  const missingRib = selectedList.filter((e) => !e.rib?.trim());
  const zeroAmount = selectedList.filter((e) => !(getAmount(e.id) > 0));
  const canGenerate = selectedList.length > 0 && missingRib.length === 0 && zeroAmount.length === 0 && !!compte.trim();

  async function handleGenerate() {
    if (!canGenerate) return;
    setGenerating(true);
    try {
      await generateOrdreVirementPDF({
        compte,
        moisLabel,
        rows: selectedList.map((e) => ({
          nom: [e.prenom, e.nom].filter(Boolean).join(' '),
          rib: e.rib.trim(),
          montant: getAmount(e.id),
        })),
        total,
      });
    } finally {
      setGenerating(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="add-client-overlay"
          style={{ zIndex: 10002 }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="add-client-modal"
            style={{ maxWidth: 500, display: 'flex', flexDirection: 'column' }}
            initial={{ scale: 0.93, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.93, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="modal-topbar">
              <div className="modal-topbar-icon" style={{ background: 'rgba(37,99,235,0.1)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>
                </svg>
              </div>
              <div className="modal-topbar-text">
                <div className="add-client-modal-title">Ordre de virement</div>
                <div className="modal-topbar-sub">{moisLabel} — {selected.size} employé{selected.size !== 1 ? 's' : ''}</div>
              </div>
              <motion.button className="modal-close-btn" onClick={onClose} whileTap={{ scale: 0.9 }}>
                <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </motion.button>
            </div>

            {/* Compte field */}
            <div style={{ padding: '14px 20px 0' }}>
              <div className="modal-section-hdr" style={{ margin: '0 0 8px' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ width: 12, height: 12, opacity: 0.5 }}>
                  <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
                </svg>
                <span>Compte bancaire</span>
              </div>
              <input
                className="dec-input"
                value={compte}
                onChange={(e) => setCompte(e.target.value)}
                placeholder="Numéro de compte"
                style={{ fontFamily: 'monospace', fontSize: 13, letterSpacing: '0.04em' }}
              />
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                Objet : <strong>Salaires du mois de {moisLabel}</strong>
              </div>
            </div>

            {/* Select all */}
            <div style={{ padding: '12px 20px 0' }}>
              <button type="button" onClick={toggleAll} className="bulk-pay-select-all">
                <span className={`bulk-pay-check${allSelected ? ' bulk-pay-check--on' : someSelected ? ' bulk-pay-check--partial' : ''}`}>
                  {allSelected && <svg viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><polyline points="2,6 5,9 10,3"/></svg>}
                  {someSelected && <span style={{ width: 8, height: 2, background: 'var(--accent)', borderRadius: 2, display: 'block' }} />}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tout sélectionner</span>
                <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{fmt(total)} TND</span>
              </button>
            </div>

            {/* Employee list */}
            <div style={{ padding: '8px 20px', overflowY: 'auto', maxHeight: 280, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {employees.map((emp) => {
                const name = [emp.prenom, emp.nom].filter(Boolean).join(' ') || 'Sans nom';
                const color = avatarColor(name);
                const isSelected = selected.has(emp.id);
                const noRib = isSelected && !emp.rib?.trim();
                return (
                  <div key={emp.id}
                    className={`bulk-pay-row${isSelected ? ' bulk-pay-row--on' : ''}`}
                    style={noRib ? { borderColor: 'rgba(239,68,68,0.5)', background: 'rgba(239,68,68,0.04)' } : undefined}
                  >
                    <button type="button" onClick={() => toggle(emp.id)} style={{ display: 'contents' }}>
                      <span className={`bulk-pay-check${isSelected ? ' bulk-pay-check--on' : ''}`}
                        style={noRib ? { background: '#ef4444', borderColor: '#ef4444' } : undefined}>
                        {isSelected && <svg viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><polyline points="2,6 5,9 10,3"/></svg>}
                      </span>
                      <span className="bulk-pay-avatar" style={{ background: color }}>{name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</span>
                      <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                        <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                        {emp.rib?.trim()
                          ? <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace', letterSpacing: '0.03em' }}>{emp.rib}</span>
                          : <span style={{ display: 'block', fontSize: 11, color: '#ef4444', fontWeight: 600 }}>RIB manquant</span>
                        }
                      </span>
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                      {editingId === emp.id ? (
                        <>
                          <input
                            autoFocus
                            type="number"
                            min={0}
                            step={0.001}
                            value={customAmounts[emp.id] ?? ''}
                            onChange={(e) => setCustomAmounts((prev) => ({ ...prev, [emp.id]: e.target.value }))}
                            onBlur={() => setEditingId(null)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditingId(null); }}
                            style={{
                              width: 90, padding: '4px 8px',
                              border: '1.5px solid #2563eb', borderRadius: 999,
                              fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                              color: '#2563eb', background: 'var(--white)',
                              outline: 'none', textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                            }}
                          />
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>TND</span>
                        </>
                      ) : (
                        <>
                          <span style={{
                            fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                            color: getAmount(emp.id) > 0 ? '#2563eb' : '#ef4444',
                          }}>
                            {getAmount(emp.id) > 0 ? fmt(getAmount(emp.id)) : '—'} TND
                          </span>
                          <button
                            type="button"
                            onClick={() => setEditingId(emp.id)}
                            style={{
                              width: 26, height: 26, borderRadius: 999,
                              border: '1.5px solid var(--border)', background: 'var(--surface)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer', flexShrink: 0, color: 'var(--muted)',
                            }}
                            title="Modifier le montant"
                          >
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Missing RIB warning */}
            {missingRib.length > 0 && (
              <div style={{ margin: '0 20px', padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" style={{ width: 14, height: 14, flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>
                  {missingRib.length} employé{missingRib.length > 1 ? 's' : ''} sélectionné{missingRib.length > 1 ? 's' : ''} sans RIB — ajoutez le RIB ou désélectionnez-les.
                </span>
              </div>
            )}
            {/* Zero amount warning */}
            {zeroAmount.length > 0 && missingRib.length === 0 && (
              <div style={{ margin: '0 20px', padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" style={{ width: 14, height: 14, flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>
                  {zeroAmount.length} employé{zeroAmount.length > 1 ? 's' : ''} avec un montant vide — modifiez ou désélectionnez-les.
                </span>
              </div>
            )}

            {/* Total */}
            <div style={{ padding: '8px 20px 8px' }}>
              <div className="bulk-pay-total-row">
                <span>Total ({selected.size} salaire{selected.size !== 1 ? 's' : ''})</span>
                <span>{fmt(total)} TND</span>
              </div>
            </div>

            {/* Actions */}
            <div className="modal-action-bar" style={{ gap: 10 }}>
              <motion.button className="btn-cancel" style={{ flex: 1, width: 'auto' }} onClick={onClose} whileTap={{ scale: 0.95 }}>
                Annuler
              </motion.button>
              <motion.button
                disabled={!canGenerate || generating}
                onClick={handleGenerate}
                whileTap={{ scale: !canGenerate ? 1 : 0.95 }}
                title={!compte.trim() ? 'Le numéro de compte est requis' : missingRib.length > 0 ? 'Ajoutez le RIB des employés sélectionnés avant de générer' : zeroAmount.length > 0 ? 'Tous les montants doivent être supérieurs à 0' : undefined}
                style={{
                  flex: 1,
                  width: 'auto',
                  padding: '11px 0',
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 29,
                  fontFamily: 'inherit',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: !canGenerate ? 'not-allowed' : 'pointer',
                  opacity: !canGenerate ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 7,
                  filter: canGenerate ? 'drop-shadow(0px 4px 10px rgba(37,99,235,0.35))' : 'none',
                  transition: 'opacity 0.15s, filter 0.15s',
                }}
              >
                {generating ? (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 14, height: 14, animation: 'spin 1s linear infinite', flexShrink: 0 }}>
                      <path d="M21 12a9 9 0 11-6.219-8.56"/>
                    </svg>
                    Génération…
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 14, height: 14, flexShrink: 0 }}>
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    Générer PDF
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Bulk Pay Modal ── */

function BulkPayModal({
  open,
  unpaidEmployees,
  fiches,
  moisLabel,
  onClose,
  onConfirm,
}: {
  open: boolean;
  unpaidEmployees: Employee[];
  fiches: Map<string, FichesPaie>;
  moisLabel: string;
  onClose: () => void;
  onConfirm: (employeeIds: string[], dateISO: string) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
  const [date, setDate] = useState(today);

  useEffect(() => {
    if (open) {
      setSelected(new Set(unpaidEmployees.map((e) => e.id)));
      const d = new Date();
      setDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
    }
  }, [open]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(selected.size === unpaidEmployees.length ? new Set() : new Set(unpaidEmployees.map((e) => e.id)));
  }

  const selectedEmployees = unpaidEmployees.filter((e) => selected.has(e.id));
  const total = selectedEmployees.reduce((s, e) => s + (fiches.get(e.id)?.net_a_payer ?? 0), 0);
  const allSelected = selected.size === unpaidEmployees.length && unpaidEmployees.length > 0;
  const someSelected = selected.size > 0 && !allSelected;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="add-client-overlay"
          style={{ zIndex: 10002 }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="add-client-modal"
            style={{ maxWidth: 480, display: 'flex', flexDirection: 'column' }}
            initial={{ scale: 0.93, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.93, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="modal-topbar">
              <div className="modal-topbar-icon" style={{ background: 'rgba(22,163,74,0.1)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
                </svg>
              </div>
              <div className="modal-topbar-text">
                <div className="add-client-modal-title">Virement groupé</div>
                <div className="modal-topbar-sub">{moisLabel} — {selected.size} employé{selected.size !== 1 ? 's' : ''} sélectionné{selected.size !== 1 ? 's' : ''}</div>
              </div>
              <motion.button className="modal-close-btn" onClick={onClose} whileTap={{ scale: 0.9 }}>
                <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </motion.button>
            </div>

            {/* Select all row */}
            <div style={{ padding: '12px 20px 0' }}>
              <button
                type="button"
                onClick={toggleAll}
                className="bulk-pay-select-all"
              >
                <span className={`bulk-pay-check${allSelected ? ' bulk-pay-check--on' : someSelected ? ' bulk-pay-check--partial' : ''}`}>
                  {allSelected && <svg viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><polyline points="2,6 5,9 10,3"/></svg>}
                  {someSelected && <span style={{ width: 8, height: 2, background: 'var(--accent)', borderRadius: 2, display: 'block' }} />}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Tout sélectionner
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(total)} TND
                </span>
              </button>
            </div>

            {/* Employee list */}
            <div style={{ padding: '8px 20px', overflowY: 'auto', maxHeight: 320, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {unpaidEmployees.map((emp) => {
                const name = [emp.prenom, emp.nom].filter(Boolean).join(' ') || 'Sans nom';
                const color = avatarColor(name);
                const net = fiches.get(emp.id)?.net_a_payer ?? 0;
                const isSelected = selected.has(emp.id);
                return (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => toggle(emp.id)}
                    className={`bulk-pay-row${isSelected ? ' bulk-pay-row--on' : ''}`}
                  >
                    <span className={`bulk-pay-check${isSelected ? ' bulk-pay-check--on' : ''}`}>
                      {isSelected && <svg viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><polyline points="2,6 5,9 10,3"/></svg>}
                    </span>
                    <span className="bulk-pay-avatar" style={{ background: color }}>{name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</span>
                    <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                      {emp.poste && <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.poste}</span>}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#16a34a', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(net)} TND</span>
                  </button>
                );
              })}
            </div>

            {/* Date + total */}
            <div style={{ padding: '8px 20px 4px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="modal-section-hdr" style={{ margin: 0 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ width: 12, height: 12, opacity: 0.5 }}>
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <span>Date de virement</span>
              </div>
              <DatePicker
                value={date}
                onChange={setDate}
                placeholder="Sélectionner une date"
                className="dec-input"
              />
              <div className="bulk-pay-total-row">
                <span>Total à virer ({selected.size} salaire{selected.size !== 1 ? 's' : ''})</span>
                <span>{fmt(total)} TND</span>
              </div>
            </div>

            {/* Actions */}
            <div className="modal-action-bar">
              <motion.button className="btn-cancel" onClick={onClose} whileTap={{ scale: 0.95 }}>Annuler</motion.button>
              <motion.button
                className="btn-save"
                disabled={selected.size === 0 || !date}
                style={{ opacity: selected.size === 0 || !date ? 0.5 : 1 }}
                onClick={() => { if (selected.size > 0 && date) onConfirm([...selected], date); }}
                whileTap={{ scale: selected.size === 0 ? 1 : 0.95 }}
              >
                Virer {selected.size > 0 ? `${selected.size} salaire${selected.size !== 1 ? 's' : ''}` : '—'}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function Salaires() {
  const { mois, label: moisLabel } = useMoisCourant();
  const {
    employees, activeEmployees, archivedEmployees,
    loading, error, fiches, totaux,
    addEmployee, updateEmployee, archiveEmployee, restoreEmployee,
    rates, currentBareme, saveBareme, getBaremeForMois, getPayrollSettingsForMonth,
    getAdjustment, getAdjustmentForMois, setElements, hasAdjustment,
    marquerPaye, marquerPayeForMois, marquerPartiellementPaye, marquerImpaye,
    getCarryover, partials, getPartials, getPaymentsInPaymentMois,
    getContractForMonth, getEmployeeHistory, addContractChange,
  } = useSalaires(mois);
  const [tab, setTab] = useState<Tab>('salaires');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [modalEmp, setModalEmp] = useState<Employee | 'new' | null>(null);
  const [payslipEmp, setPayslipEmp] = useState<Employee | null>(null);
  const [contractChangeEmp, setContractChangeEmp] = useState<Employee | null>(null);
  const [adjEmp, setAdjEmp] = useState<Employee | null>(null);
  const [payingEmp, setPayingEmp] = useState<Employee | null>(null);
  const [bulkPayOpen, setBulkPayOpen] = useState(false);
  const [ordreVirementOpen, setOrdreVirementOpen] = useState(false);
  const [irppOpen, setIrppOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<Employee | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleArchiveConfirm(date: string) {
    if (!archiveTarget) return;
    await archiveEmployee(archiveTarget.id, date);
    setArchiveTarget(null);
  }

  async function handleRestoreConfirm(date: string) {
    if (!restoreTarget) return;
    await restoreEmployee(restoreTarget.id, date);
    setRestoreTarget(null);
  }

  async function handleSave(data: Partial<Employee>, payrollSettings: EmployeePayrollSettings) {
    setSaving(true);
    if (modalEmp === 'new') {
      const emp = await addEmployee(data);
      if (emp?.id) {
        const startDate = (data.date_debut as string | undefined) || new Date().toISOString().slice(0, 10);
        await addContractChange(
          emp.id,
          {
            salaire_base: data.salaire_base ?? 0,
            type_contrat: data.type_contrat ?? 'CDI',
            poste:        data.poste || undefined,
            departement:  data.departement || undefined,
          },
          startDate,
          'Contrat initial',
          payrollSettings,
        );
      }
    } else if (modalEmp) {
      await updateEmployee((modalEmp as Employee).id, data);
    }
    setSaving(false);
    setModalEmp(null);
  }

  async function handleIrppSave(effectiveFrom: string, brackets: IrppBracket[]) {
    setSaving(true);
    await saveBareme(effectiveFrom.slice(0, 7), brackets);
    setSaving(false);
    setIrppOpen(false);
  }

  async function handleContractSave(
    salaire_base: number,
    type_contrat: ContractType,
    poste: string,
    departement: string,
    effectiveFrom: string,
    note: string,
    payrollSettings: EmployeePayrollSettings,
  ) {
    if (!contractChangeEmp) return;
    setSaving(true);

    // If this employee has no history yet, seed an initial entry with their
    // original terms from their start date. This anchors all months before
    // effectiveFrom to the old salary so the fallback (employee record) is
    // never reached for past months after we overwrite it below.
    const existingHistory = getEmployeeHistory(contractChangeEmp.id);
    if (existingHistory.length === 0) {
      const startDate = contractChangeEmp.date_debut || '2000-01-01';
      const seedResult = await addContractChange(
        contractChangeEmp.id,
        {
          salaire_base:  contractChangeEmp.salaire_base,
          type_contrat:  contractChangeEmp.type_contrat,
          poste:         contractChangeEmp.poste || undefined,
          departement:   contractChangeEmp.departement || undefined,
        },
        startDate,
        'Contrat initial',
        getPayrollSettingsForMonth(contractChangeEmp.id, mois),
      );
      if (!seedResult) {
        console.error('handleContractSave: failed to seed initial history entry');
        setSaving(false);
        return;
      }
    }

    const result = await addContractChange(
      contractChangeEmp.id,
      { salaire_base, type_contrat, poste: poste || undefined, departement: departement || undefined },
      effectiveFrom,
      note,
      payrollSettings,
    );
    if (!result) {
      console.error('handleContractSave: addContractChange returned null — check browser console for Supabase error');
      setSaving(false);
      return;
    }
    // Update the employee record so cards show the latest agreed terms
    await updateEmployee(contractChangeEmp.id, { salaire_base, type_contrat, poste, departement });
    setSaving(false);
    setContractChangeEmp(null);
  }

  return (
    <>
      {/* ── Contract change modal ── */}
      <ContractChangeModal
        open={!!contractChangeEmp}
        employee={contractChangeEmp}
        history={contractChangeEmp ? getEmployeeHistory(contractChangeEmp.id) : []}
        saving={saving}
        onClose={() => setContractChangeEmp(null)}
        onSave={handleContractSave}
        initialSettings={contractChangeEmp ? getPayrollSettingsForMonth(contractChangeEmp.id, mois) : undefined}
        rates={rates}
      />

      {/* ── Pill tab switcher ── */}
      <motion.div
        className="sal-tabs-wrap"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE_OUT }}
      >
        <div className="sal-tabs-pill">
          <motion.button
            className={`sal-pill-btn${tab === 'salaires' ? ' active' : ''}`}
            onClick={() => setTab('salaires')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >Salaires</motion.button>
          <motion.button
            className={`sal-pill-btn${tab === 'employes' ? ' active' : ''}`}
            onClick={() => setTab('employes')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >Employ&eacute;s</motion.button>
        </div>
      </motion.div>

      {/* DB error banner */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 14, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#dc2626' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 16, height: 16, flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span><strong>Erreur base de données&nbsp;:</strong> {error}</span>
        </div>
      )}

      {/* Loading skeleton */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 0' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ height: 64, borderRadius: 16, background: 'var(--surface)', animation: 'pulse 1.5s ease-in-out infinite', opacity: 0.7 }} />
          ))}
        </div>
      ) : (

      <AnimatePresence mode="wait">

        {/* ══════════ TAB: SALAIRES ══════════ */}
        {tab === 'salaires' && (
          <motion.div key="salaires" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>

            {/* Stats */}
            <div className="dec-stats">
              <div className="dec-stat">
                <div className="dec-stat-label">Masse brute</div>
                <div className="dec-stat-value">{fmt(totaux.masse_brute)} TND</div>
              </div>
              <div className="dec-stat dec-stat--blue">
                <div className="dec-stat-label">Co&ucirc;t total employeur</div>
                <div className="dec-stat-value">{fmt(totaux.cout_total)} TND</div>
              </div>
              <div className="dec-stat dec-stat--green">
                <div className="dec-stat-label">Salaires pay&eacute;s</div>
                <div className="dec-stat-value">{fmt(totaux.net_paye + totaux.acomptes_verses)} TND</div>
                {(totaux.net_paye > 0 || totaux.acomptes_verses > 0) && (
                  <div className="dec-stat-delta positive">
                    {activeEmployees.filter((e) => getAdjustment(e.id).salaire_paye).length} / {activeEmployees.length} pay&eacute;s
                    {totaux.acomptes_verses > 0 && <span style={{ display: 'block', fontWeight: 600, color: '#0369a1' }}>dont {fmt(totaux.acomptes_verses)} en acomptes</span>}
                  </div>
                )}
              </div>
              <div className={`dec-stat${totaux.net_total_du > 0 ? ' dec-stat--amber' : ' dec-stat--green'}`}>
                <div className="dec-stat-label">Reste &agrave; payer</div>
                <div className="dec-stat-value">{fmt(totaux.net_total_du)} TND</div>
                {totaux.net_reporte > 0 && (
                  <div className="dec-stat-delta" style={{ color: '#b45309' }}>
                    dont {fmt(totaux.net_reporte)} report&eacute;
                  </div>
                )}
                {totaux.net_total_du === 0 && totaux.masse_nette > 0 && (
                  <div className="dec-stat-delta positive">Tous pay&eacute;s ✓</div>
                )}
              </div>
              <div className="dec-stat dec-stat--amber">
                <div className="dec-stat-label">CNSS total</div>
                <div className="dec-stat-value">{fmt(totaux.cnss_total)} TND</div>
              </div>
            </div>

            {/* Month label + Ordre de virement */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div className="sal-month-banner" style={{ marginBottom: 0, flex: 1 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ width: 14, height: 14 }}>
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                Paie de <strong>{moisLabel}</strong>
              </div>
              {activeEmployees.length > 0 && (
                <motion.button
                  whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.02 }}
                  onClick={() => setOrdreVirementOpen(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 999, border: 'none', background: '#2563eb', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 2px 10px rgba(37,99,235,0.3)' }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{ width: 13, height: 13 }}>
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
                  </svg>
                  Ordre de virement
                </motion.button>
              )}
            </div>

            {/* Salary table */}
            {activeEmployees.length === 0 && !archivedEmployees.some((e) => e.archived_at != null && mois > e.archived_at.slice(0, 7) && getCarryover(e.id).length > 0) ? (
              <div className="dec-empty">
                <p>Aucun employ&eacute; actif ce mois</p>
                <span>
                  {employees.length === 0
                    ? "Ajoutez des employés dans l'onglet « Employés » pour voir les calculs de paie."
                    : "Aucun contrat n'était actif en " + moisLabel + ". Vérifiez les dates de début ou naviguez vers un autre mois."}
                </span>
              </div>
            ) : (
              <>
              <div className="clients-table-wrap sal-table-wrap">
                <table className="clients-table sal-table">
                  <colgroup>
                    <col style={{ width: '180px' }} />
                    <col style={{ width: '120px' }} />
                    <col style={{ width: '120px' }} />
                    <col style={{ width: '110px' }} />
                    <col style={{ width: '120px' }} />
                    <col style={{ width: '120px' }} />
                    <col style={{ width: '120px' }} />
                    <col style={{ width: '148px' }} />
                    <col style={{ width: '80px' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th><div className="th-inner">Employ&eacute;</div></th>
                      <th><div className="th-inner">Brut effectif <span className="sal-th-unit">TND</span></div></th>
                      <th><div className="th-inner">CNSS ({fmtRate(rates.cnss_employee)}%) <span className="sal-th-unit">TND</span></div></th>
                      <th><div className="th-inner">IRPP <span className="sal-th-unit">TND</span></div></th>
                      <th><div className="th-inner">Net &agrave; payer <span className="sal-th-unit">TND</span></div></th>
                      <th><div className="th-inner">Co&ucirc;t total <span className="sal-th-unit">TND</span></div></th>
                      <th><div className="th-inner">Ajustements</div></th>
                      <th><div className="th-inner">Statut</div></th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeEmployees.map((emp, i) => {
                      const fiche = fiches.get(emp.id)!;
                      const displayName = [emp.prenom, emp.nom].filter(Boolean).join(' ') || 'Sans nom';
                      const color = avatarColor(displayName);
                      const adj = getAdjustment(emp.id);
                      const hasAdj = hasAdjustment(emp.id);
                      const paye = adj.salaire_paye;
                      const _lastDays   = lastMonthWorkedDays(emp, mois);
                      const _retourDays = returnMonthWorkedDays(emp, mois);
                      const _firstDays  = firstMonthWorkedDays(emp, mois);
                      const isSameMonthGap = _lastDays !== null && _retourDays !== null;
                      const workedDaysInfo = isSameMonthGap
                        ? _lastDays + _retourDays
                        : _lastDays ?? _retourDays ?? _firstDays;
                      const _workDays = workingDaysInMonth(mois);
                      const workedDaysTooltip = isSameMonthGap
                        ? `Pro-raté : ${_lastDays}j + ${_retourDays}j = ${_lastDays + _retourDays}j ouvrés sur ${_workDays} (archivé le ${emp.archived_at ? new Date(emp.archived_at).toLocaleDateString('fr-FR') : '?'}, retour le ${emp.date_retour ? new Date(emp.date_retour).toLocaleDateString('fr-FR') : '?'})`
                        : _lastDays != null
                        ? `Pro-raté : ${_lastDays}j ouvrés sur ${_workDays} (archivé le ${emp.archived_at ? new Date(emp.archived_at).toLocaleDateString('fr-FR') : '?'})`
                        : _retourDays != null
                        ? `Pro-raté : ${_retourDays}j ouvrés sur ${_workDays} (retour le ${emp.date_retour ? new Date(emp.date_retour).toLocaleDateString('fr-FR') : '?'})`
                        : `Pro-raté : ${_firstDays}j ouvrés sur ${_workDays} (entrée le ${emp.date_debut ? new Date(emp.date_debut).toLocaleDateString('fr-FR') : '?'})`;
                      const carryover = getCarryover(emp.id);
                      const cumulImpaye = +carryover.reduce((s, c) => s + c.fiche.net_a_payer, 0).toFixed(3);
                      const currentFiche = fiches.get(emp.id);
                      const currentMontantPaye = currentFiche?.acompte ?? 0;
                      // Has acompte but not yet fully paid
                      const isPartiallyPaid = !paye && currentMontantPaye > 0 && !!currentFiche && currentFiche.net_a_payer > 0;
                      return (
                        <motion.tr
                          key={emp.id}
                          className={paye ? 'sal-row-paye' : ''}
                          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04, duration: 0.2 }}
                        >
                          <td>
                            <div className="table-client-cell">
                              <div className="table-avatar" style={{ background: color }}>{getInitials(emp.prenom, emp.nom)}</div>
                              <div>
                                <div className="table-client-name">
                                  {displayName}
                                  {workedDaysInfo !== null && (
                                    <span
                                      title={workedDaysTooltip}
                                      style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#b45309', background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: 4, padding: '1px 5px', verticalAlign: 'middle' }}
                                    >
                                      {workedDaysInfo}j/{workingDaysInMonth(mois)}
                                    </span>
                                  )}
                                </div>
                                <div className="table-client-mf">{emp.poste || '—'}{emp.departement ? ` · ${emp.departement}` : ''}</div>
                                {(isPartiallyPaid || carryover.length > 0) && (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                    {isPartiallyPaid && (
                                      <span
                                        style={{ fontSize: 10, fontWeight: 700, color: '#0369a1', background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.22)', borderRadius: 4, padding: '2px 6px', whiteSpace: 'nowrap' }}
                                        title={`Acompte versé : ${fmt(currentMontantPaye)} TND · Reste : ${fmt(currentFiche!.net_a_payer)} TND`}
                                      >
                                        Acompte · {fmt(currentMontantPaye)} / {fmt(currentFiche!.net)} TND
                                      </span>
                                    )}
                                    {carryover.length > 0 && (
                                      <span
                                        className="dec-carryover-badge"
                                        title={carryover.map((c) => `${c.label} : ${fmt(Math.max(0, c.fiche.net_a_payer - c.montant_paye))} TND restant`).join('\n')}
                                      >
                                        {carryover.length} mois reporté{carryover.length > 1 ? 's' : ''} · {fmt(cumulImpaye)} TND
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="sal-num">{fmt(fiche?.brut_effectif ?? 0)}</td>
                          <td className="sal-num sal-num--red">−{fmt(fiche?.cnss_salarie ?? 0)}</td>
                          <td className="sal-num sal-num--red">−{fmt(fiche?.irpp_mensuel ?? 0)}</td>
                          <td className={`sal-num sal-num--net${paye ? ' sal-num--paid' : ''}`}>{fmt(fiche?.net_a_payer ?? 0)}</td>
                          <td className="sal-num sal-num--blue">{fmt(fiche?.cout_total ?? 0)}</td>
                          <td>
                            <div className="sal-adj-badges">
                              {adj.salary_elements.filter((e) => e.enabled && e.amount !== 0).map((e) => {
                                const variant =
                                  e.icon === 'amber' ? 'sal-adj-badge--amber' :
                                  e.icon === 'red'   ? 'sal-adj-badge--red'   :
                                                       'sal-adj-badge--green';
                                const sign = e.type === 'gain' ? '+' : e.type === 'deduction' ? '−' : '−';
                                const value = e.unit === 'days' ? `${e.amount}j abs.` : `${sign}${fmt(e.amount)}`;
                                return <span key={e.id} className={`sal-adj-badge ${variant}`}>{value}</span>;
                              })}
                              {!hasAdj && <span style={{ color: 'var(--faint)', fontSize: 11 }}>—</span>}
                            </div>
                          </td>
                          <td>
                            {paye && carryover.length === 0 ? (
                              <span className="dec-badge dec-badge--green">Pay&eacute;</span>
                            ) : paye && carryover.length > 0 ? (
                              <button className="dec-btn dec-btn--green dec-btn--sm" onClick={() => setPayingEmp(emp)}>
                                R&eacute;gler reports
                              </button>
                            ) : (
                              <button className="dec-btn dec-btn--green dec-btn--sm" onClick={() => setPayingEmp(emp)}>
                                {carryover.length > 0
                                  ? `Payer (${carryover.length + 1})`
                                  : isPartiallyPaid
                                  ? 'Solder'
                                  : 'Payer'}
                              </button>
                            )}
                          </td>
                          <td>
                            <div className="sal-row-actions">
                              <button
                                className={`sal-action-btn${hasAdj ? ' sal-action-btn--active' : ''}${paye ? ' sal-action-btn--locked' : ''}`}
                                title={paye ? 'Salaire payé — ajustements verrouillés' : 'Ajustements du mois'}
                                onClick={() => { if (!paye) setAdjEmp(emp); }}
                                disabled={paye}
                              >
                                {/* sliders / tune icon */}
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="4" y1="6" x2="20" y2="6"/><circle cx="9" cy="6" r="2.5"/>
                                  <line x1="4" y1="12" x2="20" y2="12"/><circle cx="15" cy="12" r="2.5"/>
                                  <line x1="4" y1="18" x2="20" y2="18"/><circle cx="9" cy="18" r="2.5"/>
                                </svg>
                              </button>
                              <button className="sal-action-btn sal-action-btn--doc" title="Fiche de paie" onClick={() => setPayslipEmp(emp)}>
                                {/* payslip / file icon */}
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                                  <polyline points="14 2 14 8 20 8"/>
                                  <line x1="8" y1="13" x2="16" y2="13"/>
                                  <line x1="8" y1="17" x2="13" y2="17"/>
                                </svg>
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                    {/* Archived employees with unpaid carryover — visible from the month after archiving until fully paid */}
                    {archivedEmployees
                      .filter((e) => e.archived_at != null && mois > e.archived_at.slice(0, 7) && getCarryover(e.id).length > 0)
                      .map((emp) => {
                        const carryover = getCarryover(emp.id);
                        const cumulImpaye = +carryover.reduce((s, c) => s + c.fiche.net_a_payer, 0).toFixed(3);
                        const displayName = [emp.prenom, emp.nom].filter(Boolean).join(' ') || 'Sans nom';
                        const color = avatarColor(displayName);
                        return (
                          <motion.tr
                            key={emp.id}
                            style={{ opacity: 0.85 }}
                            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 0.85, y: 0 }} transition={{ duration: 0.2 }}
                          >
                            <td>
                              <div className="table-client-cell">
                                <div className="table-avatar" style={{ background: color }}>{getInitials(emp.prenom, emp.nom)}</div>
                                <div>
                                  <div className="table-client-name">
                                    {displayName}
                                    <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#6b7280', background: 'rgba(107,114,128,0.1)', border: '1px solid rgba(107,114,128,0.25)', borderRadius: 4, padding: '1px 5px', verticalAlign: 'middle' }}>
                                      Archiv&eacute;
                                    </span>
                                  </div>
                                  <div className="table-client-mf">{emp.poste || '—'}{emp.departement ? ` · ${emp.departement}` : ''}</div>
                                  <div style={{ marginTop: 4 }}>
                                    <span
                                      className="dec-carryover-badge"
                                      title={carryover.map((c) => `${c.label} : ${fmt(c.fiche.net_a_payer)} TND`).join('\n')}
                                    >
                                      {carryover.length} mois report&eacute;{carryover.length > 1 ? 's' : ''} · {fmt(cumulImpaye)} TND
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="sal-num" style={{ color: 'var(--faint)' }}>—</td>
                            <td className="sal-num" style={{ color: 'var(--faint)' }}>—</td>
                            <td className="sal-num" style={{ color: 'var(--faint)' }}>—</td>
                            <td className="sal-num sal-num--net">{fmt(cumulImpaye)}</td>
                            <td className="sal-num" style={{ color: 'var(--faint)' }}>—</td>
                            <td><span style={{ color: 'var(--faint)', fontSize: 11 }}>—</span></td>
                            <td>
                              <button className="dec-btn dec-btn--green dec-btn--sm" onClick={() => setPayingEmp(emp)}>
                                Payer ({carryover.length} mois)
                              </button>
                            </td>
                            <td></td>
                          </motion.tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              {/* Payer tout */}
              {(() => {
                const unpaid = activeEmployees.filter((e) => !getAdjustment(e.id).salaire_paye);
                if (unpaid.length === 0) return null;
                return (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                    <motion.button
                      whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.02 }}
                      onClick={() => setBulkPayOpen(true)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 999, border: 'none', background: '#16a34a', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 2px 10px rgba(22,163,74,0.3)' }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{ width: 14, height: 14 }}>
                        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
                      </svg>
                      Payer tout ({unpaid.length})
                    </motion.button>
                  </div>
                );
              })()}

              {/* ── Historique des paiements ── */}
              {(() => {
                // Build employee lookup for name/poste
                const empById = new Map(employees.map((e) => [e.id, e]));

                // 1. All salary_partials records whose PAYMENT DATE falls in the viewing month
                const events: { empId: string; empName: string; poste: string; salaryMois: string; montant: number; type: 'Versement' | 'Paiement final'; date: string; key: string }[] = [];
                const coveredKeys = new Set<string>(); // employeeId|salaryMois already added via partials

                partials
                  .filter((p) => p.date.startsWith(mois))
                  .forEach((p) => {
                    const emp = empById.get(p.employee_id);
                    if (!emp) return;
                    const displayName = [emp.prenom, emp.nom].filter(Boolean).join(' ') || 'Sans nom';
                    const adj = getAdjustmentForMois(p.employee_id, p.mois);
                    const type = adj.salaire_paye ? 'Paiement final' : 'Versement';
                    events.push({ empId: p.employee_id, empName: displayName, poste: emp.poste || '—', salaryMois: p.mois, montant: p.montant, type, date: p.date, key: p.id });
                    coveredKeys.add(`${p.employee_id}|${p.mois}`);
                  });

                // 2. Legacy full payments (salaire_paye=true, date_paiement in viewing month)
                //    that have no salary_partials record (pre-partials-table payments)
                getPaymentsInPaymentMois(mois).forEach(({ employeeId, salaryMois, date_paiement, snap_net_a_payer }) => {
                  if (coveredKeys.has(`${employeeId}|${salaryMois}`)) return; // already shown via partials
                  const emp = empById.get(employeeId);
                  if (!emp) return;
                  const displayName = [emp.prenom, emp.nom].filter(Boolean).join(' ') || 'Sans nom';
                  events.push({ empId: employeeId, empName: displayName, poste: emp.poste || '—', salaryMois, montant: snap_net_a_payer, type: 'Paiement final', date: date_paiement, key: `legacy-${employeeId}-${salaryMois}` });
                });

                events.sort((a, b) => b.date.localeCompare(a.date));
                if (events.length === 0) return null;
                return (
                  <div className="dec-card" style={{ marginTop: 24 }}>
                    <div className="dec-card-title">Historique des paiements — {moisLabel}</div>
                    <table className="dec-table">
                      <thead>
                        <tr>
                          <th>Employ&eacute;</th>
                          <th>Mois du salaire</th>
                          <th>Type</th>
                          <th>Montant vers&eacute;</th>
                          <th>Date de paiement</th>
                        </tr>
                      </thead>
                      <tbody>
                        {events.map((ev) => {
                          const color = avatarColor(ev.empName);
                          const isVersement = ev.type === 'Versement';
                          return (
                            <tr key={ev.key}>
                              <td>
                                <div className="table-client-cell">
                                  <div className="table-avatar" style={{ background: color, width: 28, height: 28, fontSize: 10 }}>{ev.empName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}</div>
                                  <div>
                                    <div style={{ fontWeight: 600, fontSize: 13 }}>{ev.empName}</div>
                                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{ev.poste}</div>
                                  </div>
                                </div>
                              </td>
                              <td style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'capitalize' }}>
                                {new Date(ev.salaryMois + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                              </td>
                              <td>
                                <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: isVersement ? 'rgba(3,105,161,0.1)' : 'rgba(22,163,74,0.1)', color: isVersement ? '#0369a1' : '#16a34a' }}>
                                  {ev.type}
                                </span>
                              </td>
                              <td className="num" style={{ color: '#16a34a', fontWeight: 700 }}>{fmt(ev.montant)} TND</td>
                              <td style={{ color: 'var(--muted)', fontSize: 12 }}>
                                {new Date(ev.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
              </>
            )}
          </motion.div>
        )}

        {/* ══════════ TAB: EMPLOYÉS ══════════ */}
        {tab === 'employes' && (
          <motion.div key="employes" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>

            {/* Toolbar — mirrors clients page header-right */}
            <div className="dec-toolbar" style={{ justifyContent: 'space-between', marginBottom: 20 }}>
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>
                {employees.filter((e) => e.archived_at == null || e.date_retour != null).length} employ&eacute;{employees.filter((e) => e.archived_at == null || e.date_retour != null).length !== 1 ? 's' : ''}
                {archivedEmployees.length > 0 && ` · ${archivedEmployees.length} archivé${archivedEmployees.length > 1 ? 's' : ''}`}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* View toggle */}
                <div className="view-toggle">
                  <motion.button
                    className={`view-toggle-btn${viewMode === 'grid' ? ' active' : ''}`}
                    onClick={() => setViewMode('grid')}
                    whileTap={{ scale: 0.9 }}
                    title="Vue grille"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                  </motion.button>
                  <motion.button
                    className={`view-toggle-btn${viewMode === 'table' ? ' active' : ''}`}
                    onClick={() => setViewMode('table')}
                    whileTap={{ scale: 0.9 }}
                    title="Vue tableau"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                  </motion.button>
                </div>
                {/* Add button */}
                <motion.button
                  className="btn-add-client"
                  style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}
                  onClick={() => setIrppOpen(true)}
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ scale: 1.03 }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
                  Bar&egrave;me IRPP
                </motion.button>
                <motion.button className="btn-add-client" onClick={() => setModalEmp('new')} whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.03 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Ajouter un employ&eacute;
                </motion.button>
              </div>
            </div>

            {/* Empty state */}
            {employees.filter((e) => e.archived_at == null || e.date_retour != null).length === 0 && archivedEmployees.length === 0 ? (
              <div className="dec-empty">
                <p>Aucun employ&eacute;</p>
                <span>Cr&eacute;ez un profil employ&eacute; pour commencer la gestion de la paie.</span>
              </div>

            ) : viewMode === 'grid' ? (
              /* ── CARD GRID VIEW ── */
              <>
              <div className="clients-grid">
                {employees.filter((e) => e.archived_at == null || e.date_retour != null).map((emp, i) => {
                  const displayName = [emp.prenom, emp.nom].filter(Boolean).join(' ') || 'Sans nom';
                  const color = avatarColor(displayName);
                  return (
                    <motion.div
                      key={emp.id}
                      className="client-card"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.22 }}
                    >
                      {/* Card top: avatar + name + actions */}
                      <div className="client-card-top">
                        <div className="client-avatar" style={{ background: color, borderRadius: 14, fontSize: 16, fontWeight: 700, color: '#fff' }}>
                          {getInitials(emp.prenom, emp.nom)}
                        </div>
                        <div className="client-card-identity">
                          <div className="client-card-name">{displayName}</div>
                          <div className="client-card-mf">
                            {[emp.poste, emp.departement].filter(Boolean).join(' · ') || 'Aucun poste'}
                          </div>
                        </div>
                        <div className="client-card-actions">
                          <motion.button title="Modifier" onClick={() => setModalEmp(emp)} whileTap={{ scale: 0.85 }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </motion.button>
                          <motion.button
                            title="Réviser le contrat / salaire"
                            style={{ color: '#2563eb' }}
                            onClick={() => setContractChangeEmp(emp)}
                            whileTap={{ scale: 0.85 }}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                              <polyline points="14 2 14 8 20 8"/>
                              <path d="M9 15l2 2 4-4"/>
                            </svg>
                          </motion.button>
                          <motion.button title="Archiver l'employé" className="client-action-archive" onClick={() => setArchiveTarget(emp)} whileTap={{ scale: 0.85 }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>
                            </svg>
                          </motion.button>
                        </div>
                      </div>

                      {/* Card body: contract tag + key stats */}
                      <div className="client-card-body">
                        <div className="client-stats-row">
                          <div className="client-stat">
                            <span className="client-stat-label">Contrat</span>
                            <span className="client-stat-value" style={{ fontSize: 13 }}>
                              <span className={`table-tag table-tag--${contractColor(emp.type_contrat)}`} style={{ fontSize: 11 }}>
                                <span className="tag-dot" />{emp.type_contrat || '—'}
                              </span>
                            </span>
                          </div>
                          <div className="client-stat">
                            <span className="client-stat-label">Depuis</span>
                            <span className="client-stat-value" style={{ fontSize: 13 }}>{fmtDate(emp.date_debut)}</span>
                          </div>
                          <div className="client-stat">
                            <span className="client-stat-label">Salaire net</span>
                            <span className="client-stat-value" style={{ fontSize: 13 }}>
                              {emp.salaire_base ? `${fmt(emp.salaire_base)} TND` : '—'}
                              {getEmployeeHistory(emp.id).length > 0 && (
                                <span
                                  title={`${getEmployeeHistory(emp.id).length} révision(s)`}
                                  style={{ marginLeft: 5, fontSize: 10, fontWeight: 700, color: '#2563eb', background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: 4, padding: '1px 5px', verticalAlign: 'middle', cursor: 'pointer' }}
                                  onClick={() => setContractChangeEmp(emp)}
                                >
                                  {getEmployeeHistory(emp.id).length} rév.
                                </span>
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="client-info-rows">
                          {emp.cin && (
                            <div className="client-info-row">
                              <span className="client-info-row-label">CIN</span>
                              <span className="client-info-row-value">{emp.cin}</span>
                            </div>
                          )}
                          {emp.telephone && (
                            <div className="client-info-row">
                              <span className="client-info-row-label">T&eacute;l&eacute;phone</span>
                              <span className="client-info-row-value">{emp.telephone}</span>
                            </div>
                          )}
                          {emp.email && (
                            <div className="client-info-row">
                              <span className="client-info-row-label">Email</span>
                              <span className="client-info-row-value">{emp.email}</span>
                            </div>
                          )}
                          {emp.banque && (
                            <div className="client-info-row">
                              <span className="client-info-row-label">Banque</span>
                              <span className="client-info-row-value">{emp.banque}</span>
                            </div>
                          )}
                          {emp.rib && (
                            <div className="client-info-row">
                              <span className="client-info-row-label">RIB</span>
                              <span className="client-info-row-value" style={{ fontVariantNumeric: 'tabular-nums' }}>{emp.rib}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* ── Archived employees section (grid) ── */}
              {archivedEmployees.length > 0 && (
                <div className="emp-archived-section">
                  <div className="emp-archived-hdr">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ width: 14, height: 14 }}>
                      <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/>
                    </svg>
                    Archivés ({archivedEmployees.length})
                  </div>
                  <div className="clients-grid" style={{ opacity: 0.6 }}>
                    {archivedEmployees.map((emp) => {
                      const displayName = [emp.prenom, emp.nom].filter(Boolean).join(' ') || 'Sans nom';
                      return (
                        <div key={emp.id} className="client-card emp-archived-card">
                          <div className="client-card-top">
                            <div className="client-avatar" style={{ background: '#94a3b8', borderRadius: 14, fontSize: 16, fontWeight: 700, color: '#fff' }}>
                              {getInitials(emp.prenom, emp.nom)}
                            </div>
                            <div className="client-card-identity">
                              <div className="client-card-name" style={{ textDecoration: 'line-through', color: 'var(--muted)' }}>{displayName}</div>
                              <div className="client-card-mf">Archivé le {fmtDate(emp.archived_at)}</div>
                            </div>
                            <div className="client-card-actions">
                              <motion.button title="Réactiver l'employé" onClick={() => setRestoreTarget(emp)} whileTap={{ scale: 0.85 }}
                                style={{ color: '#16a34a' }}
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 .49-3"/></svg>
                              </motion.button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              </>

            ) : (
              /* ── TABLE VIEW ── */
              <>
              <div className="clients-table-wrap">
                <table className="clients-table">
                  <thead>
                    <tr>
                      <th><div className="th-inner">Employ&eacute;</div></th>
                      <th><div className="th-inner">CIN</div></th>
                      <th><div className="th-inner">Contrat</div></th>
                      <th><div className="th-inner">D&eacute;but</div></th>
                      <th><div className="th-inner">T&eacute;l&eacute;phone</div></th>
                      <th><div className="th-inner">Email</div></th>
                      <th><div className="th-inner">Banque / RIB</div></th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.filter((e) => e.archived_at == null || e.date_retour != null).map((emp, i) => {
                      const displayName = [emp.prenom, emp.nom].filter(Boolean).join(' ') || 'Sans nom';
                      const color = avatarColor(displayName);
                      return (
                        <motion.tr key={emp.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04, duration: 0.2 }}>
                          <td>
                            <div className="table-client-cell">
                              <div className="table-avatar" style={{ background: color }}>{getInitials(emp.prenom, emp.nom)}</div>
                              <div>
                                <div className="table-client-name">{displayName}</div>
                                <div className="table-client-mf">{emp.poste || '—'}{emp.departement ? ` · ${emp.departement}` : ''}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ color: 'var(--muted)', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{emp.cin || '—'}</td>
                          <td>
                            <span className={`table-tag table-tag--${contractColor(emp.type_contrat)}`}>
                              <span className="tag-dot" />{emp.type_contrat || '—'}
                            </span>
                          </td>
                          <td style={{ color: 'var(--muted)', fontSize: 12 }}>{fmtDate(emp.date_debut)}</td>
                          <td style={{ color: 'var(--muted)', fontSize: 12 }}>{emp.telephone || '—'}</td>
                          <td style={{ color: 'var(--muted)', fontSize: 12 }}>{emp.email || '—'}</td>
                          <td style={{ fontSize: 12 }}>
                            {emp.banque ? (
                              <div>
                                <div style={{ fontWeight: 600, color: 'var(--text)' }}>{emp.banque}</div>
                                <div style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{emp.rib || '—'}</div>
                              </div>
                            ) : '—'}
                          </td>
                          <td>
                            <div className="table-row-actions">
                              <button className="table-edit-btn" title="Modifier" onClick={() => setModalEmp(emp)}>
                                <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              </button>
                              <button className="table-edit-btn" title="Réviser le contrat / salaire" style={{ color: '#2563eb' }} onClick={() => setContractChangeEmp(emp)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                                  <polyline points="14 2 14 8 20 8"/>
                                  <path d="M9 15l2 2 4-4"/>
                                </svg>
                              </button>
                              <button className="table-edit-btn table-archive-btn" title="Archiver" onClick={() => setArchiveTarget(emp)}>
                                <svg viewBox="0 0 24 24"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                    {/* Archived rows in table */}
                    {archivedEmployees.map((emp) => {
                      const displayName = [emp.prenom, emp.nom].filter(Boolean).join(' ') || 'Sans nom';
                      return (
                        <tr key={emp.id} style={{ opacity: 0.5 }}>
                          <td>
                            <div className="table-client-cell">
                              <div className="table-avatar" style={{ background: '#94a3b8' }}>{getInitials(emp.prenom, emp.nom)}</div>
                              <div>
                                <div className="table-client-name" style={{ textDecoration: 'line-through' }}>{displayName}</div>
                                <div className="table-client-mf">Archivé {fmtDate(emp.archived_at)}</div>
                              </div>
                            </div>
                          </td>
                          <td colSpan={6} style={{ color: 'var(--muted)', fontSize: 12 }}>
                            {emp.poste || '—'} · {emp.type_contrat}
                          </td>
                          <td>
                            <div className="table-row-actions">
                              <button className="table-edit-btn" title="Réactiver" onClick={() => setRestoreTarget(emp)} style={{ color: '#16a34a' }}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 .49-3"/></svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              </>
            )}

            {/* ── Historique des contrats ── */}
            {(() => {
              const allHistory = employees
                .flatMap(emp => getEmployeeHistory(emp.id).map(h => ({ ...h, emp })))
                .filter(h => h.note !== 'Contrat initial')
                .sort((a, b) => b.effective_from.localeCompare(a.effective_from));
              if (allHistory.length === 0) return null;
              return (
                <div className="dec-card" style={{ marginTop: 24 }}>
                  <div className="dec-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15, color: 'var(--accent)' }}>
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                    Historique des révisions de contrat
                  </div>
                  <table className="dec-table">
                    <thead>
                      <tr>
                        <th>Employé</th>
                        <th>Date effective</th>
                        <th>Modifications</th>
                        <th>Note</th>
                        <th>Enregistré le</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allHistory.map(h => {
                        const displayName = [h.emp.prenom, h.emp.nom].filter(Boolean).join(' ') || 'Sans nom';
                        const color = avatarColor(displayName);
                        const empFullHistory = getEmployeeHistory(h.emp.id);
                        const idx = empFullHistory.findIndex(e => e.id === h.id);
                        const prevEntry = idx >= 0 && idx < empFullHistory.length - 1 ? empFullHistory[idx + 1] : undefined;
                        const diffs = prevEntry ? computeContractDiff(h, prevEntry) : [];
                        const isInitial = !prevEntry;
                        return (
                          <tr key={h.id}>
                            <td>
                              <div className="table-client-cell">
                                <div className="table-avatar" style={{ background: color, width: 28, height: 28, fontSize: 10 }}>
                                  {getInitials(h.emp.prenom, h.emp.nom)}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: 13 }}>{displayName}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ fontWeight: 600, fontSize: 13 }}>
                              {new Date(h.effective_from).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                            </td>
                            <td>
                              {isInitial ? (
                                <span style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>Contrat initial</span>
                              ) : diffs.length > 0 ? (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                                  {diffs.map((d, j) => (
                                    <span key={j} style={{
                                      display: 'inline-flex', alignItems: 'center', gap: 3,
                                      fontSize: 10, borderRadius: 999, padding: '2px 7px',
                                      background: 'rgba(232,98,26,0.06)', border: '1px solid rgba(232,98,26,0.16)',
                                    }}>
                                      <span style={{ color: 'var(--muted)', fontWeight: 600 }}>{d.label}</span>
                                      <span style={{ color: 'var(--faint)', textDecoration: 'line-through' }}>{d.from}</span>
                                      <svg viewBox="0 0 16 16" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" style={{ width: 9, height: 9, flexShrink: 0 }}><path d="M3 8h10M9 4l4 4-4 4"/></svg>
                                      <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{d.to}</span>
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span style={{ fontSize: 11, color: 'var(--faint)', fontStyle: 'italic' }}>—</span>
                              )}
                            </td>
                            <td style={{ color: 'var(--muted)', fontSize: 12, fontStyle: h.note ? 'normal' : 'italic' }}>
                              {h.note || '—'}
                            </td>
                            <td style={{ color: 'var(--faint)', fontSize: 11 }}>
                              {new Date(h.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}

          </motion.div>
        )}

      </AnimatePresence>
      )} {/* end loading conditional */}

      {/* Barème IRPP modal */}
      <IrppBaremeModal
        open={irppOpen}
        onClose={() => setIrppOpen(false)}
        currentBareme={currentBareme}
        onSave={handleIrppSave}
        saving={saving}
      />

      {/* Create / Edit modal */}
      <EmployeeModal
        open={modalEmp !== null}
        employee={modalEmp !== 'new' ? modalEmp : null}
        saving={saving}
        onClose={() => setModalEmp(null)}
        onSave={handleSave}
        currentGlobalBareme={currentBareme}
        initialSettings={modalEmp && modalEmp !== 'new' ? getPayrollSettingsForMonth((modalEmp as Employee).id, mois) : undefined}
        rates={rates}
      />

      {/* Payslip modal */}
      {payslipEmp && (() => {
        const contract = getContractForMonth(payslipEmp.id, mois, { salaire_base: payslipEmp.salaire_base, type_contrat: payslipEmp.type_contrat });
        const historicalEmp = (contract.salaire_base !== payslipEmp.salaire_base || contract.type_contrat !== payslipEmp.type_contrat)
          ? { ...payslipEmp, salaire_base: contract.salaire_base, type_contrat: contract.type_contrat as Employee['type_contrat'] }
          : payslipEmp;
        const rawSettings = getPayrollSettingsForMonth(payslipEmp.id, mois);
        const payslipSettings: EmployeePayrollSettings = {
          ...rawSettings,
          overrides: { ...rawSettings.overrides, irpp_brackets: rawSettings.overrides.irpp_brackets ?? getBaremeForMois(mois) },
        };
        return (
          <PayslipDrawer
            emp={historicalEmp}
            mois={mois}
            rates={rates}
            mensuel={getAdjustment(payslipEmp.id)}
            empSettings={payslipSettings}
            onClose={() => setPayslipEmp(null)}
          />
        );
      })()}

      {/* Monthly adjustment modal */}
      {adjEmp && (
        <AjustementModal
          open={true}
          emp={adjEmp}
          mois={mois}
          mensuel={getAdjustment(adjEmp.id)}
          onClose={() => setAdjEmp(null)}
          onSave={(elements) => setElements(adjEmp.id, elements)}
        />
      )}

      {/* Ordre de virement PDF modal */}
      <OrdreVirementModal
        open={ordreVirementOpen}
        employees={activeEmployees}
        fiches={fiches}
        mois={mois}
        moisLabel={moisLabel}
        onClose={() => setOrdreVirementOpen(false)}
      />

      {/* Bulk pay modal */}
      <BulkPayModal
        open={bulkPayOpen}
        unpaidEmployees={activeEmployees.filter((e) => !getAdjustment(e.id).salaire_paye)}
        fiches={fiches}
        moisLabel={moisLabel}
        onClose={() => setBulkPayOpen(false)}
        onConfirm={(ids, dateISO) => {
          ids.forEach((id) => marquerPaye(id, dateISO));
          setBulkPayOpen(false);
        }}
      />

      {/* Multi-month payment modal */}
      <SalaryPaymentModal
        open={payingEmp !== null}
        emp={payingEmp}
        currentMois={mois}
        currentMoisLabel={moisLabel}
        currentFiche={payingEmp ? fiches.get(payingEmp.id) ?? null : null}
        currentPaye={payingEmp ? getAdjustment(payingEmp.id).salaire_paye : false}
        currentMontantPaye={payingEmp ? (fiches.get(payingEmp.id)?.acompte ?? 0) : 0}
        carryover={payingEmp ? getCarryover(payingEmp.id) : []}
        onClose={() => setPayingEmp(null)}
        onConfirm={(selected) => {
          if (!payingEmp) return;
          selected.forEach(({ moisKey, fiche, dateISO, amount }) => {
            marquerPartiellementPaye(payingEmp.id, moisKey, amount, fiche, dateISO);
          });
          setPayingEmp(null);
        }}
      />

      {/* Archive date modal */}
      <AnimatePresence>
        {archiveTarget && (
          <ArchiveDateModal
            employee={archiveTarget}
            onConfirm={handleArchiveConfirm}
            onClose={() => setArchiveTarget(null)}
            isPaidMonth={(m) => getAdjustmentForMois(archiveTarget.id, m).salaire_paye}
          />
        )}
      </AnimatePresence>

      {/* Restore date modal */}
      <AnimatePresence>
        {restoreTarget && (
          <RestoreDateModal
            employee={restoreTarget}
            onConfirm={handleRestoreConfirm}
            onClose={() => setRestoreTarget(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
