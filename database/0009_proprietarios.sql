-- FireHelp: andreisenna92@gmail.com como proprietário (super admin) do site.
-- O proprietário pode tudo: notícias e alertas, situação e exclusão de ocorrências,
-- suspender/banir membros e promover ou rebaixar administradores.
-- projetofirehelp@gmail.com continua como proprietário também.
-- Seguro para rodar mais de uma vez.

-- Lista de e-mails proprietários (para adicionar outro no futuro, inclua aqui).
CREATE OR REPLACE FUNCTION public.is_owner_email(_email text) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT lower(trim(coalesce(_email,''))) IN ('andreisenna92@gmail.com','projetofirehelp@gmail.com')
$$;

-- A conta é de um proprietário (independe de estar ativa) — usado para proteger contra rebaixar/banir.
CREATE OR REPLACE FUNCTION public.is_owner(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=_user_id AND public.is_owner_email(u.email) AND u.email_confirmed_at IS NOT NULL)
$$;
REVOKE ALL ON FUNCTION public.is_owner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_owner(uuid) TO authenticated;

-- Super admin = proprietário com conta ativa.
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM auth.users u JOIN public.profiles p ON p.id=u.id
  WHERE u.id=_user_id AND public.is_owner_email(u.email) AND u.email_confirmed_at IS NOT NULL
    AND u.deleted_at IS NULL AND NOT p.blocked AND p.deleted_at IS NULL)
$$;
REVOKE ALL ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.claim_super_admin() RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF public.is_super_admin(auth.uid()) THEN
  INSERT INTO public.user_roles(user_id,role) SELECT auth.uid(),'admin'
   WHERE NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='admin');
  RETURN true;
 END IF;
 RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.claim_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_super_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_member_manager(target_id uuid, make_manager boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(741031,1);
 IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Somente o proprietário pode alterar administradores'; END IF;
 IF target_id=auth.uid() OR public.is_owner(target_id) THEN RAISE EXCEPTION 'O proprietário não pode ser rebaixado'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=target_id AND deleted_at IS NULL AND NOT blocked) THEN RAISE EXCEPTION 'Membro indisponível'; END IF;
 IF make_manager THEN INSERT INTO public.user_roles(user_id,role) SELECT target_id,'admin' WHERE NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=target_id AND role='admin');
 ELSE DELETE FROM public.user_roles WHERE user_id=target_id AND role IN('admin','moderator'); END IF;
END $$;

CREATE OR REPLACE FUNCTION public.prepare_member_removal(target_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(741031,1);
 IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Somente o proprietário pode excluir membros'; END IF;
 IF target_id=auth.uid() OR public.is_owner(target_id) THEN RAISE EXCEPTION 'O proprietário não pode ser excluído'; END IF;
 UPDATE public.profiles SET blocked=true, deleted_at=COALESCE(deleted_at,now()) WHERE id=target_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Membro não encontrado'; END IF;
 DELETE FROM public.user_roles WHERE user_id=target_id;
END $$;

CREATE OR REPLACE FUNCTION public.guard_profile_block() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.blocked IS DISTINCT FROM OLD.blocked OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
  PERFORM pg_advisory_xact_lock(741031,1);
  IF public.is_owner(NEW.id) THEN RAISE EXCEPTION 'O proprietário está protegido'; END IF;
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at AND NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Somente o proprietário pode excluir membros'; END IF;
  IF NEW.id=auth.uid() THEN RAISE EXCEPTION 'Você não pode suspender a si mesmo'; END IF;
 END IF;
 IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN RAISE EXCEPTION 'Conta excluída não pode ser reativada'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_self_role() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF public.is_owner(OLD.user_id) AND OLD.role IN('admin','moderator') THEN RAISE EXCEPTION 'O proprietário está protegido'; END IF;
 IF OLD.user_id=auth.uid() AND OLD.role IN('admin','moderator') THEN RAISE EXCEPTION 'Você não pode remover sua própria função'; END IF;
 IF TG_OP='UPDATE' THEN RETURN NEW; END IF;
 RETURN OLD;
END $$;

-- Já dá ao proprietário o papel de administrador (aparece como gestão em todas as telas).
INSERT INTO public.user_roles(user_id,role)
 SELECT u.id,'admin' FROM auth.users u JOIN public.profiles p ON p.id=u.id
 WHERE public.is_owner_email(u.email) AND u.email_confirmed_at IS NOT NULL
   AND NOT EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=u.id AND r.role='admin');
