CREATE POLICY "active private message reads" ON public.messages AS RESTRICTIVE FOR SELECT TO authenticated USING (NOT public.is_blocked(auth.uid()));
CREATE POLICY "active role reads" ON public.user_roles AS RESTRICTIVE FOR SELECT TO authenticated USING (NOT public.is_blocked(auth.uid()));
CREATE POLICY "active content report reads" ON public.content_reports AS RESTRICTIVE FOR SELECT TO authenticated USING (NOT public.is_blocked(auth.uid()));
CREATE POLICY "active storage reads" ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING (NOT public.is_blocked(auth.uid()));