-- One versioned record per owner/date. NULL payload is a durable deletion tombstone.
create table public.daylog_entries (
 user_id uuid not null references auth.users(id) on delete cascade,
 date date not null,
 entry jsonb,
 version uuid not null,
 updated_at timestamptz not null default now(),
 primary key (user_id, date),
 constraint valid_entry check (entry is null or (jsonb_typeof(entry) = 'object' and entry->>'date' = date::text and entry ? 'id'))
);
alter table public.daylog_entries enable row level security;
revoke all on public.daylog_entries from public, anon, authenticated;
grant select, insert, update on public.daylog_entries to authenticated;
create policy daylog_owner_read on public.daylog_entries for select to authenticated
 using ((select auth.uid()) = user_id);
create policy daylog_owner_insert on public.daylog_entries for insert to authenticated
 with check ((select auth.uid()) = user_id);
create policy daylog_owner_update on public.daylog_entries for update to authenticated
 using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Invoker rights retain RLS. The caller never supplies an owner ID.
create function public.daylog_write_entry(p_date date, p_entry jsonb, p_expected uuid, p_version uuid)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare result uuid;
begin
 if auth.uid() is null then raise exception 'authentication_required'; end if;
 if p_expected is null then
  insert into public.daylog_entries(user_id, date, entry, version)
  values (auth.uid(), p_date, p_entry, p_version)
  on conflict (user_id, date) do nothing returning version into result;
 else
  update public.daylog_entries set entry = p_entry, version = p_version, updated_at = now()
  where user_id = auth.uid() and date = p_date and version = p_expected
  returning version into result;
 end if;
 if result is null then
  select version into result from public.daylog_entries
  where user_id = auth.uid() and date = p_date and version = p_version;
 end if;
 if result is null then raise exception 'sync_conflict' using errcode = 'P0001'; end if;
 return result;
end;
$$;
revoke all on function public.daylog_write_entry(date,jsonb,uuid,uuid) from public, anon;
grant execute on function public.daylog_write_entry(date,jsonb,uuid,uuid) to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('daylog-photos', 'daylog-photos', false, 10485760, array['image/webp','image/jpeg','image/png']);
create policy daylog_photo_read on storage.objects for select to authenticated
 using (bucket_id = 'daylog-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy daylog_photo_insert on storage.objects for insert to authenticated
 with check (bucket_id = 'daylog-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy daylog_photo_update on storage.objects for update to authenticated
 using (bucket_id = 'daylog-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
 with check (bucket_id = 'daylog-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
