-- A versioned notebook keeps folder removals and photo attachments atomic.
-- Empty arrays are durable deletions, preventing an offline device resurrecting them.
create table public.daylog_memos (
 user_id uuid primary key references auth.users(id) on delete cascade,
 library jsonb not null,
 version uuid not null,
 updated_at timestamptz not null default now(),
 constraint valid_memo_library check (
  jsonb_typeof(library) = 'object'
  and library ? 'folders' and library ? 'notes'
  and jsonb_typeof(library->'folders') = 'array'
  and jsonb_typeof(library->'notes') = 'array'
 )
);
alter table public.daylog_memos enable row level security;
revoke all on public.daylog_memos from public, anon, authenticated;
grant select, insert, update on public.daylog_memos to authenticated;
create policy daylog_memo_read on public.daylog_memos for select to authenticated
 using ((select auth.uid()) = user_id);
create policy daylog_memo_insert on public.daylog_memos for insert to authenticated
 with check ((select auth.uid()) = user_id);
create policy daylog_memo_update on public.daylog_memos for update to authenticated
 using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create function public.daylog_write_memos(p_library jsonb, p_expected uuid, p_version uuid)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare result uuid;
begin
 if auth.uid() is null then raise exception 'authentication_required'; end if;
 if p_expected is null then
  insert into public.daylog_memos(user_id, library, version)
  values (auth.uid(), p_library, p_version)
  on conflict (user_id) do nothing returning version into result;
 else
  update public.daylog_memos set library = p_library, version = p_version, updated_at = now()
  where user_id = auth.uid() and version = p_expected
  returning version into result;
 end if;
 -- Retrying after a lost response must be safe.
 if result is null then
  select version into result from public.daylog_memos where user_id = auth.uid() and version = p_version;
 end if;
 if result is null then raise exception 'sync_conflict' using errcode = 'P0001'; end if;
 return result;
end;
$$;
revoke all on function public.daylog_write_memos(jsonb,uuid,uuid) from public, anon;
grant execute on function public.daylog_write_memos(jsonb,uuid,uuid) to authenticated;
