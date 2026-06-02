-- V4__invoice_helpers.sql
-- Counters (sequence storage), saved services, document templates, client reminders.
-- Inferred from features/invoice/hooks/{useCounters, useServices, useTemplates, useReminders}.ts

create table counters (
    type          varchar(32) primary key,        -- 'facture' | 'devis'
    last_number   varchar(64) not null,           -- e.g. '2026-0042'
    updated_at    timestamptz not null default now()
);

insert into counters (type, last_number) values
    ('facture', '0000-0000'),
    ('devis',   '0000-0000')
on conflict (type) do nothing;


create table service_library (
    id           uuid         primary key default gen_random_uuid(),
    category_id  varchar(64)  not null,
    name         varchar(255) not null,
    created_at   timestamptz  not null default now(),
    unique (category_id, name)
);


create table templates (
    id          uuid         primary key default gen_random_uuid(),
    name        varchar(255) unique not null,
    data        jsonb        not null,
    created_at  timestamptz  not null default now(),
    updated_at  timestamptz  not null default now()
);

create trigger templates_updated_at
    before update on templates
    for each row execute function set_updated_at();


create table client_reminders (
    id                       uuid         primary key default gen_random_uuid(),
    client_id                uuid         not null unique references clients(id) on delete cascade,
    next_payment_date        date         not null,
    reminder_10_days_shown   boolean      not null default false,
    reminder_5_days_shown    boolean      not null default false,
    reminder_1_day_shown     boolean      not null default false,
    confirmation_status      varchar(32),
    last_denied_at           timestamptz,
    created_at               timestamptz  not null default now()
);

create index client_reminders_client_idx on client_reminders (client_id);
