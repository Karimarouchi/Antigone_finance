-- V8__autres_revenus_and_cnss.sql

create table autres_revenus (
    id           uuid          primary key default gen_random_uuid(),
    label        varchar(255)  not null,
    montant      numeric(12,3) not null check (montant > 0),
    tva_taux     numeric(5,2)  not null default 0 check (tva_taux >= 0),
    date         date          not null default current_date,
    categorie    varchar(64)   not null default 'autre',
    description  text          not null default '',
    created_at   timestamptz   not null default now(),
    updated_at   timestamptz   not null default now()
);

create index autres_revenus_date_idx on autres_revenus (date desc);

create trigger autres_revenus_updated_at
    before update on autres_revenus
    for each row execute function set_updated_at();


create table cnss_trimestre (
    id                uuid          primary key default gen_random_uuid(),
    annee             integer       not null,
    trimestre         integer       not null check (trimestre between 1 and 4),
    montant_salarie   numeric(12,3) not null default 0,
    montant_employeur numeric(12,3) not null default 0,
    montant_penalite  numeric(12,3) not null default 0,
    montant_total     numeric(12,3) not null default 0,
    date_paiement     timestamptz,
    statut            varchar(16)   not null default 'due',  -- due | payee
    created_at        timestamptz   not null default now(),
    updated_at        timestamptz   not null default now(),
    unique (annee, trimestre)
);

create trigger cnss_trimestre_updated_at
    before update on cnss_trimestre
    for each row execute function set_updated_at();


create table cnss_paiement_historique (
    id                uuid          primary key default gen_random_uuid(),
    annee             integer       not null,
    trimestre         integer       not null check (trimestre between 1 and 4),
    montant_salarie   numeric(12,3) not null,
    montant_employeur numeric(12,3) not null,
    montant_penalite  numeric(12,3) not null default 0,
    montant_total     numeric(12,3) not null,
    date_paiement     date          not null,
    note              text,
    created_at        timestamptz   not null default now()
);

create index cnss_historique_quarter_idx on cnss_paiement_historique (annee, trimestre);
