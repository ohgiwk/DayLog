create policy daylog_photo_delete on storage.objects for delete to authenticated
 using (bucket_id = 'daylog-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
