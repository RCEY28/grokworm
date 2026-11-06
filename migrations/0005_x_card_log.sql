create table if not exists x_cards (
  id         serial primary key,
  handle     text not null,
  name       text not null,
  initials   text not null,
  score      integer not null,
  level      integer not null,
  rank       integer,
  created_at timestamptz not null default now()
);

create index if not exists x_cards_handle_idx on x_cards (handle, id desc);
