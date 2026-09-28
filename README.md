# FIREHELP

**Informação que protege. Comunidade que ajuda.**

Plataforma comunitária de prevenção, informação e comunicação sobre incêndios:
mapa de ocorrências, registro de incêndios com foto e localização, notícias,
fórum e painel de moderação.

> O FIREHELP não substitui os serviços oficiais de emergência. Em caso de risco,
> afaste-se do local e acione imediatamente os bombeiros.

## Funcionalidades

- Login com Google (perfil criado automaticamente no primeiro acesso)
- Dashboard com estatísticas da comunidade, últimas ocorrências e notícias
- Mapa interativo com filtros por status e tipo de incêndio
- Registro de ocorrência com tipo, gravidade, descrição, fotos e ponto no mapa
- Notícias por categoria com página de leitura completa
- Fórum com tópicos, respostas aninhadas, curtidas e denúncia de conteúdo
- Perfil com histórico de ocorrências e contribuições
- Painel de moderação (administradores e moderadores)

## Estrutura de dados

| Tabela | Função |
| --- | --- |
| `profiles` | Dados do usuário criados no primeiro login |
| `user_roles` | Papéis `user`, `moderator`, `admin` (tabela separada por segurança) |
| `fire_reports` | Ocorrências com protocolo, coordenadas, status e gravidade |
| `fire_report_images` | Fotos anexadas às ocorrências |
| `news` | Notícias e alertas publicados pela equipe |
| `forum_posts` / `forum_comments` / `forum_likes` | Fórum comunitário |
| `content_reports` | Denúncias de conteúdo para moderação |

Todas as tabelas usam Row Level Security: leitura pública do conteúdo público,
escrita apenas pelo dono do registro e moderação apenas para a equipe.

## Configuração

O backend (banco, autenticação, armazenamento) já vem provisionado com o projeto.

- **Autenticação:** login com Google ativado. Para usar credenciais próprias,
  configure o client ID e secret nas configurações de autenticação do backend.
- **Armazenamento:** bucket privado `fire-images` (limite de 10 MB por arquivo),
  com upload permitido apenas na pasta do próprio usuário.
- **Primeiro administrador:** após o primeiro login, adicione uma linha em
  `user_roles` com o `user_id` da pessoa e o papel `admin`. A partir daí ela pode
  acessar `/admin` e promover outras pessoas.

## Rodando localmente

```bash
bun install
bun run dev
```

A aplicação sobe em `http://localhost:8080`.

## Publicação

Use o botão **Publish** no Lovable para publicar. O mesmo backend atende
pré-visualização e versão publicada.

## Rotas

| Rota | Descrição |
| --- | --- |
| `/` | Dashboard |
| `/mapa` | Mapa de incêndios |
| `/noticias`, `/noticias/$slug` | Notícias |
| `/comunidade`, `/comunidade/$postId` | Fórum |
| `/reportar` | Registro de ocorrência (requer login) |
| `/perfil` | Perfil do usuário (requer login) |
| `/admin` | Painel de moderação (equipe) |
| `/auth` | Login |
