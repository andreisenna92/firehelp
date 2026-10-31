import { test } from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";

// The entire fixture is rolled back; no real signup or principal claim is retained.
test("cadastro e permissões no banco, sem consumir o primeiro cadastro real", { skip: !process.env["SUPABASE_DB_URL"] }, async () => {
  const sql = postgres(process.env["SUPABASE_DB_URL"] ?? "", { max: 1, connect_timeout: 10, onnotice: () => {} });
  const rollback = new Error("ROLLBACK_ACCOUNT_TEST");
  try {
    await sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(741031,1)`;
      const state = await tx`select count(*)::int as count from public.account_registration_state`;
      assert.equal(state[0]?.count, 0, "Este teste deve ocorrer antes do primeiro cadastro novo");
      await tx.unsafe(`DO $test$
      DECLARE first_id uuid:=gen_random_uuid(); second_id uuid:=gen_random_uuid(); extra_id uuid:=gen_random_uuid(); expired_id uuid:=gen_random_uuid(); bad_email_id uuid:=gen_random_uuid(); failed boolean;
      BEGIN
        INSERT INTO public.account_enrollments(token_hash,cpf,full_name,email) VALUES(encode(extensions.digest('first-test-token','sha256'),'hex'),'52998224725','Primeiro Teste','first-test@example.invalid');
        INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(first_id,'first-test@example.invalid','{"enrollment_token":"first-test-token"}');
        IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=first_id AND role='admin') THEN RAISE EXCEPTION 'Primeiro cadastro não recebeu gerente'; END IF;
        IF (SELECT principal_user_id FROM public.account_registration_state WHERE singleton)<>first_id THEN RAISE EXCEPTION 'Atribuição não foi persistida'; END IF;
        INSERT INTO public.account_enrollments(token_hash,cpf,full_name,email) VALUES(encode(extensions.digest('second-test-token','sha256'),'hex'),'11144477735','Segundo Teste','second-test@example.invalid');
        INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(second_id,'second-test@example.invalid','{"enrollment_token":"second-test-token"}');
        IF EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=second_id AND role IN('admin','moderator')) THEN RAISE EXCEPTION 'Segundo cadastro recebeu gerente'; END IF;
        IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=second_id AND role='user') THEN RAISE EXCEPTION 'Segundo cadastro não recebeu membro'; END IF;
        failed:=false;
        BEGIN
          INSERT INTO public.account_enrollments(token_hash,cpf,full_name,email) VALUES(encode(extensions.digest('duplicate-test-token','sha256'),'hex'),'52998224725','Duplicado Teste','duplicate-test@example.invalid');
          INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(extra_id,'duplicate-test@example.invalid','{"enrollment_token":"duplicate-test-token"}');
        EXCEPTION WHEN unique_violation THEN failed:=true; END;
        IF NOT failed THEN RAISE EXCEPTION 'CPF duplicado foi aceito'; END IF;
        failed:=false;
        BEGIN
          INSERT INTO public.account_enrollments(token_hash,cpf,full_name,email) VALUES(encode(extensions.digest('invalid-test-token','sha256'),'hex'),'11111111111','Inválido Teste','invalid-test@example.invalid');
        EXCEPTION WHEN raise_exception THEN failed:=true; END;
        IF NOT failed THEN RAISE EXCEPTION 'CPF inválido foi aceito'; END IF;
        INSERT INTO public.account_enrollments(token_hash,cpf,full_name,email,expires_at) VALUES(encode(extensions.digest('expired-test-token','sha256'),'hex'),'52998224725','Expirado Teste','expired-test@example.invalid',now()-interval '1 minute');
        failed:=false;
        BEGIN INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(expired_id,'expired-test@example.invalid','{"enrollment_token":"expired-test-token"}'); EXCEPTION WHEN raise_exception THEN failed:=true; END;
        IF NOT failed THEN RAISE EXCEPTION 'Token expirado foi aceito'; END IF;
        failed:=false;
        BEGIN INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(bad_email_id,'wrong-test@example.invalid','{"enrollment_token":"expired-test-token"}'); EXCEPTION WHEN raise_exception THEN failed:=true; END;
        IF NOT failed THEN RAISE EXCEPTION 'Token sem e-mail correspondente foi aceito'; END IF;
        failed:=false;
        BEGIN INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(extra_id,'reuse-test@example.invalid','{"enrollment_token":"first-test-token"}'); EXCEPTION WHEN raise_exception THEN failed:=true; END;
        IF NOT failed THEN RAISE EXCEPTION 'Token reutilizado foi aceito'; END IF;
        PERFORM set_config('request.jwt.claim.sub',second_id::text,true);
        failed:=false;
        BEGIN PERFORM public.set_member_manager(second_id,true); EXCEPTION WHEN raise_exception THEN failed:=true; END;
        IF NOT failed THEN RAISE EXCEPTION 'Membro conseguiu promover a si mesmo'; END IF;
        failed:=false;
        BEGIN PERFORM public.prepare_member_removal(first_id); EXCEPTION WHEN raise_exception THEN failed:=true; END;
        IF NOT failed THEN RAISE EXCEPTION 'Membro conseguiu excluir gerente'; END IF;
        PERFORM set_config('request.jwt.claim.sub',first_id::text,true);
        PERFORM public.set_member_manager(second_id,true);
        IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=second_id AND role='admin') THEN RAISE EXCEPTION 'Gerente não conseguiu promover membro'; END IF;
        failed:=false;
        BEGIN PERFORM public.prepare_member_removal(first_id); EXCEPTION WHEN raise_exception THEN failed:=true; END;
        IF NOT failed THEN RAISE EXCEPTION 'Gerente conseguiu excluir a si mesmo'; END IF;
        INSERT INTO public.forum_posts(user_id,author_name,title,content) VALUES(second_id,'Segundo Teste','Teste de preservação','Conteúdo de teste');
        INSERT INTO public.messages(sender_id,recipient_id,content) VALUES(first_id,second_id,'Mensagem de teste');
        PERFORM public.prepare_member_removal(second_id);
        IF public.is_staff(second_id) OR NOT public.is_blocked(second_id) THEN RAISE EXCEPTION 'Exclusão não revogou acesso'; END IF;
        IF NOT EXISTS(SELECT 1 FROM public.forum_posts WHERE user_id=second_id) OR NOT EXISTS(SELECT 1 FROM public.messages WHERE recipient_id=second_id) THEN RAISE EXCEPTION 'Exclusão apagou contribuições'; END IF;
      END $test$;`);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw new Error(`Teste transacional falhou (${typeof error === "object" && error && "code" in error ? String(error.code) : "asserção"}).`);
  } finally { await sql.end({ timeout: 3 }); }
});