/* ── Décaissements – shared types ── */

/* ── Salaires ── */

export interface GainsOptionnels {
  prime: number;
  bonus: number;
  commission: number;
  heures_supp: number;
  indemnite_transport: number;
  indemnite_repas: number;
  indemnite_internet: number;
}

export interface AutresRetenues {
  avances: number;
  absences: number;
}

export type ContractType = 'CDI' | 'CDD' | 'CIVP' | 'Stage' | 'Freelance';
export type SituationFamiliale = 'Célibataire' | 'Marié(e)' | 'Divorcé(e)' | 'Veuf/Veuve';

export interface Employee {
  id: string;

  /* ── Identité ── */
  nom: string;
  prenom: string;
  cin: string;
  date_naissance: string;       // ISO date
  lieu_naissance: string;
  situation_familiale: SituationFamiliale;
  enfants: number;
  adresse: string;
  telephone: string;
  email: string;

  /* ── Contrat ── */
  poste: string;
  departement: string;
  type_contrat: ContractType;
  date_debut: string;           // ISO date
  date_fin: string | null;      // ISO date, null for CDI
  numero_cnss: string;

  /* ── Banque ── */
  banque: string;
  rib: string;

  /* ── Rémunération ── */
  salaire_base: number;
  gains: GainsOptionnels;
  retenues: AutresRetenues;

  /** Set when the employee is archived (soft-delete). null = still active. */
  archived_at: string | null;
  /** Set when the employee is reactivated after archiving. Keeps archived_at for historical pro-ration. */
  date_retour: string | null;

  created_at: string;
  updated_at: string;
}

export interface FichesPaie {
  salaire_brut: number;         // base brut (from brutFromNet on salaire_base)
  bonus: number;                // gross bonus this month (taxed)
  deduction_absences: number;   // (brut_total/22) * jours_absent
  brut_effectif: number;        // brut + bonus - deduction_absences
  cnss_salarie: number;           // CNSS salarié (on cnss_base)
  salaire_imposable: number;      // irpp_base − cnss  (base for abattement)
  abattement_amount: number;      // salaire_imposable × abattement rate
  revenu_net_imposable: number;   // salaire_imposable × (1 − abattement) — IRPP base
  irpp_mensuel: number;           // irppAnnuel(revenu_net_imposable × 12) / 12
  solidarity_salarie: number;     // contribution sociale (on salaire_imposable)
  net: number;                  // net salary due (before acompte deduction)
  acompte: number;              // advance already paid this month
  net_a_payer: number;          // net - acompte (actual transfer amount)
  charges_employeur: number;
  cout_total: number;
  /** Breakdown of employer charges (2026 barème) */
  detail_employeur: {
    cnss: number;      // CNSS patronale consolidée (16,57%)
    tfp: number;       // TFP (1%)
    foprolos: number;  // FOPROLOS (1%)
    at: number;        // Accidents de travail (0,4%)
  };
}

/* ── Cycle mensuel ── */

export type SalaryElementType = 'gain' | 'deduction' | 'net_only';
export type SalaryElementUnit = 'TND' | 'days';

export interface SalaryElement {
  id: string;
  name: string;
  description?: string;
  /** Visual variant for the icon swatch — matches existing adj-field-icon-- modifiers */
  icon?: 'green' | 'amber' | 'red';
  type: SalaryElementType;
  amount: number;
  unit: SalaryElementUnit;
  enabled: boolean;
  affects_brut: boolean;
  affects_cnss: boolean;
  affects_irpp: boolean;
}

/** Default elements seeded into a fresh month — shown as a fixed 3×3 grid in the adjustment modal. */
export const DEFAULT_SALARY_ELEMENTS: SalaryElement[] = [
  {
    id: 'bonus', name: 'Bonus brut',
    description: 'Montant brut ajouté au salaire ce mois',
    icon: 'green', type: 'gain', amount: 0, unit: 'TND', enabled: false,
    affects_brut: true, affects_cnss: true, affects_irpp: true,
  },
  {
    id: 'transport', name: 'Indemnité de transport',
    description: 'Indemnité de déplacement domicile-travail',
    icon: 'green', type: 'gain', amount: 0, unit: 'TND', enabled: false,
    affects_brut: true, affects_cnss: true, affects_irpp: true,
  },
  {
    id: 'prime_presence', name: 'Prime de présence',
    description: 'Prime liée à la présence effective',
    icon: 'green', type: 'gain', amount: 0, unit: 'TND', enabled: false,
    affects_brut: true, affects_cnss: true, affects_irpp: true,
  },
  {
    id: 'prime_exceptionnelle', name: 'Prime exceptionnelle',
    description: 'Prime non récurrente accordée ce mois',
    icon: 'green', type: 'gain', amount: 0, unit: 'TND', enabled: false,
    affects_brut: true, affects_cnss: true, affects_irpp: true,
  },
  {
    id: 'heures_supp', name: 'Heures supplémentaires',
    description: 'Heures travaillées au-delà du temps normal',
    icon: 'green', type: 'gain', amount: 0, unit: 'TND', enabled: false,
    affects_brut: true, affects_cnss: true, affects_irpp: true,
  },
  {
    id: 'avantage_nature', name: 'Avantage en nature',
    description: 'Avantage non monétaire accordé au salarié',
    icon: 'amber', type: 'gain', amount: 0, unit: 'TND', enabled: false,
    affects_brut: true, affects_cnss: true, affects_irpp: true,
  },
  {
    id: 'acompte', name: 'Acompte',
    description: 'Avance déjà versée → déduite du virement net',
    icon: 'amber', type: 'net_only', amount: 0, unit: 'TND', enabled: false,
    affects_brut: false, affects_cnss: false, affects_irpp: false,
  },
  {
    id: 'absence', name: "Jours d'absence",
    description: 'Retenue = brut / 22 × jours (base 22 j/mois)',
    icon: 'red', type: 'deduction', amount: 0, unit: 'days', enabled: false,
    affects_brut: true, affects_cnss: true, affects_irpp: true,
  },
  {
    id: 'custom', name: 'Élément personnalisé',
    description: 'Élément libre — renommez et configurez',
    icon: 'green', type: 'gain', amount: 0, unit: 'TND', enabled: false,
    affects_brut: true, affects_cnss: true, affects_irpp: true,
  },
];

/** Per-employee per-month variable adjustments + payment status */
export interface EmployeeMensuel {
  employee_id: string;
  mois: string;          // 'YYYY-MM'
  /** Dynamic configurable elements (bonus, acompte, absences, …) */
  salary_elements: SalaryElement[];
  salaire_paye: boolean; // has the salary been transferred this month?
  date_paiement: string | null; // ISO datetime when marked as paid
  montant_paye?: number; // cumulative amount actually paid (supports partial payments)
  // Frozen snapshot of computed figures saved at payment time
  snap_brut_effectif?: number;
  snap_cnss_salarie?:  number;
  snap_irpp_mensuel?:  number;
  snap_net_a_payer?:   number;
  snap_cout_total?:    number;
}
