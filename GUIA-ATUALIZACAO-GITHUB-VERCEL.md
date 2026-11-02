# Guia rápido — FireHelp independente

## 1. GitHub

1. Abra o repositório `andreisenna92/firehelp`.
2. Faça backup/download do conteúdo atual, se quiser manter uma cópia.
3. Extraia este ZIP no computador.
4. Substitua o conteúdo do repositório pelos arquivos desta versão.
5. **Não envie o arquivo `.env`**. Este projeto só traz `.env.example`.
6. Faça commit e push para a branch `main`.

Se o repositório ainda estiver conectado ao editor que gerou o projeto, desconecte essa integração antes ou depois do push. O código desta versão não contém arquivos, dependências ou chamadas para esse editor.

## 2. Vercel

Depois do push, o projeto Vercel conectado ao GitHub poderá criar um novo deployment.

Em **Settings → Environment Variables**, configure:

```text
VITE_SUPABASE_URL=https://wjzpkzebsrvixyilnedz.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<chave publishable do novo Supabase>
VITE_SUPABASE_REDIRECT_URL=https://firehelpsaqua.vercel.app/auth
```

Se usar operações server-side que exigem privilégios, configure também `SUPABASE_SERVICE_ROLE_KEY` **somente como variável server-side**, nunca com prefixo `VITE_`.

## 3. Google OAuth

No Google Cloud, o cliente OAuth Web deve ter como URI de redirecionamento:

```text
https://wjzpkzebsrvixyilnedz.supabase.co/auth/v1/callback
```

No Supabase:

```text
Site URL: https://firehelpsaqua.vercel.app
Redirect URL: https://firehelpsaqua.vercel.app/**
```

## 4. Gestor principal

Após o primeiro login Google de `andreisenna92@gmail.com`, execute:

```text
supabase/admin-bootstrap.sql
```

Isso garante a função `admin` para a conta principal.
