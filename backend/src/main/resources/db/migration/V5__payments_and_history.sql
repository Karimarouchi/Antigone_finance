-- V5__payments_and_history.sql
-- Payments (one row per emitted invoice) + history snapshots and partial payments.
-- Inferred from features/payments/PaymentsPage.tsx + features/overview/OverviewPage.tsx.

create table payments (
    id              uuid           primary key default gen_random_uuid(),
    invoice_number  varchar(64)    not null,
    client_id       uuid           references clients(id) on delete set null,
    client_name     varchar(255),               -- denormalized snapshot
    date_issued     date           not null,
    sent_at         timestamptz,
    paid_at         timestamptz,
    status          varchar(16)    not null default 'draft'
                    check (status in ('draft','pending','partial','paid','cancelled')),
    total_ht        numeric(12,3)  not null default 0,
    total_tva       numeric(12,3)  not null default 0,
    total_ttc       numeric(12,3)  not null default 0,
    amount_paid     numeric(12,3)  not null default 0,
    pdf_key         varchar(255),               -- key into storage
    notes           text,
    created_at      timestamptz    not null default now(),
    updated_at      timestamptz    not null default now()
);

create index payments_invoice_number_idx on payments (invoice_number);
create index payments_status_idx          on payments (status);
create index payments_date_issued_idx     on payments (date_issued desc);

create trigger payments_updated_at
    before update on payments
    for each row execute function set_updated_at();


create table payment_partials (
    id          uuid          primary key default gen_random_uuid(),
    payment_id  uuid          not null references payments(id) on delete cascade,
    montant     numeric(12,3) not null check (montant > 0),
    date        date          not null,
    note        text          not null default '',
    created_at  timestamptz   not null default now()
);

create index payment_partials_payment_idx on payment_partials (payment_id);


-- ── facture_history / devis_history ──────────────────────────────────────────
-- Append-only snapshot of every issued doc; supports re-emits via `version`.

create table facture_history (
    id              uuid         primary key default gen_random_uuid(),
    invoice_number  varchar(64)  not null,
    version         integer      not null default 1,
    action_type     varchar(32)  not null default 'created',  -- created | email | reissue | ...
    client_id       uuid         references clients(id) on delete set null,
    client_name     varchar(255),
    total_ht        numeric(12,3),
    total_tva       numeric(12,3),
    total_ttc       numeric(12,3),
    pdf_key         varchar(255),
    payload         jsonb,
    created_at      timestamptz  not null default now(),
    unique (invoice_number, version)
);
create index facture_history_invoice_idx on facture_history (invoice_number);


create table devis_history (
    id              uuid         primary key default gen_random_uuid(),
    devis_number    varchar(64)  not null,
    version         integer      not null default 1,
    action_type     varchar(32)  not null default 'created',
    client_id       uuid         references clients(id) on delete set null,
    client_name     varchar(255),
    total_ht        numeric(12,3),
    total_tva       numeric(12,3),
    total_ttc       numeric(12,3),
    pdf_key         varchar(255),
    payload         jsonb,
    created_at      timestamptz  not null default now(),
    unique (devis_number, version)
);
create index devis_history_devis_idx on devis_history (devis_number);
