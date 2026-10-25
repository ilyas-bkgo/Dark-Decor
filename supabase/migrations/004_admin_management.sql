create or replace function public.list_admins()
returns table (user_id uuid, email text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  return query
    select a.user_id, coalesce(u.email, '')::text, a.created_at
    from public.admins as a
    join auth.users as u on u.id = a.user_id
    order by pg_catalog.lower(u.email), a.created_at;
end;
$$;

create or replace function public.add_admin(p_email text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  target_user_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select u.id into target_user_id
  from auth.users as u
  where pg_catalog.lower(u.email) = pg_catalog.lower(pg_catalog.btrim(p_email))
  limit 1;

  if target_user_id is null then
    raise exception 'No account exists with this email. Create the account in Supabase Auth first.';
  end if;

  insert into public.admins as admin_row (user_id)
  values (target_user_id)
  on conflict on constraint admins_pkey do nothing;
end;
$$;

create or replace function public.remove_admin(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  remaining_admins integer;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if p_user_id = (select auth.uid()) then
    raise exception 'You cannot remove your own admin account.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(740219804);

  select pg_catalog.count(*) into remaining_admins from public.admins as admin_row;
  if remaining_admins <= 1 then
    raise exception 'Cannot remove the last admin.';
  end if;

  delete from public.admins as admin_row where admin_row.user_id = p_user_id;
end;
$$;

revoke execute on function public.list_admins() from public, anon;
revoke execute on function public.add_admin(text) from public, anon;
revoke execute on function public.remove_admin(uuid) from public, anon;
grant execute on function public.list_admins() to authenticated;
grant execute on function public.add_admin(text) to authenticated;
grant execute on function public.remove_admin(uuid) to authenticated;
