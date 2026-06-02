-- V1__init.sql
-- Core: extensions, shared trigger function, local auth users table
-- (replaces Supabase auth.users).

create extension if not exists "pgcrypto";

-- Shared updated_at trigger function
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

-- ── app_users ────────────────────────────────────────────────────────────────
-- Local authentication. Other tables reference this via FK on app_users(id).
create table app_users (
    id              uuid          primary key default gen_random_uuid(),
    email           varchar(320)  not null unique,
    password_hash   varchar(255),                 -- nullable: OAuth-only accounts
    email_verified  boolean       not null default false,
    provider        varchar(32)   not null default 'local',  -- 'local' | 'google'
    provider_id     varchar(255),
    banned_until    timestamptz,
    created_at      timestamptz   not null default now(),
    updated_at      timestamptz   not null default now()
);

create index app_users_provider_id_idx on app_users (provider, provider_id);

create trigger app_users_updated_at
    before update on app_users
    for each row execute function set_updated_at();

-- ── refresh_tokens ───────────────────────────────────────────────────────────
create table refresh_tokens (
    id          uuid        primary key default gen_random_uuid(),
    user_id     uuid        not null references app_users(id) on delete cascade,
    token_hash  varchar(255) not null unique,
    expires_at  timestamptz not null,
    revoked_at  timestamptz,
    user_agent  varchar(512),
    ip          varchar(64),
    created_at  timestamptz not null default now()
);

create index refresh_tokens_user_idx on refresh_tokens (user_id);
create index refresh_tokens_expires_idx on refresh_tokens (expires_at) where revoked_at is null;
