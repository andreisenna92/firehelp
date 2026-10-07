# FIREHELP

**Informação que protege. Comunidade que ajuda.**

Plataforma comunitária de Saquarema/RJ para prevenção, informação e comunicação sobre incêndios, preservação ambiental e participação da comunidade.

## Funcionalidades

- Login com Google via Supabase Auth.
- Dashboard com estatísticas, notícias e ocorrências.
- Mapa interativo de ocorrências.
- Registro de incidentes com localização, gravidade, descrição e fotos.
- Notícias e publicações editáveis pela gestão.
- Comunidade com membros, tópicos, comentários, curtidas, mensagens, eventos e dicas de prevenção.
- Painel de gestão para ocorrências, notícias, publicações, denúncias e membros.
- Suspensão de membros e promoção de membros a gestor.
- Histórico de alterações de status das ocorrências.

## Gestor principal

A conta `andreisenna92@gmail.com` é o gestor principal do FireHelp.

Depois que essa conta fizer o primeiro login pelo Google, execute no SQL Editor do novo projeto Supabase:

```sql
-- arquivo: supabase/admin-bootstrap.sql
```

Esse script também atualiza o gatilho de novos usuários para que essa conta seja promovida automaticamente a `admin`.

## Supabase

Projeto configurado para:

```text
https://wjzpkzebsrvixyilnedz.supabase.co
```

O frontend usa apenas a chave **publishable**. Nunca coloque a `service_role` ou outra chave secreta em variáveis `VITE_*` ou no GitHub.

Copie `.env.example` para `.env` e preencha a chave publicável para desenvolvimento local.

## Vercel

Configure estas variáveis em **Settings → Environment Variables**:

```text
VITE_SUPABASE_URL=https://wjzpkzebsrvixyilnedz.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<chave publishable do novo Supabase>
VITE_SUPABASE_REDIRECT_URL=https://firehelpsaqua.vercel.app/auth
```

Para as rotinas server-side, quando forem necessárias:

```text
SUPABASE_URL=https://wjzpkzebsrvixyilnedz.supabase.co
SUPABASE_PUBLISHABLE_KEY=<chave publishable do novo Supabase>
SUPABASE_SERVICE_ROLE_KEY=<chave secreta somente no ambiente server>
```

A `SUPABASE_SERVICE_ROLE_KEY` nunca deve ser exposta ao navegador nem ter prefixo `VITE_`.

## Google OAuth

No Google Cloud OAuth, o URI autorizado é:

```text
https://wjzpkzebsrvixyilnedz.supabase.co/auth/v1/callback
```

No Supabase, o Site URL é:

```text
https://firehelpsaqua.vercel.app
```

E o redirect permitido é:

```text
https://firehelpsaqua.vercel.app/**
```

## Desenvolvimento local

```bash
npm install
npm run dev
```

A aplicação roda por padrão em `http://localhost:3000`.

## Publicação

O projeto é independente e pode ser publicado diretamente no GitHub e na Vercel. Não depende de editor ou hospedagem de terceiros.
