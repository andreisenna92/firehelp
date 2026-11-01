CREATE TABLE public.super_admin_identity (user_id uuid PRIMARY KEY REFERENCES public.profiles(id), singleton boolean NOT NULL DEFAULT true UNIQUE CHECK(singleton));
GRANT SELECT ON public.super_admin_identity TO authenticated;
GRANT ALL ON public.super_admin_identity TO service_role;
ALTER TABLE public.super_admin_identity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super identity own read" ON public.super_admin_identity FOR SELECT TO authenticated USING(user_id=auth.uid());
INSERT INTO public.super_admin_identity(user_id) SELECT p.id FROM public.profiles p JOIN auth.users u ON u.id=p.id WHERE lower(u.email)='projetofirehelp@gmail.com' AND u.email_confirmed_at IS NOT NULL AND NOT p.blocked AND p.deleted_at IS NULL ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.super_admin_identity s JOIN auth.users u ON u.id=s.user_id JOIN public.profiles p ON p.id=s.user_id WHERE s.user_id=_user_id AND lower(u.email)='projetofirehelp@gmail.com' AND u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL AND NOT p.blocked AND p.deleted_at IS NULL) $$;
REVOKE ALL ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT NOT public.is_blocked(_user_id) AND (public.is_super_admin(_user_id) OR EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role IN('admin','moderator'))) $$;
CREATE OR REPLACE FUNCTION public.claim_super_admin() RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 PERFORM pg_advisory_xact_lock(741031,1);
 IF EXISTS(SELECT 1 FROM auth.users u JOIN public.profiles p ON p.id=u.id WHERE u.id=auth.uid() AND lower(u.email)='projetofirehelp@gmail.com' AND u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL AND NOT p.blocked AND p.deleted_at IS NULL) THEN
 INSERT INTO public.super_admin_identity(user_id) VALUES(auth.uid()) ON CONFLICT DO NOTHING;
 END IF;
 RETURN public.is_super_admin(auth.uid()); END $$;
REVOKE ALL ON FUNCTION public.claim_super_admin() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.claim_super_admin() TO authenticated;
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$ DECLARE enrollment public.account_enrollments; token text; secret_key text; BEGIN
 token:=NEW.raw_user_meta_data->>'enrollment_token'; IF token IS NULL THEN RAISE EXCEPTION 'Utilize o cadastro do FIREHELP'; END IF;
 DELETE FROM public.account_enrollments WHERE token_hash=encode(extensions.digest(token,'sha256'),'hex') AND email=lower(trim(NEW.email)) AND expires_at>now() RETURNING * INTO enrollment;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cadastro inválido ou expirado'; END IF;
 PERFORM pg_advisory_xact_lock(741031,1);
 INSERT INTO public.account_registration_state(singleton) VALUES(true) ON CONFLICT DO NOTHING;
 SELECT digest_key INTO secret_key FROM public.account_registration_state WHERE singleton FOR UPDATE;
 INSERT INTO public.profiles(id,full_name,email) VALUES(NEW.id,enrollment.full_name,NEW.email);
 INSERT INTO public.account_identities(user_id,cpf_digest) VALUES(NEW.id,encode(extensions.hmac(enrollment.cpf,secret_key,'sha256'),'hex'));
 INSERT INTO public.user_roles(user_id,role) VALUES(NEW.id,'user');
 RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION public.set_member_manager(target_id uuid,make_manager boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 PERFORM pg_advisory_xact_lock(741031,1);
 IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Somente o Super Admin pode alterar administradores'; END IF;
 IF target_id=auth.uid() OR EXISTS(SELECT 1 FROM public.super_admin_identity WHERE user_id=target_id) THEN RAISE EXCEPTION 'O Super Admin não pode ser rebaixado'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=target_id AND deleted_at IS NULL AND NOT blocked) THEN RAISE EXCEPTION 'Membro indisponível'; END IF;
 IF make_manager THEN INSERT INTO public.user_roles(user_id,role) VALUES(target_id,'admin') ON CONFLICT DO NOTHING;
 ELSE DELETE FROM public.user_roles WHERE user_id=target_id AND role IN('admin','moderator'); END IF;
 END $$;
CREATE OR REPLACE FUNCTION public.prepare_member_removal(target_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 PERFORM pg_advisory_xact_lock(741031,1);
 IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Somente o Super Admin pode excluir membros'; END IF;
 IF target_id=auth.uid() OR EXISTS(SELECT 1 FROM public.super_admin_identity WHERE user_id=target_id) THEN RAISE EXCEPTION 'O Super Admin não pode ser excluído'; END IF;
 UPDATE public.profiles SET blocked=true,deleted_at=COALESCE(deleted_at,now()) WHERE id=target_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Membro não encontrado'; END IF;
 DELETE FROM public.user_roles WHERE user_id=target_id; END $$;
CREATE OR REPLACE FUNCTION public.guard_profile_block() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.blocked IS DISTINCT FROM OLD.blocked OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
 PERFORM pg_advisory_xact_lock(741031,1);
 IF EXISTS(SELECT 1 FROM public.super_admin_identity WHERE user_id=NEW.id) OR EXISTS(SELECT 1 FROM auth.users WHERE id=NEW.id AND lower(email)='projetofirehelp@gmail.com' AND email_confirmed_at IS NOT NULL) THEN RAISE EXCEPTION 'O Super Admin está protegido'; END IF;
 IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
 IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at AND NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Somente o Super Admin pode excluir membros'; END IF;
 IF NEW.id=auth.uid() THEN RAISE EXCEPTION 'Você não pode suspender a si mesmo'; END IF;
 END IF;
 IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN RAISE EXCEPTION 'Conta excluída não pode ser reativada'; END IF;
 RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION public.guard_self_role() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.super_admin_identity WHERE user_id=OLD.user_id) THEN RAISE EXCEPTION 'O Super Admin está protegido'; END IF;
 IF OLD.user_id=auth.uid() AND OLD.role IN('admin','moderator') THEN RAISE EXCEPTION 'Você não pode remover sua própria função'; END IF;
 IF TG_OP='UPDATE' THEN RETURN NEW; END IF; RETURN OLD; END $$;
CREATE OR REPLACE FUNCTION public.list_admin_members() RETURNS TABLE(id uuid,full_name text,email text,avatar_url text,blocked boolean,created_at timestamptz,access_level text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
 RETURN QUERY SELECT p.id,p.full_name,u.email::text,p.avatar_url,p.blocked,p.created_at,CASE WHEN public.is_super_admin(p.id) THEN 'super_admin' WHEN EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=p.id AND r.role IN('admin','moderator')) THEN 'admin' ELSE 'member' END FROM public.profiles p JOIN auth.users u ON u.id=p.id WHERE p.deleted_at IS NULL ORDER BY p.full_name;
 END $$;
REVOKE ALL ON FUNCTION public.list_admin_members() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.list_admin_members() TO authenticated;
ALTER TABLE public.fire_reports ADD COLUMN neighborhood text, ADD COLUMN municipality text, ADD COLUMN published boolean NOT NULL DEFAULT true, ADD COLUMN deleted_at timestamptz;
DROP POLICY "reports public read" ON public.fire_reports;
CREATE POLICY "reports public read" ON public.fire_reports FOR SELECT TO anon,authenticated USING(published AND deleted_at IS NULL);
CREATE POLICY "reports private staff or owner read" ON public.fire_reports FOR SELECT TO authenticated USING(public.is_staff(auth.uid()) OR user_id=auth.uid());
CREATE POLICY "report publication protected" ON public.fire_reports AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(deleted_at IS NULL AND published);
CREATE OR REPLACE FUNCTION public.guard_report_publication() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF (NEW.published IS DISTINCT FROM OLD.published OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at) AND NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão'; END IF; RETURN NEW; END $$;
CREATE TRIGGER report_publication_guard BEFORE UPDATE ON public.fire_reports FOR EACH ROW EXECUTE FUNCTION public.guard_report_publication();
DROP POLICY "images public read" ON public.fire_report_images;
CREATE POLICY "images visible report read" ON public.fire_report_images FOR SELECT TO anon,authenticated USING(EXISTS(SELECT 1 FROM public.fire_reports r WHERE r.id=fire_report_id));
CREATE POLICY "images staff insert" ON public.fire_report_images FOR INSERT TO authenticated WITH CHECK(public.is_staff(auth.uid()));
CREATE TRIGGER super_identity_audit AFTER INSERT OR UPDATE OR DELETE ON public.super_admin_identity FOR EACH ROW EXECUTE FUNCTION public.write_audit();
COMMENT ON TABLE public.super_admin_identity IS 'Server-verified fixed principal identity; no client writes. Email must remain verified in Auth.';