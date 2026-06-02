-- V3__clients_and_contacts.sql
-- Schema inferred from features/clients/ClientsPage.tsx + features/invoice/hooks/useClients.ts
-- and features/contacts/ContactsPage.tsx.

create table clients (
    id                      uuid          primary key default gen_random_uuid(),
    name                    varchar(255)  not null,
    commercial_name         varchar(255),
    matricule_fiscale       varchar(64),
    rne                     varchar(64),
    industry                varchar(128),
    email                   varchar(320),
    email_receiver_name     varchar(255),
    email_receiver_gender   varchar(8),
    country                 varchar(64),
    city                    varchar(128),
    address                 varchar(512),
    joining_date            date,
    billing_cycle           varchar(32),  -- monthly | quarterly | semi-annual | yearly | one_shot
    logo_url                varchar(1024),
    deleted_at              timestamptz,
    created_at              timestamptz   not null default now(),
    updated_at              timestamptz   not null default now()
);

create index clients_name_idx     on clients (name);
create index clients_deleted_idx  on clients (deleted_at);

create trigger clients_updated_at
    before update on clients
    for each row execute function set_updated_at();


create table contacts (
    id              uuid          primary key default gen_random_uuid(),
    client_id       uuid          not null references clients(id) on delete cascade,
    contact_name    varchar(255)  not null,
    contact_role    varchar(128),
    contact_email   varchar(320),
    contact_phone   varchar(64),
    created_at      timestamptz   not null default now(),
    updated_at      timestamptz   not null default now()
);

create index contacts_client_idx on contacts (client_id);

create trigger contacts_updated_at
    before update on contacts
    for each row execute function set_updated_at();
