# Planejamento de campanhas do portal Hotspot

## Leitor e objetivo

Este documento e para um engenheiro interno que vai implementar campanhas no portal Hotspot. Ao final da leitura, ele deve conseguir criar o modulo de campanhas com banco, API, tela administrativa e exibicao no portal sem alterar o fluxo critico de login do MikroTik sem necessidade.

## Escopo

Campanhas sao mensagens, banners ou chamadas de acao exibidas no portal publico de um ou mais hotspots. A campanha pode aparecer antes das opcoes de login ou depois que o acesso for liberado, dentro de uma janela de data, horario e dias da semana.

Fica fora da primeira versao:

- Segmentacao por usuario, CPF, voucher ou plano comprado.
- Relatorios avancados de conversao.
- Editor visual drag and drop.
- Upload de midia local. A primeira versao pode usar URL de imagem.

## Modelo de dados

### Campanha

Campos recomendados:

- `nome`: identificacao interna.
- `ativo`: permite pausar sem apagar.
- `titulo`: texto principal exibido ao cliente.
- `descricao`: texto de apoio.
- `imagemUrl`: URL opcional de imagem/banner.
- `posicao`: `ANTES_LOGIN` ou `APOS_LOGIN`.
- `dataInicio`: inicio da validade.
- `dataFim`: fim da validade.
- `horaInicio`: horario diario inicial, formato `HH:mm`.
- `horaFim`: horario diario final, formato `HH:mm`.
- `diasSemana`: lista ou mascara com domingo a sabado.
- `prioridade`: numero maior vence quando mais de uma campanha esta elegivel.
- `criadoEm` e `atualizadoEm`.

### CampanhaHotspot

Relaciona campanhas com hotspots. Uma campanha pode aparecer em varios hotspots, e um hotspot pode ter varias campanhas.

Campos recomendados:

- `campanhaId`
- `hotspotId`

### CampanhaAcao

Define botoes ou links exibidos dentro da campanha.

Campos recomendados:

- `campanhaId`
- `label`: texto do botao.
- `tipo`: `ABRIR_URL`, `WHATSAPP`, `TELEFONE`, `EMAIL`, `FECHAR`.
- `destino`: URL, telefone, e-mail ou texto conforme o tipo.
- `ordem`: ordenacao visual.

## Regras de elegibilidade

Uma campanha esta elegivel quando:

- `ativo` e verdadeiro.
- O hotspot atual esta vinculado a campanha.
- A data atual esta entre `dataInicio` e `dataFim`.
- O horario atual esta entre `horaInicio` e `horaFim`.
- O dia da semana atual esta marcado em `diasSemana`.
- A posicao solicitada bate com `ANTES_LOGIN` ou `APOS_LOGIN`.

Quando houver mais de uma campanha elegivel:

- Ordenar por `prioridade` decrescente.
- Em empate, usar a mais recente.
- A primeira versao deve exibir apenas uma campanha por posicao para reduzir interferencia no login.

## API

Endpoints administrativos:

- Listar campanhas com busca e paginacao local no frontend.
- Criar campanha.
- Editar campanha.
- Excluir ou desativar campanha.
- Vincular hotspots.
- Criar, editar e remover acoes.

Endpoint publico:

- Recebe `hotspotSlug` e `posicao`.
- Retorna a campanha elegivel de maior prioridade com suas acoes.
- Nao exige autenticacao.
- Nao retorna campanhas inativas ou fora da janela.

## Tela administrativa

A tela deve seguir o padrao operacional do painel:

- Lista com busca, paginacao e status ativo/inativo.
- Formulario com secoes: identidade, exibicao, agendamento, hotspots e acoes.
- Seletor multiplo de hotspots.
- Campos de data, horario e dias da semana.
- Previa simples do card/banner da campanha.

Estados importantes:

- Campanha sem hotspot vinculado deve salvar como rascunho, mas nao aparece no portal.
- Campanha sem acao pode aparecer como informativa, com botao de fechar.
- Campanha `APOS_LOGIN` deve deixar claro que sera exibida antes do redirecionamento final ou em tela intermediaria.

## Exibicao no portal

### Antes do login

Fluxo recomendado:

1. Portal carrega dados do hotspot.
2. Portal consulta campanha `ANTES_LOGIN`.
3. Se houver campanha, exibe um banner/card acima das opcoes de login ou um modal leve.
4. O usuario pode acionar uma acao ou fechar.
5. As opcoes de login continuam acessiveis.

Esta posicao e a mais segura para a primeira implementacao porque nao interfere no HTML final enviado ao MikroTik.

### Apos logar

Fluxo recomendado para uma segunda etapa:

1. O backend libera o acesso como ja faz hoje.
2. Antes de devolver o HTML final, verifica campanha `APOS_LOGIN`.
3. Se houver campanha, devolve uma tela intermediaria com a campanha e um botao "Continuar".
4. Ao continuar, a tela envia o formulario final de login do MikroTik.

Cuidados:

- Preservar `link-login`, `link-login-only`, `link-orig`, `chap-id` e `chap-challenge`.
- Nao perder os parametros CHAP/PAP.
- Nao criar uma etapa que bloqueie o usuario se a campanha falhar.
- Ter fallback direto para login final quando nao houver campanha.

## Ordem de implementacao recomendada

1. Criar modelo de dados de campanhas e relacoes.
2. Criar CRUD administrativo sem exibicao publica.
3. Criar endpoint publico de campanha elegivel.
4. Exibir campanha antes do login no portal.
5. Adicionar metricas simples de clique e visualizacao.
6. Implementar campanha apos login com testes do fluxo CHAP/PAP.

## Testes obrigatorios

- Campanha fora de data nao aparece.
- Campanha fora do horario nao aparece.
- Campanha de outro hotspot nao aparece.
- Campanha inativa nao aparece.
- Maior prioridade vence.
- Acao `ABRIR_URL` renderiza link seguro.
- Portal continua mostrando opcoes de login quando a campanha falha.
- Fluxo apos login preserva parametros do MikroTik.
