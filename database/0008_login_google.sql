-- FireHelp: login com Google + CPF pedido no primeiro acesso.
-- Rode UMA vez no SQL do banco (Lovable Cloud → Database / SQL, ou pedindo ao Lovable para executar).
-- Seguro para rodar mais de uma vez.

-- 1) Novas contas do Google (sem inscrição de CPF) passam a ser criadas como membro, sem CPF ainda.
--    Cadastro por e-mail e senha continua exigindo o CPF, como antes.
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE enrollment public.account_enrollments; token text; secret_key text; display text;
BEGIN
 token := NEW.raw_user_meta_data->>'enrollment_token';
 IF token IS NULL THEN
  IF COALESCE(NEW.raw_app_meta_data->>'provider','email') = 'email' THEN RAISE EXCEPTION 'Utilize o cadastro do FIREHELP'; END IF;
  display := left(COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'),''), NULLIF(trim(NEW.raw_user_meta_data->>'name'),''), split_part(NEW.email,'@',1), 'Membro'), 120);
  INSERT INTO public.profiles(id,full_name,email,avatar_url) VALUES(NEW.id, display, NEW.email, NEW.raw_user_meta_data->>'avatar_url') ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles(user_id,role) SELECT NEW.id,'user' WHERE NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=NEW.id AND role='user');
  RETURN NEW;
 END IF;
 DELETE FROM public.account_enrollments WHERE token_hash=encode(extensions.digest(token,'sha256'),'hex') AND email=lower(trim(NEW.email)) AND expires_at>now() RETURNING * INTO enrollment;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cadastro inválido ou expirado'; END IF;
 PERFORM pg_advisory_xact_lock(741031,1);
 INSERT INTO public.account_registration_state(singleton) VALUES(true) ON CONFLICT DO NOTHING;
 SELECT digest_key INTO secret_key FROM public.account_registration_state WHERE singleton FOR UPDATE;
 INSERT INTO public.profiles(id,full_name,email) VALUES(NEW.id,enrollment.full_name,NEW.email);
 INSERT INTO public.account_identities(user_id,cpf_digest) VALUES(NEW.id,encode(extensions.hmac(enrollment.cpf,secret_key,'sha256'),'hex'));
 INSERT INTO public.user_roles(user_id,role) VALUES(NEW.id,'user');
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 2) A pessoa já tem CPF registrado? (a gestão não precisa)
CREATE OR REPLACE FUNCTION public.needs_identity(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT NOT public.is_staff(_user_id) AND NOT EXISTS(SELECT 1 FROM public.account_identities WHERE user_id=_user_id)
$$;
REVOKE ALL ON FUNCTION public.needs_identity(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.needs_identity(uuid) TO authenticated;

-- 3) Completar o cadastro: grava só o resumo criptográfico do CPF (o número não fica salvo).
CREATE OR REPLACE FUNCTION public.complete_identity(full_name text, cpf text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE c text := regexp_replace(coalesce(cpf,''), '[^0-9]', '', 'g'); n text := regexp_replace(trim(coalesce(full_name,'')), '\s+', ' ', 'g'); secret_key text;
BEGIN
 IF auth.uid() IS NULL OR public.is_blocked(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
 IF NOT public.valid_cpf(c) THEN RAISE EXCEPTION 'CPF inválido'; END IF;
 IF length(n) NOT BETWEEN 3 AND 120 OR position(' ' in n) = 0 THEN RAISE EXCEPTION 'Informe seu nome completo'; END IF;
 IF EXISTS(SELECT 1 FROM public.account_identities WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'Seu cadastro já está completo'; END IF;
 PERFORM pg_advisory_xact_lock(741031,1);
 INSERT INTO public.account_registration_state(singleton) VALUES(true) ON CONFLICT DO NOTHING;
 SELECT digest_key INTO secret_key FROM public.account_registration_state WHERE singleton;
 BEGIN
  INSERT INTO public.account_identities(user_id,cpf_digest) VALUES(auth.uid(), encode(extensions.hmac(c,secret_key,'sha256'),'hex'));
 EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'Este CPF já está cadastrado em outra conta';
 END;
 UPDATE public.profiles SET full_name=n WHERE id=auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.complete_identity(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_identity(text,text) TO authenticated;

-- 4) Sem CPF, não publica: avisos, tópicos, respostas e mensagens.
DROP POLICY IF EXISTS "identity required reports" ON public.fire_reports;
CREATE POLICY "identity required reports" ON public.fire_reports AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.needs_identity(auth.uid()));
DROP POLICY IF EXISTS "identity required posts" ON public.forum_posts;
CREATE POLICY "identity required posts" ON public.forum_posts AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.needs_identity(auth.uid()));
DROP POLICY IF EXISTS "identity required comments" ON public.forum_comments;
CREATE POLICY "identity required comments" ON public.forum_comments AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.needs_identity(auth.uid()));
DROP POLICY IF EXISTS "identity required messages" ON public.messages;
CREATE POLICY "identity required messages" ON public.messages AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.needs_identity(auth.uid()));
