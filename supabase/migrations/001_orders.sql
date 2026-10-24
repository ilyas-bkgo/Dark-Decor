create type public.order_status as enum ('new', 'confirmed', 'shipped', 'delivered', 'canceled');

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  full_name text not null check (char_length(btrim(full_name)) between 2 and 80),
  phone text not null check (phone ~ '^(0[67][0-9]{8}|\+212[67][0-9]{8})$'),
  city text not null check (char_length(btrim(city)) between 1 and 100),
  address text not null check (char_length(btrim(address)) between 5 and 300),
  offer text not null check (offer in ('one', 'two')),
  quantity integer not null check (quantity in (1, 2)),
  total_dh integer not null default 0,
  note text check (note is null or char_length(note) <= 500),
  status public.order_status not null default 'new',
  admin_note text,
  constraint orders_offer_quantity_check check (
    (offer = 'one' and quantity = 1) or (offer = 'two' and quantity = 2)
  ),
  constraint orders_total_matches_offer_check check (
    total_dh = case offer when 'one' then 149 when 'two' then 249 end
  )
);

create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index orders_created_at_idx on public.orders (created_at desc);
create index orders_status_idx on public.orders (status);
create index orders_phone_created_at_idx on public.orders (phone, created_at desc);

alter table public.orders enable row level security;
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;
revoke all on public.orders from anon, authenticated;
grant insert (full_name, phone, city, address, offer, quantity, note) on public.orders to anon;
grant select, update (status, admin_note) on public.orders to authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create policy "public can submit new orders" on public.orders
  for insert to anon with check (status = 'new');
create policy "admins can read orders" on public.orders
  for select to authenticated using ((select public.is_admin()));
create policy "admins can update orders" on public.orders
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create or replace function public.prepare_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_phone text;
  recent_orders integer;
begin
  if new.status <> 'new' then
    raise exception 'New orders must start with new status';
  end if;
  if (new.offer = 'one' and new.quantity <> 1) or (new.offer = 'two' and new.quantity <> 2) then
    raise exception 'Offer and quantity do not match';
  end if;
  new.total_dh := case new.offer when 'one' then 149 when 'two' then 249 end;
  normalized_phone := case when new.phone like '+%' then substring(new.phone from 2) else '212' || substring(new.phone from 2) end;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(normalized_phone, 0));
  select count(*) into recent_orders from public.orders o
    where (case when o.phone like '+%' then substring(o.phone from 2) else '212' || substring(o.phone from 2) end) = normalized_phone
      and o.created_at > now() - interval '1 hour';
  if recent_orders >= 5 then
    raise exception 'Order rate limit exceeded';
  end if;
  return new;
end;
$$;
create trigger orders_prepare_before_insert before insert on public.orders
  for each row execute function public.prepare_order();
revoke all on function public.prepare_order() from public, anon, authenticated;

create or replace function public.prevent_order_identity_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id <> old.id or new.created_at <> old.created_at or new.full_name <> old.full_name
    or new.phone <> old.phone or new.city <> old.city or new.address <> old.address
    or new.offer <> old.offer or new.quantity <> old.quantity or new.total_dh <> old.total_dh
    or new.note is distinct from old.note then
    raise exception 'Order details are immutable';
  end if;
  return new;
end;
$$;
create trigger orders_immutable_fields before update on public.orders
  for each row execute function public.prevent_order_identity_changes();
revoke all on function public.prevent_order_identity_changes() from public, anon, authenticated;
