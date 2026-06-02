-- V7__charges_and_dettes.sql
-- Recurring charges (versioned defs + payments), variable charges, debts.

create table charge_fixe_def (
    id              uuid          primary key default gen_random_uuid(),
    group_id        uuid          not null default gen_random_uuid(),
    label           varchar(255)  not null,
    montant         numeric(12,3) not null default 0,
    tva_taux        numeric(5,2)  not null default 0,
    jour_echeance   integer       not null default 1
                    check (jour_echeance between 1 and 28),
    cycle_months    integer       not null default 1
                    check (cycle_months in (1, 3, 6, 12, 24, 48)),
    created_at      timestamptz   not null default now(),
    archived_at     timestamptz,
    updated_at      timestamptz   not null default now()
);

create index charge_fixe_def_group_idx on charge_fixe_def (group_id);

create trigger charge_fixe_def_updated_at
    before update on charge_fixe_def
    for each row execute function set_updated_at();


create table charge_fixe_paiement (
    id              uuid          primary key default gen_random_uuid(),
    charge_id       uuid          not null references charge_fixe_def(id) on delete cascade,
    mois            varchar(7)    not null,
    montant         numeric(12,3) not null,
    date_paiement   timestamptz   not null default now(),
    created_at      timestamptz   not null default now()
);

create index charge_fixe_paiement_charge_idx on charge_fixe_paiement (charge_id);
create index charge_fixe_paiement_mois_idx    on charge_fixe_paiement (mois);


create table charge_variable (
    id           uuid          primary key default gen_random_uuid(),
    mois         varchar(7)    not null,
    label        varchar(255)  not null,
    montant      numeric(12,3) not null default 0,
    tva_taux     numeric(5,2)  not null default 0,
    date         date          not null,
    categorie    varchar(64)   not null default 'autre',
    description  text          not null default '',
    created_at   timestamptz   not null default now(),
    updated_at   timestamptz   not null default now()
);

create index charge_variable_mois_idx on charge_variable (mois);

create trigger charge_variable_updated_at
    before update on charge_variable
    for each row execute function set_updated_at();


create table dettes (
    id             uuid          primary key default gen_random_uuid(),
    creancier      varchar(255)  not null,
    montant_total  numeric(12,3) not null check (montant_total > 0),
    montant_paye   numeric(12,3) not null default 0 check (montant_paye >= 0),
    date_echeance  date,
    notes          text          not null default '',
    archived_at    timestamptz,
    created_at     timestamptz   not null default now(),
    updated_at     timestamptz   not null default now()
);

create trigger dettes_updated_at
    before update on dettes
    for each row execute function set_updated_at();


create table dette_paiements (
    id          uuid          primary key default gen_random_uuid(),
    dette_id    uuid          not null references dettes(id) on delete cascade,
    montant     numeric(12,3) not null check (montant > 0),
    date        date          not null default current_date,
    note        text,
    created_at  timestamptz   not null default now()
);

create index dette_paiements_dette_idx on dette_paiements (dette_id);
