-- V6__employees_and_payroll.sql
-- Employees, contract history, monthly payroll, partial salary payments.
-- Inferred from features/decaissements/**.ts + migrations/create_salaire_mensuel.sql.

create table employees (
    id                 uuid          primary key default gen_random_uuid(),
    nom                varchar(128)  not null,
    prenom             varchar(128)  not null,
    cin                varchar(32),
    email              varchar(320),
    phone              varchar(64),
    poste              varchar(128),
    departement        varchar(128),
    salaire_base       numeric(12,3) not null default 0,
    type_contrat       varchar(32)   not null default 'CDI',
    date_embauche      date,
    date_sortie        date,
    cnss_number        varchar(64),
    rib                varchar(64),
    address            varchar(512),
    archived_at        timestamptz,
    created_at         timestamptz   not null default now(),
    updated_at         timestamptz   not null default now()
);

create index employees_nom_idx on employees (nom, prenom);

create trigger employees_updated_at
    before update on employees
    for each row execute function set_updated_at();


create table employee_contract_history (
    id              uuid          primary key default gen_random_uuid(),
    employee_id     uuid          not null references employees(id) on delete cascade,
    effective_from  varchar(10)   not null,    -- 'YYYY-MM-DD'
    salaire_base    numeric(12,3) not null,
    type_contrat    varchar(32)   not null,
    poste           varchar(128),
    departement     varchar(128),
    note            text,
    created_at      timestamptz   not null default now(),
    unique (employee_id, effective_from)
);

create index employee_contract_history_emp_idx
    on employee_contract_history (employee_id, effective_from desc);


create table salaire_mensuel (
    id                  uuid          primary key default gen_random_uuid(),
    employee_id         uuid          not null references employees(id) on delete cascade,
    mois                varchar(7)    not null,        -- 'YYYY-MM'

    bonus               numeric(12,3) not null default 0,
    acompte             numeric(12,3) not null default 0,
    jours_absent        numeric(5,2)  not null default 0,
    salary_elements     jsonb,

    salaire_paye        boolean       not null default false,
    date_paiement       timestamptz,
    montant_paye        numeric(12,3) not null default 0,

    snap_brut_effectif  numeric(12,3),
    snap_cnss_salarie   numeric(12,3),
    snap_irpp_mensuel   numeric(12,3),
    snap_net_a_payer    numeric(12,3),
    snap_cout_total     numeric(12,3),

    created_at          timestamptz   not null default now(),
    updated_at          timestamptz   not null default now(),
    unique (employee_id, mois)
);

create index salaire_mensuel_mois_idx on salaire_mensuel (mois);

create trigger salaire_mensuel_updated_at
    before update on salaire_mensuel
    for each row execute function set_updated_at();


create table salary_partials (
    id          uuid          primary key default gen_random_uuid(),
    employee_id uuid          not null references employees(id) on delete cascade,
    mois        varchar(7)    not null,
    montant     numeric(12,3) not null check (montant > 0),
    date        date          not null,
    note        text          not null default '',
    created_at  timestamptz   not null default now()
);

create index salary_partials_emp_mois on salary_partials (employee_id, mois);
