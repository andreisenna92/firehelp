# FireHelp Saquarema

Rede comunitária de Saquarema (RJ) para **avisar focos de incêndio** com foto, vídeo e localização, **acompanhar ocorrências no mapa**, ler **notícias e alertas** e conversar na **comunidade** sobre prevenção.

## Como o projeto é feito

Site estático, **sem etapa de build** — HTML, CSS e módulos JavaScript nativos. Abre rápido mesmo com sinal fraco e não quebra no deploy por causa de dependências.

```
index.html            página única (o roteamento é feito em app/main.js)
styles/app.css        todo o visual (cores, tipografia, componentes)
app/
  config.js           endereço e chave PÚBLICA do banco
  sb.js               cliente mínimo do Supabase (REST, login, arquivos)
  store.js            pessoa conectada, papéis e permissões
  ui.js               ícones, avisos, formatos e rótulos
  map.js              mapa (Leaflet, servido pelo próprio site)
  pages/*.js          uma página por arquivo, carregada só quando aberta
api/                  funções de servidor da Vercel (cadastro e exclusão de conta)
assets/               mascote Mimo e fontes (Archivo e Atkinson Hyperlegible)
vendor/leaflet/       biblioteca do mapa
database/             migrações SQL do banco (não vão para o site publicado)
```

## Banco de dados

Os dados (ocorrências, notícias, fórum, membros, mensagens) ficam no backend do Lovable Cloud, configurado em `app/config.js`. A chave ali é a **publishable**, feita para ficar no navegador — a proteção vem das regras de acesso (RLS) do banco.

## Vercel

Não precisa de nenhuma variável para o site funcionar. O `vercel.json` já desliga o build e faz as rotas apontarem para o `index.html`.

Para o **cadastro de novas contas** e a **exclusão de contas** pelo super admin, a Vercel precisa da chave de servidor do banco:

```
SUPABASE_SERVICE_ROLE_KEY=<chave service_role do backend>
```

Configure em **Vercel → Settings → Environment Variables**. Nunca coloque essa chave no código nem em `app/config.js`. Sem ela, o site mostra uma mensagem clara de "cadastro indisponível" e todo o resto continua funcionando (entrar, reportar, mapa, comunidade, gestão).

As variáveis antigas `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` não são mais usadas e podem ser apagadas.

## Rodar no computador

Qualquer servidor estático com fallback para `index.html` serve. O mais simples:

```bash
npx vercel dev
```

## Login e e-mails

Nos e-mails de confirmação e recuperação de senha, o link volta para o site e é tratado automaticamente (`/reset-password` para nova senha).

## Gestão

- **Super admin:** `projetofirehelp@gmail.com` — promove/rebaixa gestão e exclui contas.
- **Gestão:** verifica avisos, muda a situação das ocorrências, publica notícias e alertas, modera a comunidade e suspende membros.

Painel em `/admin`.
