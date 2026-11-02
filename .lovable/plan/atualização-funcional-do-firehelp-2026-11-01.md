# Atualização funcional do FIREHELP

## Preservação
- Reaproveitar páginas, administração, autenticação, notícias e chamados existentes; manter identidade visual e dados.
- Manter cadastro com CPF protegido, entrada por e-mail/senha, recuperação e histórico de contribuições.
- Não criar páginas duplicadas nem realizar alterações destrutivas.

## 1. Segurança e administração
- Proteger a conta **projetofirehelp@gmail.com** como **Super Admin**, somente após confirmação do e-mail pelo sistema de autenticação.
- Adotar três níveis: Super Admin, Administrador e Membro. Preservar os privilégios administrativos já existentes; novos cadastros comuns recebem acesso de membro.
- Somente o Super Admin poderá promover ou rebaixar administradores. Nenhum administrador poderá suspender, excluir ou rebaixar o Super Admin.
- Reutilizar o painel existente, chamando-o **Administração**, com Notícias, Alertas e Membros, mantendo a moderação atual.
- Mostrar nome, e-mail e nível de acesso na gestão de membros; preservar exclusão de acesso sem apagar contribuições. Reservar exclusão de membros ao Super Admin.

## 2. Notícias e alertas
- Completar os controles existentes de notícias: criar, editar, excluir com confirmação, publicar/despublicar e enviar/substituir/remover foto.
- Adicionar ao painel existente criação e edição completa de alertas: tipo, nível, descrição, endereço, coordenadas, fotos e status; permitir remoção preservando histórico.
- Permitir publicar/despublicar alertas sem apagar o registro nem expor alertas despublicados nas consultas públicas.

## 3. Google Maps e endereço
- Substituir o mapa Leaflet pelo Google Maps Platform oficial, preservando dimensões, filtros, coordenadas existentes, marcadores e detalhes das ocorrências.
- Manter zoom, movimentação e seleção manual; usar cores semânticas existentes e ícones/tamanhos para distinguir tipo e nível.
- Usar geolocalização de alta precisão do navegador, sem substituir o GPS por coordenadas fixas. Converter coordenadas em endereço completo pelo Google Geocoding.
- Incluir o campo obrigatório **Endereço ou local da ocorrência**, bairro e município; permitir busca de endereço, seleção e ajuste manual no mapa. Manter o endereço visível antes do envio e nos alertas publicados.
- Preservar latitude, longitude, responsável e data/hora existentes; acrescentar apenas campos necessários para bairro, município e publicação.
- Se a localização for negada ou falhar, explicar o problema e manter endereço digitado e seleção manual disponíveis.

## Configuração externa
- A conexão Google Maps ainda não foi concluída. Abrir novamente a configuração oficial para usar uma conexão gerenciada pelo Lovable ou credenciais próprias.
- Variáveis do mapa: `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` e `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID`; chamadas protegidas usam `GOOGLE_MAPS_API_KEY` e `LOVABLE_API_KEY` somente no servidor, conforme os nomes retornados pela conexão.
- Google Maps tem cobrança por uso. Limitar consultas a usuários autenticados, evitar chamadas repetidas e executar buscas apenas com entradas válidas; não criar consulta pública irrestrita.
- Não habilitar serviços adicionais desnecessários. Começar por Maps JavaScript API e Geocoding API, com busca explícita de endereço; sugestões enquanto digita são opcionais, não necessárias para esta entrega.

## Detalhes técnicos
- Manter roles em tabela protegida; vincular o Super Admin à identidade confirmada no servidor, nunca a e-mail editável no perfil ou metadados do navegador.
- Ajustar funções protegidas e políticas de acesso, com salvaguardas para alterações concorrentes e proteção da conta principal em todos os caminhos de gestão.
- Preservar validação e digest privado do CPF; substituir somente a atribuição automática de principal ao primeiro novo cadastro pela regra do Super Admin definido.
- Usar alterações aditivas no banco e auditoria existente; arquivar/remover da exibição alertas sem destruir o histórico. Não alterar registros antigos para inventar endereços ou bairros.
- Manter a interface atual do componente de mapa; carregar Google Maps de forma assíncrona com callback, idioma português e região Brasil. Sem Places no navegador e sem ID de mapa fictício.
- Geocoding em funções autenticadas do projeto, com validação de entrada, tratamento de falhas e proteção das credenciais. Ignorar respostas antigas quando o usuário mudar a localização.

## Validação
- Acrescentar e executar testes concretos para Super Admin protegido, promoção exclusiva, acesso de membros, endereço obrigatório e preservação de coordenadas.
- Verificar criação/edição/publicação de notícia, troca de foto e criação/edição de alerta usando contas adequadas, sem apagar conteúdo real.
- Verificar o carregamento geral e ausência de falhas na aplicação.
- A execução de Google Maps e APIs Google não pode ser validada neste ambiente de testes; confirmar mapa, GPS, busca e marcadores em endereço publicado autorizado, indicando claramente o que ficou pendente.
- Se a conta principal não existir ou não estiver confirmada, informar essa pendência sem criar conta, alterar senha ou confirmar e-mail automaticamente.