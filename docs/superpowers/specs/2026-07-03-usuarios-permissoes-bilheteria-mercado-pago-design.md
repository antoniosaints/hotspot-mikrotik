# Usuarios, permissoes, bilheteria e Mercado Pago

## Objetivo

Adicionar controle de usuarios administrativos por perfil, criar bilheteria com planos pagos, permitir compra de acesso no portal via Pix Mercado Pago, liberar o acesso automaticamente apos pagamento confirmado e registrar prospeccoes quando o comprador preencher dados.

## Escopo

- Criar perfis administrativos `admin`, `manager` e `user`.
- Adicionar tela de usuarios para administradores.
- Aplicar permissao no backend e no frontend.
- Adicionar integracao de pagamento Mercado Pago na tela de integracoes.
- Adicionar bilheteria com planos por hotspot.
- Permitir configurar por plano quais campos coletar na compra: nome, telefone, email, CPF e endereco.
- Exibir compra de acesso no portal quando o hotspot estiver habilitado para bilheteria e possuir planos ativos.
- Gerar pagamento Pix via Mercado Pago.
- Receber webhook de pagamento e liberar acesso no MikroTik.
- Registrar compras e prospeccoes para uso comercial futuro.

## Fora do Escopo Inicial

- Cartao de credito.
- Checkout Pro redirecionado.
- Assinaturas recorrentes.
- Split de pagamento.
- Estorno automatico.
- Multi-tenant por empresa.
- Envio automatico de WhatsApp, SMS ou email.

## Permissoes

O modelo `Admin` passa a representar usuarios administrativos. Ele deve ganhar `role`, mantendo compatibilidade com o usuario inicial `admin`.

Perfis:

- `admin`: acesso total, incluindo usuarios.
- `manager`: gerencia MikroTiks, integracoes, hotspots, bilheteria/planos, dashboard e pode desconectar clientes.
- `user`: gerencia locais, vouchers, logins CPF e ve dashboard, mas nao desconecta clientes.

O backend deve validar permissao em todas as rotas administrativas, nao apenas esconder menu no frontend. O JWT deve carregar `id`, `usuario` e `role`. A rota `/auth/me` deve retornar o perfil para a interface montar o menu e bloquear telas sem permissao.

Rotas publicas do portal, compra e webhook continuam sem JWT, mas com validacoes proprias.

## Tela de Usuarios

Criar pagina administrativa `Usuarios`, visivel apenas para `admin`.

Campos:

- usuario
- senha
- role
- ativo

Regras:

- senha deve ser gravada com bcrypt.
- edicao de senha deve ser opcional.
- nao permitir que um usuario remova/desative a si mesmo quando for o ultimo admin ativo.
- seed deve criar `admin/admin123` com role `admin`.

## Integracoes

A tela atual de integracoes deve aceitar dois tipos:

- `IXC`: mantem os campos atuais de base URL, usuario e senha.
- `MERCADO_PAGO`: usa nome, token de acesso e chave/segredo de webhook.

Para evitar expor segredo ao frontend, a API deve mascarar credenciais sensiveis em todas as respostas de listagem e detalhe. A escrita continua recebendo valores completos. A integracao Mercado Pago ativa sera usada pelos hotspots que habilitarem compra online.

Nao ha plugin ou MCP Mercado Pago disponivel nesta sessao. A integracao sera feita diretamente pela API/SDK oficial do Mercado Pago no backend, isolada em um service para troca futura se surgir MCP.

## Hotspots

Adicionar configuracao de bilheteria no hotspot:

- compraOnline: boolean
- pagamentoIntegracaoId: integracao Mercado Pago opcional

Regra:

- se `compraOnline` estiver ativa, o hotspot deve possuir uma integracao Mercado Pago ativa para gerar Pix.
- a integracao IXC existente continua dedicada ao login por base externa; pagamento deve usar campo separado.

## Bilheteria

Criar pagina `Bilheteria` acessivel para `admin` e `manager`.

Planos:

- hotspot
- nome do plano
- tempo de sessao em minutos
- numero de conexoes simultaneas
- valor
- ativo
- coletarNome
- coletarTelefone
- coletarEmail
- coletarCpf
- coletarEndereco

Os planos desativados nao aparecem no portal, mas continuam no historico de compras. O valor deve ser persistido em centavos ou Decimal para evitar erro de ponto flutuante.

## Compra no Portal

No portal `/portal/:slug`, o botao `Comprar acesso` deixa de mostrar mensagem fixa e passa a abrir o fluxo real quando:

- hotspot ativo;
- compra online ativa;
- integracao Mercado Pago ativa;
- existe pelo menos um plano ativo.

Fluxo:

1. Cliente escolhe um plano.
2. Se o plano exige campos, o portal exibe apenas os campos marcados.
3. Se nenhum campo estiver marcado, o portal nao exibe formulario.
4. API cria uma compra pendente.
5. API cria pagamento Pix no Mercado Pago.
6. Portal mostra QR Code e copia-e-cola.
7. Webhook confirma pagamento.
8. API cria usuario hotspot no MikroTik e marca compra como liberada.
9. Portal consulta o status da compra e, quando liberada, envia o login final ao MikroTik.

Identificador de login:

- se CPF foi coletado, usar CPF normalizado como usuario.
- se CPF nao foi coletado, gerar codigo unico e usar esse codigo como usuario e senha.

O campo `conexoesSimultaneas` deve ser enviado para o MikroTik quando houver suporte local no service. Se a biblioteca RouterOS atual nao suportar esse atributo diretamente, a implementacao deve persistir o valor no plano e deixar a aplicacao pronta para mapear para o atributo correto do RouterOS sem bloquear o restante do fluxo.

## Pagamento Mercado Pago

Criar service dedicado para Mercado Pago com:

- criar pagamento Pix;
- consultar pagamento por id;
- validar status `approved`;
- validar assinatura do webhook quando a chave/segredo estiver configurada;
- mapear erros para mensagens seguras.

Dados esperados ao criar Pix:

- valor do plano;
- descricao com nome do plano/hotspot;
- email do comprador quando coletado, ou email tecnico padrao quando nao coletado;
- `external_reference` com id da compra;
- `notification_url` apontando para webhook da API.

Webhook:

- rota publica `/api/webhooks/mercado-pago`.
- recebe eventos de pagamento.
- consulta o pagamento na API do Mercado Pago antes de liberar acesso.
- usa `external_reference` para localizar a compra.
- deve ser idempotente: notificacoes repetidas nao podem criar acessos duplicados.

## Compras e Liberacao de Acesso

Adicionar modelo de compra/ticket com status:

- `PENDENTE`
- `PAGO`
- `LIBERADO`
- `FALHA_LIBERACAO`
- `EXPIRADO`, usado quando uma compra pendente passar do prazo operacional definido pela API para pagamento Pix

Campos principais:

- hotspotId
- planoId
- pagamentoIntegracaoId
- mercadoPagoPaymentId
- status
- valor
- loginUsuario
- loginSenha
- mac
- ip
- dados coletados
- timestamps de pagamento e liberacao

Ao confirmar pagamento, a API deve:

1. verificar se a compra ainda nao foi liberada;
2. determinar usuario/senha conforme CPF ou codigo unico;
3. criar usuario no MikroTik se ele estiver ativo;
4. registrar `Acesso` com tipo novo `COMPRA`;
5. marcar compra como `LIBERADO`.

Se a comunicacao com MikroTik falhar apos pagamento aprovado, a compra deve ficar como `FALHA_LIBERACAO` para suporte manual, sem perder o registro do pagamento.

## Prospeccoes

Criar aba `Prospeccoes`, acessivel para `admin` e `manager`.

Ela deve listar compradores que preencheram pelo menos um dado comercial:

- nome
- telefone
- email
- CPF
- endereco
- hotspot
- plano
- valor
- status da compra
- data da compra

Filtros:

- hotspot
- plano
- status
- periodo

Quando nenhum campo for coletado no plano, a compra nao deve gerar prospeccao com dados vazios, mas permanece no historico de compras.

## Frontend Administrativo

Atualizar menu conforme role:

- `admin`: Dashboard, Locais, MikroTiks, Integracoes, Hotspots, Bilheteria, Prospeccoes, Vouchers, Logins CPF, Configuracao MikroTik, Usuarios.
- `manager`: Dashboard, MikroTiks, Integracoes, Hotspots, Bilheteria, Prospeccoes, Configuracao MikroTik.
- `user`: Dashboard, Locais, Vouchers, Logins CPF.

No dashboard, esconder o botao `Desconectar` para `user`. O backend tambem deve bloquear a rota de desconexao para `user`.

## Testes

Backend:

- login retorna role.
- rotas bloqueiam roles sem permissao.
- admin consegue CRUD de usuarios.
- manager nao consegue gerenciar usuarios.
- user nao consegue desconectar cliente.
- planos filtram apenas ativos no portal.
- compra sem campos gera codigo unico.
- compra com CPF usa CPF normalizado como usuario.
- webhook aprovado libera uma unica vez mesmo com notificacoes repetidas.
- falha no MikroTik marca compra como `FALHA_LIBERACAO`.

Frontend:

- menu muda conforme role.
- dashboard oculta desconexao para `user`.
- portal mostra formulario apenas com campos configurados.
- portal sem campos pula formulario e cria Pix direto.

## Criterios de Aceitacao

- Admin consegue criar, editar e desativar usuarios.
- Manager gerencia MikroTiks, integracoes, hotspots e bilheteria, mas nao usuarios.
- User gerencia locais, vouchers e logins CPF, ve dashboard e nao desconecta clientes.
- Integracao Mercado Pago pode ser cadastrada e vinculada ao hotspot para compra.
- Bilheteria permite criar planos ativos/inativos com tempo, conexoes, valor e campos coletaveis.
- Portal exibe planos ativos e gera Pix.
- Webhook Mercado Pago confirma pagamento e libera acesso.
- Compra com CPF usa CPF como login MikroTik.
- Compra sem CPF usa codigo unico como login MikroTik.
- Prospeccoes exibem dados preenchidos pelos compradores.
- Build e testes relevantes passam.
