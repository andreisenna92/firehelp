# FIREHELP: cadastro tradicional e permissões

## O que será preservado
Manter páginas, identidade visual, disposição dos elementos, contas existentes, publicações, notícias e chamados. Não alterar a implantação da Vercel nem reconstruir o projeto.

## Cadastro e entrada
- Adaptar a página de entrada existente para e-mail e senha, com cadastro exigindo nome completo, CPF válido e único, e-mail e senha.
- Retirar o botão e a dependência de Google do fluxo de entrada; contas existentes continuam preservadas e podem definir senha por recuperação de e-mail.
- Usar o serviço de autenticação atual para senhas, confirmação de e-mail, sessão e saída. Não guardar senhas no banco da aplicação.
- Acrescentar recuperação de senha por e-mail e uma página pública para definir a nova senha, seguindo a aparência atual.
- Permitir adicionar e trocar foto na página de perfil existente.

## CPF protegido
- Guardar a identificação separadamente dos perfis públicos, com acesso restrito e prevenção de duplicidade.
- Validar CPF tanto no formulário quanto no cadastro no servidor; impedir exposição em perfis, listagens, respostas públicas e histórico genérico.
- Não inventar CPFs para contas antigas nem bloquear essas contas por falta desse novo campo.

## Gerentes e membros
- Conforme sua escolha, o primeiro **cadastro novo após a mudança** será gerente principal, mesmo com contas antigas preservadas.
- Proteger essa atribuição contra cadastros simultâneos; o primeiro cadastro consome a atribuição uma única vez. Os seguintes recebem função de membro.
- Apresentar somente Gerente e Membro, mantendo os acessos administrativos existentes compatíveis, sem rebaixar contas antigas.
- Autorizar ações administrativas no servidor e nas permissões do banco. Nenhum campo do cadastro permite escolher função.
- Permitir aos gerentes promover membros, moderar publicações, editar notícias e alterar status de chamados.
- Implementar exclusão de membros com confirmação, proteção contra excluir a si próprio ou o último gerente e preservação das contribuições existentes.
- Completar edição/exclusão das próprias publicações e fotos dos autores reutilizando o fórum atual; manter comentários e interações.

## Detalhes técnicos
- Alterações de banco serão aditivas; reutilizar `profiles`, `user_roles` e as políticas atuais, acrescentando somente o armazenamento privado necessário ao CPF e o controle durável da primeira atribuição.
- Centralizar cadastro sensível e operações administrativas em funções do servidor, com validação e verificação de permissões. Nunca expor credenciais privilegiadas.
- Preservar arquivos gerados de integração. Usar componentes e cores atuais nos formulários.
- Não mudar configurações de confirmação, redirecionamento ou envio de e-mails sem verificar as existentes; informar qualquer dependência que impeça o teste de entrega.

## Validação
- Testar CPF válido/inválido e duplicado, primeira atribuição e cadastros simultâneos, segundo cadastro como membro e tentativa de autopromoção.
- Testar entrada/saída, confirmação, recuperação de senha e alteração de foto.
- Verificar permissões de gerente e membro com sessões reais, incluindo edição própria e proibição de editar conteúdo alheio.
- Não criar um primeiro gerente de teste no banco atual: verificar essa regra em ambiente isolado ou em testes transacionais com reversão, sem consumir a primeira atribuição real.
- Conferir carregamento, páginas existentes e formulários em computador e celular; relatar explicitamente o que não puder ser verificado.