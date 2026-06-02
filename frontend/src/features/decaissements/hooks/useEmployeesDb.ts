import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type { Employee, GainsOptionnels, AutresRetenues } from '../types';

/* ── Row ↔ Employee mappers ── */

/** Normalize a backend date to "YYYY-MM-DD". Handles ISO strings, JSON arrays
 * ([y,m,d]) from Jackson LocalDate, and timestamp arrays/Date objects. */
function toDateStr(v: unknown): string {
  if (v == null || v === '') return '';
  if (Array.isArray(v)) {
    const [y, m = 1, d = 1] = v as number[];
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  if (typeof v === 'string') return v.length >= 10 ? v.slice(0, 10) : v;
  return '';
}

/** Normalize a backend timestamp (Instant ISO string / epoch / array) to an ISO string. */
function toIsoStr(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return new Date(v).toISOString();
  if (Array.isArray(v)) {
    const [y, mo = 1, d = 1, h = 0, mi = 0, s = 0] = v as number[];
    return new Date(Date.UTC(y, mo - 1, d, h, mi, s)).toISOString();
  }
  return null;
}

function rowToEmployee(row: Record<string, any>): Employee {
  return {
    id: row.id,
    nom: row.nom ?? '',
    prenom: row.prenom ?? '',
    cin: row.cin ?? '',
    date_naissance: toDateStr(row.date_naissance),
    lieu_naissance: row.lieu_naissance ?? '',
    situation_familiale: row.situation_familiale ?? 'Célibataire',
    enfants: row.enfants ?? 0,
    adresse: row.adresse ?? row.address ?? '',
    telephone: row.telephone ?? row.phone ?? '',
    email: row.email ?? '',
    poste: row.poste ?? '',
    departement: row.departement ?? '',
    type_contrat: row.type_contrat ?? 'CDI',
    date_debut: toDateStr(row.date_debut ?? row.date_embauche),
    date_fin: toDateStr(row.date_fin ?? row.date_sortie) || null,
    numero_cnss: row.numero_cnss ?? row.cnss_number ?? '',
    banque: row.banque ?? '',
    rib: row.rib ?? '',
    salaire_base: Number(row.salaire_base ?? 0),
    gains: (row.gains ?? {}) as GainsOptionnels,
    retenues: (row.retenues ?? {}) as AutresRetenues,
    archived_at: toIsoStr(row.archived_at),
    date_retour: toDateStr(row.date_retour) || null,
    created_at: toIsoStr(row.created_at) ?? new Date().toISOString(),
    updated_at: toIsoStr(row.updated_at) ?? new Date().toISOString(),
  };
}

function employeeToRow(emp: Partial<Employee>): Record<string, any> {
  // Backend accepts both snake_case identity fields and JSON objects directly.
  return { ...emp };
}

/* ── Hook ── */

export function useEmployeesDb() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Initial fetch */
  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      setLoading(true);
      try {
        const { data } = await api.get('/api/employees?includeArchived=true');
        if (cancelled) return;
        setEmployees((data ?? []).map(rowToEmployee));
        setError(null);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? 'Erreur de chargement');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAll();
    return () => { cancelled = true; };
  }, []);

  /* Add */
  const addEmployee = useCallback(async (partial?: Partial<Employee>) => {
    const now = new Date().toISOString();
    const newEmp: Omit<Employee, 'id'> = {
      nom: '', prenom: '', cin: '', date_naissance: '', lieu_naissance: '',
      situation_familiale: 'Célibataire', enfants: 0, adresse: '', telephone: '',
      email: '', poste: '', departement: '', type_contrat: 'CDI',
      date_debut: now.slice(0, 10), date_fin: null, numero_cnss: '',
      banque: '', rib: '', salaire_base: 0,
      gains: { prime: 0, bonus: 0, commission: 0, heures_supp: 0, indemnite_transport: 0, indemnite_repas: 0, indemnite_internet: 0 },
      retenues: { avances: 0, absences: 0 },
      archived_at: null,
      date_retour: null,
      created_at: now, updated_at: now,
      ...partial,
    };

    try {
      const { data } = await api.post('/api/employees', employeeToRow(newEmp));
      const emp = rowToEmployee(data);
      setEmployees((prev) => [...prev, emp]);
      return emp;
    } catch (e: any) {
      setError(e?.message ?? "Erreur lors de l'ajout");
      return null;
    }
  }, []);

  /* Update */
  const updateEmployee = useCallback(async (id: string, updates: Partial<Employee>) => {
    const updatedAt = new Date().toISOString();
    try {
      await api.put(`/api/employees/${id}`, employeeToRow(updates));
      setEmployees((prev) =>
        prev.map((e) => e.id === id ? { ...e, ...updates, updated_at: updatedAt } : e),
      );
    } catch (e: any) {
      setError(e?.message ?? 'Erreur de mise à jour');
    }
  }, []);

  /**
   * Soft-delete: set archived_at to the given date (last working day).
   */
  const archiveEmployee = useCallback(async (id: string, archivedAt: string) => {
    const now = new Date().toISOString();
    try {
      await api.post(`/api/employees/${id}/archive`, { archived_at: archivedAt });
      setEmployees((prev) =>
        prev.map((e) => e.id === id ? { ...e, archived_at: archivedAt, date_retour: null, updated_at: now } : e),
      );
    } catch (e: any) {
      setError(e?.message ?? "Erreur d'archivage");
    }
  }, []);

  /**
   * Reactivate an archived employee.
   */
  const restoreEmployee = useCallback(async (id: string, dateRetour: string) => {
    const now = new Date().toISOString();
    try {
      await api.post(`/api/employees/${id}/restore`, { date_retour: dateRetour });
      setEmployees((prev) =>
        prev.map((e) => e.id === id ? { ...e, date_retour: dateRetour, updated_at: now } : e),
      );
    } catch (e: any) {
      setError(e?.message ?? 'Erreur de réactivation');
    }
  }, []);

  /**
   * Hard-delete — permanently remove an employee.
   */
  const removeEmployee = useCallback(async (id: string) => {
    try {
      await api.delete(`/api/employees/${id}`);
      setEmployees((prev) => prev.filter((e) => e.id !== id));
    } catch (e: any) {
      setError(e?.message ?? 'Erreur de suppression');
    }
  }, []);

  return { employees, loading, error, addEmployee, updateEmployee, archiveEmployee, restoreEmployee, removeEmployee };
}
