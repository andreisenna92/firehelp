CREATE TABLE public.account_enrollments (
 token_hash text PRIMARY KEY,
 cpf text NOT NULL,
 full_name text NOT NULL,
 email text NOT NULL,
 expires_at timestamptz NOT NULL DEFAULT now() + interval '10 minutes'
);
GRANT ALL ON public.account_enrollments TO service_role;
ALTER TABLE public.account_enrollments ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.account_identities (
 user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 cpf_digest text NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.account_identities TO service_role;
ALTER TABLE public.account_identities ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.account_registration_state (
 singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
 principal_user_id uuid,
 claimed_at timestamptz,
 digest_key text NOT NULL DEFAULT (gen_random_uuid()::text || gen_random_uuid()::text)
);
GRANT ALL ON public.account_registration_state TO service_role;
ALTER TABLE public.account_registration_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ADD COLUMN deleted_at timestamptz;
GRANT SELECT(deleted_at) ON public.profiles TO anon, authenticated;
CREATE OR REPLACE FUNCTION public.valid_cpf(value text) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE c text := regexp_replace(value, '[.\-[:space:]]', '', 'g'); s integer; d integer; n integer; i integer;
BEGIN
 IF c IS NULL OR c !~ '^[0-9]{11}$' OR c = repeat(substr(c,1,1),11) THEN RETURN false; END IF;
 FOR n IN 9..10 LOOP
  s := 0;
  FOR i IN 1..n LOOP s := s + substr(c,i,1)::integer * (n+2-i); END LOOP;
  d := (s*10)%11; IF d=10 THEN d:=0; END IF;
  IF d <> substr(c,n+1,1)::integer THEN RETURN false; END IF;
 END LOOP;
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION public.validate_enrollment() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NOT public.valid_cpf(NEW.cpf) OR NEW.cpf !~ '^[0-9]{11}$' OR length(trim(NEW.full_name)) NOT BETWEEN 3 AND 120 OR trim(NEW.full_name) !~ '[[:space:]]' OR NEW.token_hash !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Cadastro inválido'; END IF;
 NEW.email := lower(trim(NEW.email));
 RETURN NEW;
END $$;
CREATE TRIGGER validate_account_enrollment BEFORE INSERT OR UPDATE ON public.account_enrollments FOR EACH ROW EXECUTE FUNCTION public.validate_enrollment();
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE enrollment public.account_enrollments; token text; principal uuid; secret_key text;
BEGIN
 token := NEW.raw_user_meta_data->>'enrollment_token';
 IF token IS NULL THEN RAISE EXCEPTION 'Utilize o cadastro do FIREHELP'; END IF;
 DELETE FROM public.account_enrollments WHERE token_hash=encode(extensions.digest(token,'sha256'),'hex') AND email=lower(trim(NEW.email)) AND expires_at>now() RETURNING * INTO enrollment;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cadastro inválido ou expirado'; END IF;
 PERFORM pg_advisory_xact_lock(741031,1);
 INSERT INTO public.account_registration_state(singleton) VALUES(true) ON CONFLICT DO NOTHING;
 SELECT principal_user_id, digest_key INTO principal, secret_key FROM public.account_registration_state WHERE singleton FOR UPDATE;
 INSERT INTO public.profiles(id,full_name,email) VALUES(NEW.id,enrollment.full_name,NEW.email);
 INSERT INTO public.account_identities(user_id,cpf_digest) VALUES(NEW.id,encode(extensions.hmac(enrollment.cpf,secret_key,'sha256'),'hex'));
 INSERT INTO public.user_roles(user_id,role) VALUES(NEW.id,'user');
 IF principal IS NULL THEN
  INSERT INTO public.user_roles(user_id,role) VALUES(NEW.id,'admin');
  UPDATE public.account_registration_state SET principal_user_id=NEW.id,claimed_at=now() WHERE singleton;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.is_blocked(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT COALESCE((SELECT blocked OR deleted_at IS NOT NULL FROM public.profiles WHERE id=_user_id),true) $$;
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT NOT public.is_blocked(_user_id) AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role IN('admin','moderator')) $$;
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM authenticated, anon;
DROP POLICY IF EXISTS "admin manage roles" ON public.user_roles;
CREATE OR REPLACE FUNCTION public.set_member_manager(target_id uuid, make_manager boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(741031,1);
 IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
 IF target_id=auth.uid() THEN RAISE EXCEPTION 'Você não pode alterar sua própria função'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=target_id AND deleted_at IS NULL AND NOT blocked) THEN RAISE EXCEPTION 'Membro indisponível'; END IF;
 IF make_manager THEN INSERT INTO public.user_roles(user_id,role) VALUES(target_id,'admin') ON CONFLICT DO NOTHING;
 ELSE
  IF public.is_staff(target_id) AND (SELECT count(DISTINCT user_id) FROM public.user_roles WHERE role IN('admin','moderator') AND public.is_staff(user_id))<=1 THEN RAISE EXCEPTION 'O último gerente não pode ser removido'; END IF;
  DELETE FROM public.user_roles WHERE user_id=target_id AND role IN('admin','moderator');
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.set_member_manager(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_member_manager(uuid,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.prepare_member_removal(target_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(741031,1);
 IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
 IF target_id=auth.uid() THEN RAISE EXCEPTION 'Você não pode excluir a si mesmo'; END IF;
 IF public.is_staff(target_id) AND (SELECT count(DISTINCT user_id) FROM public.user_roles WHERE role IN('admin','moderator') AND public.is_staff(user_id))<=1 THEN RAISE EXCEPTION 'O último gerente não pode ser excluído'; END IF;
 UPDATE public.profiles SET blocked=true,deleted_at=COALESCE(deleted_at,now()) WHERE id=target_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Membro não encontrado'; END IF;
 DELETE FROM public.user_roles WHERE user_id=target_id;
END $$;
REVOKE ALL ON FUNCTION public.prepare_member_removal(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.prepare_member_removal(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.guard_profile_block() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.blocked IS DISTINCT FROM OLD.blocked OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF NEW.id=auth.uid() THEN RAISE EXCEPTION 'Você não pode suspender a si mesmo'; END IF;
 END IF;
 IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN RAISE EXCEPTION 'Conta excluída não pode ser reativada'; END IF;
 RETURN NEW;
END $$;
CREATE POLICY "active profile writes" ON public.profiles AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT public.is_blocked(auth.uid())) WITH CHECK (NOT public.is_blocked(auth.uid()));
CREATE POLICY "active post writes" ON public.forum_posts AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT public.is_blocked(auth.uid())) WITH CHECK (NOT public.is_blocked(auth.uid()));
CREATE POLICY "active report writes" ON public.fire_reports AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT public.is_blocked(auth.uid())) WITH CHECK (NOT public.is_blocked(auth.uid()));
CREATE POLICY "active message writes" ON public.messages AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.is_blocked(auth.uid()) AND NOT public.is_blocked(recipient_id));
CREATE POLICY "active storage insert" ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.is_blocked(auth.uid()));
CREATE POLICY "active storage delete" ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT public.is_blocked(auth.uid()));
COMMENT ON TABLE public.account_identities IS 'Private keyed CPF digest only; no public or member reads and no generic audit payloads.';
COMMENT ON TABLE public.account_registration_state IS 'Durable first-new-signup claim; never reset when a manager is removed.';