REVOKE ALL ON public.account_enrollments, public.account_identities, public.account_registration_state FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.account_enrollments, public.account_identities, public.account_registration_state TO service_role;
REVOKE ALL ON FUNCTION public.handle_new_user(), public.validate_enrollment() FROM PUBLIC, anon, authenticated;
CREATE POLICY "active post deletion" ON public.forum_posts AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT public.is_blocked(auth.uid()));
CREATE POLICY "active comment deletion" ON public.forum_comments AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT public.is_blocked(auth.uid()));
CREATE POLICY "active like deletion" ON public.forum_likes AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT public.is_blocked(auth.uid()));
CREATE POLICY "active message updates" ON public.messages AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT public.is_blocked(auth.uid())) WITH CHECK (NOT public.is_blocked(auth.uid()));