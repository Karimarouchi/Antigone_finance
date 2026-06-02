-- V10__payroll_extras.sql
-- Extends payroll tables with full feature set from factures-react-main:
--   - employees: identity, contract dates, JSON gains/retenues
--   - employee_contract_history: salary_mode + payroll_overrides
--   - new table: irpp_baremes (temporal IRPP brackets)
--   - new table: employee_payroll_settings (per-employee per-month overrides)

-- ── employees: add full identity, contract dates, JSON gains/retenues ──
alter table employees
    add column if not exists date_naissance       date,
    add column if not exists lieu_naissance       varchar(128),
    add column if not exists situation_familiale  varchar(32),
    add column if not exists enfants              integer       not null default 0,
    add column if not exists date_debut           date,
    add column if not exists date_fin             date,
    add column if not exists date_retour          date,
    add column if not exists numero_cnss          varchar(64),
    add column if not exists banque               varchar(128),
    add column if not exists gains                jsonb,
    add column if not exists retenues             jsonb;

-- Backfill date_debut from date_embauche if null (legacy)
update employees set date_debut = date_embauche where date_debut is null and date_embauche is not null;

-- ── employee_contract_history: salary mode + payroll overrides ──
alter table employee_contract_history
    add column if not exists salary_mode        varchar(8) not null default 'base',
    add column if not exists payroll_overrides  jsonb;

-- ── irpp_baremes ──────────────────────────────────────────────────────────
create table if not exists irpp_baremes (
    id              uuid       primary key default gen_random_uuid(),
    effective_from  varchar(7) not null unique,    -- 'YYYY-MM'
    brackets        jsonb      not null,           -- [{plafond:num|null, taux:num}, ...]
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);
create index if not exists irpp_baremes_effective_idx
    on irpp_baremes (effective_from desc);

drop trigger if exists irpp_baremes_updated_at on irpp_baremes;
create trigger irpp_baremes_updated_at
    before update on irpp_baremes
    for each row execute function set_updated_at();

-- ── employee_payroll_settings ─────────────────────────────────────────────
create table if not exists employee_payroll_settings (
    id              uuid       primary key default gen_random_uuid(),
    employee_id     uuid       not null references employees(id) on delete cascade,
    effective_from  varchar(7) not null,           -- 'YYYY-MM'
    salary_mode     varchar(8) not null default 'base',
    overrides       jsonb,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    unique (employee_id, effective_from)
);
create index if not exists eps_emp_eff_idx
    on employee_payroll_settings (employee_id, effective_from desc);

drop trigger if exists eps_updated_at on employee_payroll_settings;
create trigger eps_updated_at
    before update on employee_payroll_settings
    for each row execute function set_updated_at();
