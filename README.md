# Hotspot MikroTik

Sistema de gerenciamento de hotspot MikroTik em monorepo Node.js + Vue.js + SQLite.

O PHP legado foi movido para `legacy-php/` e deve ser usado somente como consulta historica. A aplicacao ativa esta na stack nova.

## Estrutura

```text
hotspot/
+-- apps/
|   +-- api/
|   |   +-- data/
|   |       +-- hotspot.sqlite
|   +-- web/
+-- packages/
|   +-- shared/
+-- legacy-php/
```

- `apps/api`: API Node.js.
- `apps/web`: frontend Vue.js.
- `packages/shared`: codigo compartilhado entre API e web.
- `apps/api/data/hotspot.sqlite`: banco SQLite local.
- `legacy-php/`: versao PHP antiga, apenas para referencia.

## Requisitos

- Node.js
- pnpm

## Instalacao

```bash
pnpm install
pnpm --filter api db:push
pnpm --filter api db:seed
pnpm dev
```

URLs em desenvolvimento:

- API: `http://localhost:3333`
- Web: `http://localhost:5173`

O usuario administrador padrao em desenvolvimento e:

- Usuario: `admin`
- Senha: `admin123`

Em producao, defina `ADMIN_PASSWORD` para trocar a senha inicial do administrador.

## Variaveis de ambiente

- `JWT_SECRET`: obrigatorio em producao. Use um segredo forte e exclusivo do ambiente.
- `ADMIN_PASSWORD`: senha inicial do admin em producao.
- `VITE_API_URL`: opcional no frontend. Em desenvolvimento, a web usa proxy de `/api` para `http://localhost:3333`.

Quando um MikroTik estiver marcado como ativo na plataforma, a API tenta comunicar com o RouterOS de verdade usando os dados cadastrados em `MikroTiks`. Para testes locais sem roteador, deixe o MikroTik cadastrado como inativo.

## Comandos

```bash
pnpm build
pnpm lint
pnpm test
```

## Banco SQLite

O banco local fica em:

```text
apps/api/data/hotspot.sqlite
```

Inclua esse arquivo na rotina de backup do servidor. Para migracoes/alteracoes de schema, rode:

```bash
pnpm --filter api db:push
```

Para recriar dados iniciais de desenvolvimento:

```bash
pnpm --filter api db:seed
```

## Configuracao da plataforma

Configure a operacao na plataforma nesta ordem:

1. Cadastre os locais em `Locais`.
2. Cadastre os roteadores em `MikroTiks`.
3. Cadastre os portais em `Hotspots`, vinculando local e MikroTik.
4. Configure se o hotspot aceita login por voucher e/ou CPF.
5. Gere vouchers em `Vouchers`, informando hotspot, quantidade e tempo.
6. Cadastre acessos em `Logins CPF` quando o login por CPF estiver ativo.
7. Exporte o `login.html` pela tela `Configuracao MikroTik`.

## Exportar login.html

Na tela `Configuracao MikroTik`, selecione o hotspot e exporte o `login.html` correspondente. Envie esse arquivo para a pasta do hotspot no MikroTik, substituindo o arquivo original quando necessario.

Sempre que alterar URL publica, modo de login ou configuracoes relacionadas ao portal, exporte novamente o `login.html` e reenvie para o MikroTik.

## Configuracao RouterOS

Execute os passos abaixo no terminal do RouterOS, ajustando senhas, enderecos e dominio conforme seu ambiente.

### Habilitar API

```routeros
/ip service enable api
/ip service set api port=8728
```

### Criar usuario de API

```routeros
/user group add name=hotspot-api policy=read,write,api
/user add name=api password=SENHA_FORTE group=hotspot-api
```

### Configurar profile do hotspot

Habilite login por HTTP CHAP/PAP no profile usado pelo hotspot:

```routeros
/ip hotspot profile set [find name=default] login-by=http-chap,http-pap
```

Se o seu profile tiver outro nome, troque `default` pelo profile correto.

Esse comando configura o Hotspot Server Profile. No cadastro `MikroTiks` da plataforma, o campo `Profile de usuario Hotspot` deve receber um profile de `/ip hotspot user profile`, nao o Server Profile. Se nao criar um profile especifico, use normalmente `default`.

### Walled Garden

Permita que clientes nao autenticados acessem o servidor da plataforma.

Com dominio:

```routeros
/ip hotspot walled-garden add dst-host=wifi.seudominio.com.br action=allow
```

Com IP:

```routeros
/ip hotspot walled-garden ip add dst-address=192.168.88.10 action=accept
```

### Upload de arquivos

No WinBox ou via FTP/SFTP, envie para a pasta do hotspot:

- `login.html` exportado pela plataforma.
- `md5.js` do MikroTik, quando usar HTTP CHAP.

O `md5.js` deve ficar na mesma pasta do hotspot que contem o `login.html`.

## Observacoes sobre CHAP/PAP

Quando `http-chap` estiver ativo, o login final precisa usar o `md5.js` do MikroTik. O arquivo `login.html` exportado pela plataforma preserva os parametros necessarios do RouterOS, incluindo:

- `link-login-only`
- `chap-id`
- `chap-challenge`

Esses dados sao usados para montar o POST final de login no MikroTik. Se o `md5.js` nao estiver na pasta correta do hotspot, o login CHAP pode falhar. Se usar apenas `http-pap`, revise os requisitos de seguranca do ambiente e prefira HTTPS quando houver trafego fora de rede confiavel.

## Integracao real com MikroTik

Com o MikroTik ativo na plataforma, a integracao real ja fica habilitada. Confirme host, porta, usuario, senha, timeout e `Profile de usuario Hotspot` cadastrados em `MikroTiks`.

Use a acao de teste de conexao antes de liberar o hotspot em producao. Se falhar, revise:

- `/ip service print` para confirmar a API habilitada e a porta correta.
- Firewall/NAT entre o servidor da plataforma e o RouterOS.
- Usuario API com permissao `read,write,api`.
- Profile informado em `profilePadrao`; ele precisa existir em `/ip hotspot user profile print`.

## Producao

Antes de publicar:

- Defina `JWT_SECRET`.
- Defina `ADMIN_PASSWORD`.
- Configure backup de `apps/api/data/hotspot.sqlite`.
- Configure corretamente os roteadores MikroTik, hotspots e walled garden.
- Exporte e envie o `login.html` atualizado para cada hotspot.
