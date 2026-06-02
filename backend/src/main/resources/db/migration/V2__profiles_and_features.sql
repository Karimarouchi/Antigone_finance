-- V2__profiles_and_features.sql
-- Profile (per app_user), roles, feature grants, invite codes.

create table profiles (
    id          uuid         primary key references app_users(id) on delete cascade,
    email       varchar(320),
    full_name   varchar(255),
    avatar_url  varchar(1024),
    role        varchar(16)  not null default 'user'
                check (role in ('user', 'admin', 'super_admin')),
    disabled    boolean      not null default false,
    created_at  timestamptz  not null default now(),
    updated_at  timestamptz  not null default now()
);

create index profiles_role_idx on profiles (id, role);

create trigger profiles_updated_at
    before update on profiles
    for each row execute function set_updated_at();


create table user_features (
    id          uuid        primary key default gen_random_uuid(),
    user_id     uuid        not null references app_users(id) on delete cascade,
    feature_id  varchar(64) not null,
    granted_at  timestamptz not null default now(),
    granted_by  uuid        references app_users(id) on delete set null,
    unique (user_id, feature_id)
);

create index user_features_user_idx on user_features (user_id);


create table invite_codes (
    id          uuid        primary key default gen_random_uuid(),
    code        varchar(64) unique not null,
    label       varchar(255),
    created_by  uuid        not null references app_users(id) on delete cascade,
    created_at  timestamptz not null default now(),
    expires_at  timestamptz,
    used_at     timestamptz,
    used_by     uuid        references app_users(id) on delete set null,
    features    text[]      not null default '{}'
);

create index invite_codes_code_idx on invite_codes (code) where used_at is null;
