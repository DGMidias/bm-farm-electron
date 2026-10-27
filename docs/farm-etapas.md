# Etapas do farm de BM

Colinha do pipeline. Só a etapa 1 roda no **Iniciar farm**.

| # | id | O que faz | Status |
|---|---|---|---|
| 1 | `portfolio` | Seletor superior esquerdo → **Criar um portfólio empresarial** → modal de 4 campos (razão, nome/sobrenome do Facebook, mail.tm). URL inicial: `https://adsmanager.facebook.com/adsmanager/onboarding?nav_source=fb4b` | pronta |
| 2 | `empresa` | Informações da empresa / EIN = CNPJ | depois |
| 3 | `whatsapp` | Conta WhatsApp Business | depois |
| 4 | `verificacao_dados` | Central de Segurança: dados | depois |
| 5 | `verificacao_documento` | Upload do PDF CNPJ | depois |
| 6 | `verificacao_sms` | OTP — pausa humana | depois |
| 7 | `verificacao_nome` | Nome comercial | depois |
| 8 | `verificacao_endereco` | Endereço | depois |
| 9 | `verificacao_contato` | Telefone e site | depois |

Regra de etapa (desenvolvimento e produção): se a etapa **já está concluída** no perfil, o farm **loga** e **pula**. Não recria, não trata como erro.

A etapa 1 (`portfolio`) **só** está concluída se a **razão social do card** aparecer em **Portfólios empresariais** no seletor (vale com o sufixo “N ativos de negócios”) **ou** se a Meta recusar o nome porque já existe. Home `latest/home` ou uma página/Instagram do perfil atual **não** conta.

Locators são genéricos (papel/texto do chrome da Meta). O seletor abre pelo `combobox` do canto superior esquerdo, **sem** o nome do ativo. Comparar razão social é a única busca por dado do card.

Login de verdade é `login.php` com campo de senha. `business/loginpage` com sessão já logada **não** é logout: se o modal **Crie seu portfólio empresarial** (3 campos + Enviar) já estiver aberto, preenche — não clica **Continuar com o Facebook** atrás do overlay. Só pausa por login quando há senha.

Fluxo da etapa 1:

1. Landing do Gerenciador (`portfolio.landing`) — clicar **Criar portfólio empresarial** (link) ou **Começar**. Se redirecionar para o home, segue para o seletor (não pula).
2. Canto superior esquerdo — abrir o `combobox` (`portfolio.switcher`) e ler a lista **Portfólios empresariais**.
3. Se a razão já estiver listada: log `Etapa portfolio já concluída · pulando · {razão} · listada no seletor`.
4. Senão, dois fluxos:
   - **Seletor (Business Suite):** **Criar um portfólio empresarial** → 4 campos (razão, nome, sobrenome, e-mail) → **Criar** → Avançar / Avançar / Confirmar.
   - **Gerenciador (landing):** `loginpage` com sessão já logada. Se o modal de 3 campos já estiver aberto, preenche (razão, nome se vazio, e-mail) e **Enviar**. Só clica **Continuar com o Facebook** quando o chooser está sozinho, sem o diálogo.
   Nome vem do Facebook logado. E-mail comercial é **sempre** uma caixa mail.tm nova, nos dois fluxos — nunca o e-mail do PDF/CNPJ. A verificação da Meta cai nessa caixa, ligada à empresa e ao perfil AdsPower na aba Email.
5. **Criar** → assistente da Meta: **Avançar** (adicionar ativos) → **Avançar** (adicionar pessoas) → **Confirmar**. Depois reabrir o seletor. Só então `ok`. Se a razão não listar: captura + pausa humana. Overlay do assistente não pode derrubar a empresa.
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
