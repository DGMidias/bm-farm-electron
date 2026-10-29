# Etapas do farm de BM

Colinha do pipeline. **Iniciar farm** roda as etapas 1, 2 e 3.

| # | id | O que faz | Status |
|---|---|---|---|
| 1 | `portfolio` | Seletor superior esquerdo → **Criar um portfólio empresarial** → modal de 4 campos (razão, nome/sobrenome do Facebook, 22.do). URL inicial: `https://adsmanager.facebook.com/adsmanager/onboarding?nav_source=fb4b` | pronta |
| 2 | `empresa` | `latest/settings/business_info?business_id=` → **Editar** em Detalhes da empresa → razão, Brasil, endereço, telefone, site, CNPJ/EIN → **Salvar** | pronta |
| 3 | `email_confirm` | `business_info`: se não há **Confirmação pendente**, pula. Senão abre o checkpoint da caixa 22.do no AdsPower | pronta |
| 4 | `whatsapp` | Conta WhatsApp Business | depois |
| 5 | `verificacao_dados` | Central de Segurança: dados | depois |
| 6 | `verificacao_documento` | Upload do PDF CNPJ | depois |
| 7 | `verificacao_sms` | OTP — pausa humana | depois |
| 8 | `verificacao_nome` | Nome comercial | depois |
| 9 | `verificacao_endereco` | Endereço | depois |
| 10 | `verificacao_contato` | Telefone e site | depois |

Regra de etapa (desenvolvimento e produção): se a etapa **já está concluída** no perfil, o farm **loga** e **pula**. Não recria, não trata como erro.

A etapa 1 (`portfolio`) **só** está concluída se a **razão social do card** estiver no chrome das settings **ou** visível na página/seletor (vale com o sufixo “N ativos de negócios”) **ou** se a Meta recusar o nome porque já existe. `business_id` na URL da home **não** basta — se a razão não está na página (Vesol no perfil, card Pba), o id é descartado e a etapa cria. Home `latest/home` ou uma página/Instagram do perfil atual **não** conta. As etapas 1–3 reusam a mesma aba do AdsPower.

Locators são genéricos (papel/texto do chrome da Meta). O seletor abre pelo `combobox` cujo nome tem **portfólio empresarial**, **sem** o nome do ativo e sem clicar 2FA/País. Comparar razão social é a única busca por dado do card.

Login de verdade é `login.php` com campo de senha. `business/loginpage` com sessão já logada **não** é logout: se o modal **Crie seu portfólio empresarial** (3 campos + Enviar) já estiver aberto, preenche — não clica **Continuar com o Facebook** atrás do overlay. Só pausa por login quando há senha.

Fluxo da etapa 1:

1. Landing do Gerenciador (`portfolio.landing`) — clicar **Criar portfólio empresarial** (link) ou **Começar**. Se redirecionar para o home, segue para o seletor (não pula).
2. Canto superior esquerdo — abrir o `combobox` (`portfolio.switcher`) e ler a lista **Portfólios empresariais**.
3. Se a razão já estiver listada: log `Etapa portfolio já concluída · pulando · {razão} · listada no seletor`.
4. Senão, dois fluxos:
   - **Seletor (Business Suite):** **Criar um portfólio empresarial** → 4 campos (razão, nome, sobrenome, e-mail) → **Criar** → Avançar / Avançar / Confirmar.
   - **Gerenciador (landing):** `loginpage` com sessão já logada. Se o modal de 3 campos já estiver aberto, preenche (razão, nome se vazio, e-mail) e **Enviar**. Só clica **Continuar com o Facebook** quando o chooser está sozinho, sem o diálogo.
   Nome vem do Facebook logado. E-mail comercial é **sempre** uma caixa 22.do nova em Gmail, Outlook ou Hotmail (sorteio), nos dois fluxos — nunca o e-mail do PDF/CNPJ. A verificação da Meta cai nessa caixa, ligada à empresa e ao perfil AdsPower na aba Email.
5. **Criar** → assistente da Meta: **Avançar** / **Confirmar**, **ou** `/latest/` com `business_id` e a razão no chrome (heading/toolbar da settings, mesmo com innerText vazio) — etapa 1 fecha sem seletor. Depois de Confirmar não abre o seletor. Overlay do assistente não pode derrubar a empresa.
6. O AdsPower e a aba **não fecham** ao encerrar o worker — a conferência é no Chromium do perfil.
7. A tela de log só some quando o operador clica **Concluir** na empresa (ou **Concluir farm** quando todas terminaram). Check verde na aba = etapa ok.

Rótulos do modal (PT / EN):

- Nome do portfólio empresarial / Business portfolio name
- Nome / First name
- Sobrenome / Last name
- Email comercial / Business email
- Nome da sua conta e empresa / Your business and account name (modal de 3 campos)
- Seu nome / Your name (às vezes já vem preenchido)
- Seu email comercial / Business email
- Enviar / Submit
