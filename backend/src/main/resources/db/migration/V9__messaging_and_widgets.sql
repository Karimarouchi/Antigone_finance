-- V9__messaging_and_widgets.sql
-- Messages, notifications, user notes, calendar entries.

create table notifications (
    id          uuid         primary key default gen_random_uuid(),
    user_id     uuid         not null references app_users(id) on delete cascade,
    title       varchar(255) not null,
    body        text,
    type        varchar(16)  not null default 'info'
                check (type in ('info','success','warning','error')),
    link        varchar(512),
    read_at     timestamptz,
    created_at  timestamptz  not null default now(),
    expires_at  timestamptz
);

create index notifications_user_idx       on notifications (user_id);
create index notifications_created_at_idx on notifications (created_at desc);


create table messages (
    id            uuid        primary key default gen_random_uuid(),
    sender_id     uuid        not null references app_users(id) on delete cascade,
    recipient_id  uuid        not null references app_users(id) on delete cascade,
    content       text        not null check (char_length(content) > 0),
    reply_to_id   uuid        references messages(id) on delete set null,
    created_at    timestamptz not null default now(),
    seen_at       timestamptz,
    expires_at    timestamptz,
    pinned        boolean     not null default false,
    deleted_at    timestamptz
);

create index messages_recipient_idx on messages (recipient_id);
create index messages_sender_idx    on messages (sender_id);
create index messages_expires_idx   on messages (expires_at) where deleted_at is null;


create table user_notes (
    id          uuid         primary key default gen_random_uuid(),
    user_id     uuid         not null references app_users(id) on delete cascade,
    title       varchar(255),
    content     text,
    created_at  timestamptz  not null default now(),
    updated_at  timestamptz  not null default now()
);

create index user_notes_user_idx on user_notes (user_id);

create trigger user_notes_updated_at
    before update on user_notes
    for each row execute function set_updated_at();


create table calendar_entries (
    id          uuid         primary key default gen_random_uuid(),
    user_id     uuid         not null references app_users(id) on delete cascade,
    date        date         not null,
    title       varchar(255) not null,
    note        text,
    color       varchar(16)  not null default '#e8621a',
    created_at  timestamptz  not null default now(),
    updated_at  timestamptz  not null default now()
);

create index calendar_entries_user_date_idx on calendar_entries (user_id, date);

create trigger calendar_entries_updated_at
    before update on calendar_entries
    for each row execute function set_updated_at();
