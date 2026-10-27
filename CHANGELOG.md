# Changelog

Formato: data · o que mudou · por que · o que não desfazer.

## 2026-10-27 — Farm: suite vazia com business_id vai para pessoas do portfólio

- **O quê:** depois de criar, `latest/home?business_id=` com "Não é possível acessar o Meta Business Suite" deixa de ser tela desconhecida. O farm lê o `business_id` e abre `/latest/settings/business_users/?nav_ref=bm_settings_redirect_migration&bm_redirect_migration=true&business_id=`. Aí abre o seletor para conferir a razão. O home que já funciona (`Etapas para começar`) continua `portfolio.existing`. As settings seguintes montam a URL com esse id.
- **Por quê:** BM recém-criado ainda não tem Página/Instagram; o seletor na home vazia não abre e o worker pedia Continuar.
- **Não desfazer:** locators genéricos. Sem pausa humana nessa tela. Sem clicar pelo nome da empresa.

## 2026-10-27 — Farm: etapa 1 sempre gera caixa mail.tm nova

- **O quê:** ao preencher o portfólio (seletor de 4 campos ou modal de 3 + Enviar), o farm gera uma caixa mail.tm nova e usa esse endereço. Ignora o e-mail comercial do PDF/card. A caixa fica na aba Email com razão social e perfil AdsPower. Uma caixa por execução, reusada se o modal repetir.
- **Por quê:** a verificação da Meta chega nesse e-mail. O card já vinha com o e-mail do CNPJ e o worker pulava a geração; a listagem ficava só com caixas avulsas de ontem, sem empresa/perfil.
- **Não desfazer:** locators genéricos. Sem e-mail real da empresa no formulário da etapa 1.

## 2026-10-27 — Farm: modal de 3 campos manda no chooser

- **O quê:** se o diálogo **Crie seu portfólio empresarial** já está aberto (Nome da sua conta e empresa / Seu nome / Seu email comercial / **Enviar**), o farm preenche e envia. Não clica **Continuar com o Facebook** atrás do overlay. `Seu nome` pré-preenchido fica; só completa o que estiver vazio. O snapshot de 80 linhas do `loginpage` deixa de decidir isso — o locator do modal decide.
- **Por quê:** no perfil 4 o modal já estava na tela; o recorte do body só via o chooser e o worker clicava em loop.
- **Não desfazer:** locators genéricos (rótulo/papel). Sem nome de perfil ou empresa no clique.

## 2026-10-27 — Farm: segundo fluxo de criar portfólio (3 campos + Enviar)

- **O quê:** a landing do Gerenciador pode abrir o modal antigo (Nome da sua conta e empresa / Seu nome / Seu email comercial / **Enviar**). O `loginpage` com esse modal ou com **Continuar com o Facebook** deixa de ser tratado como “perfil sem login”. Só `login.php` + senha pausa.
- **Por quê:** o perfil 4 já estava logado; o chooser e o modal de 3 campos foram classificados como logout.
- **Não desfazer:** o fluxo do seletor (4 campos + Criar + Avançar/Confirmar) continua. Locators genéricos.

## 2026-10-27 — Farm: espera o CTA da landing hidratar

- **O quê:** na landing do Gerenciador o farm espera até 8s por **Criar portfólio empresarial** ou **Começar**. Se o clique no link (abaixo do fold) falhar, tenta o outro CTA em vez de chamar tela desconhecida.
- **Por quê:** o perfil 4 já tinha a landing normal; o worker olhou cedo demais e o link ainda não estava clicável.
- **Não desfazer:** locators genéricos. Sem nome de empresa.

## 2026-10-27 — Farm: perfil sem login pausa em qualquer etapa

- **O quê:** `business/loginpage`, `facebook.com/login` e `login_options` viram pausa humana com log `Perfil N não está logado na Meta`. Não tenta seletor nem formulário.
- **Por quê:** o perfil 3 caiu no chooser de login da Meta e o farm pediu para abrir o seletor.
- **Não desfazer:** login só no Chromium do AdsPower. Sem bypass. Serve para qualquer etapa.

## 2026-10-27 — Farm: Avançar, Avançar, Confirmar depois de criar

- **O quê:** o assistente pós-criação deixa de ser pulado. Clica **Avançar** em adicionar ativos, **Avançar** em adicionar pessoas e **Confirmar** no resumo. Aí a etapa 1 fecha (ainda confere a razão no seletor).
- **Por quê:** Pular abortava o fluxo; a Meta só conclui o portfólio depois do Confirmar.
- **Não desfazer:** locators genéricos (Avançar/Confirmar). Sem nome de empresa no clique.

## 2026-10-27 — Farm: conferência do seletor ignora “N ativos” e o erro de nome repetido

- **O quê:** a lista do seletor compara a razão mesmo quando o item vem com “0 ativos de negócios”. O recorte de 80 linhas do snapshot deixa de ser a fonte da lista (lê o body inteiro). Se a Meta disser que o nome já existe, a etapa 1 é `ok`. Depois de enviar o modal, o farm não preenche de novo.
- **Por quê:** Pba Contabilidade Ltda já estava na lista; a comparação exata falhou e o modal de erro fez o worker criar de novo.
- **Não desfazer:** só a razão do card entra na comparação. Locators continuam genéricos.

## 2026-10-27 — Farm: Pular o modal de adicionar Página/Instagram

- **O quê:** depois de **Criar**, se a Meta perguntar o que adicionar ao portfólio, o farm clica **Pular**. Clique no seletor que o overlay bloquear deixa de virar `erro` (tenta force; se falhar, pausa). Nome do Facebook ignora chrome tipo “Conheça o Meta Business Suite”.
- **Por quê:** o overlay do modal cobria o `combobox` e o timeout encerrava a empresa com o portfólio já criado.
- **Não desfazer:** locators genéricos (Pular/Skip). Não clicar Avançar nesse modal.

## 2026-10-27 — Farm: seletor genérico, sem nome de perfil

- **O quê:** o chip do canto superior esquerdo abre pelo papel `combobox`, não pelo nome do ativo. O harness recusa locator com nome de página/BM/empresa. Comparar razão social continua só para saber se o portfólio já está na lista.
- **Por quê:** cada perfil AdsPower mostra um ativo diferente; clicar em "Bmnovaativa" (ou qualquer razão) quebra o lote.
- **Não desfazer:** locators genéricos. Sem busca por nome de página para clicar.

## 2026-10-27 — Farm: etapa 1 pelo seletor + e-mail associado + status global

- **O quê:** a etapa 1 só pula se a razão social estiver em **Portfólios empresariais**. Criação: seletor superior esquerdo → modal de 4 campos (razão, nome/sobrenome do Facebook logado, mail.tm gerado na hora). Confirma reabrindo a lista. A listagem de e-mail mostra empresa/perfil AdsPower. SMS, mail.tm e AdsPower sondam no app inteiro; `!` na sidebar se a integração falhar.
- **Por quê:** `latest/home` / Bmnovaativa é um ativo dentro de outro portfólio, não o da empresa. O e-mail temporário precisa existir já na criação e aparecer associado ao card.
- **Não desfazer:** CAPTCHA/OTP continuam pausa humana. AdsPower permanece aberto. Farm/Histórico não usam o `!` de integração. AdsPower segue no teto de 1 req/s.

## 2026-10-27 — Farm: ações da aba ficam acima do log

- **O quê:** Reportar tela, Continuar e Concluir [empresa] saem do topo e ficam **acima do log**, só da aba selecionada. Encerrar / Concluir farm continuam no topo.
- **Por quê:** misturar ação global com a da empresa escondia de qual perfil era o botão.
- **Não desfazer:** check verde e revisão manual continuam.

## 2026-10-27 — Farm: revisão manual com check verde

- **O quê:** ao terminar uma empresa a tela de log **não some**. A aba ganha check verde. **Concluir [empresa]** fecha só aquela subaba; **Concluir farm** aparece quando todas terminaram. Encerrar farm só enquanto ainda roda ou pede ação.
- **Por quê:** pular o portfólio já existente soltava a UI e sumia o log antes de dar para revisar.
- **Não desfazer:** AdsPower continua aberto. Nada fecha sozinho após o ok.

## 2026-10-27 — Farm: etapa já concluída é pulada

- **O quê:** regra no harness (`SKIP_COMPLETED_ETAPA`): etapa pronta no perfil vira log `já concluída · pulando` e sai `ok`. Na etapa 1, `latest/home` / `portfolio.existing` (Bmnovaativa) não pausa nem erra — pula.
- **Por quê:** no desenvolvimento o perfil 2 já tinha BM; tratar isso como tela desconhecida ou erro travava o lote.
- **Não desfazer:** não recria portfólio por cima. CAPTCHA/OTP continuam pausa humana. AdsPower permanece aberto.

## 2026-10-27 — Farm: home de BM existente não é tela desconhecida

- **O quê:** `business.facebook.com/latest/home?nav_ref=bm_home_redirect` vira `portfolio.existing`. O log diz o nome (Bmnovaativa) e o `business_id`. Continuar na mesma tela encerra a etapa sem fechar o AdsPower. Reportar tela só solta o CDP uma vez.
- **Por quê:** o perfil 2 já tem um BM; o clique em **Criar portfólio empresarial** redireciona para o home (`asset_id=1404934486035164`). O farm chamava isso de desconhecido e logava "CDP solto" duas vezes (perfil 2 e perfil ?).
- **Não desfazer:** o farm não cria outro portfólio por cima do que já está aberto. CAPTCHA/OTP continuam pausa humana.

## 2026-10-27 — Farm: AdsPower fica aberto e o log diz o nome

- **O quê:** ao terminar (ok, erro ou Encerrar farm) o worker só solta o CDP. Não fecha aba, não dá `browser.close` nem `browser/stop`. O log de execução traz razão, responsável, e-mail e `business_id`. Landing que cai num BM já aberto (`latest/home?business_id=`) não conta como criação — pausa para conferir.
- **Por quê:** o clique em **Criar portfólio empresarial** foi para o BM `Bmnovaativa` (`1393146169269525`); o farm gritou "Portfólio criado" e derrubou o perfil antes de dar para olhar.
- **Não desfazer:** CAPTCHA/OTP continuam pausa humana. Facebook só no Chromium do AdsPower. Quem fecha o perfil é o operador.

## 2026-10-27 — Farm: landing do onboarding e Reportar tela

- **O quê:** o worker reconhece a landing do Gerenciador, clica **Criar portfólio empresarial** (link) ou **Começar**, espera o modal e só então preenche os 3 campos. Captura grava `meta.json` + `screen.png` + `dom.html`. Em erro/timeout ou no botão **Reportar tela** a captura sempre sai, e aquela empresa encerra com log da pasta.
- **Por quê:** a URL `adsmanager/onboarding` era classificada como formulário; o CTA da landing não era clicado e o farm ficava esperando um modal que não abriu.
- **Não desfazer:** CAPTCHA/OTP continuam pausa humana. **Encerrar farm** ainda mata o lote inteiro; **Reportar tela** só a empresa da aba. Facebook só no Chromium do AdsPower.

## 2026-10-27 — AdsPower/SMS/e-mail: live sem estourar a API

- **O quê:** o AdsPower deixa de listar o tempo todo no app. Farm e AdsPower compartilham um poll; a API local vai no máximo a 1 request/s; lista em cache se vier "Too many request". SMS e mail.tm não empilham GET se o anterior ainda não voltou.
- **Por quê:** `/user/list` + `/browser/active` a cada 5s, duas vezes, tomava `Too many request per second`.
- **Não desfazer:** a tabela e o select de perfil continuam com a última lista boa; o relógio do SMS segue a 1s só na UI.

## 2026-10-27 — Farm: validação só no Iniciar farm, título só no PDF

- **O quê:** o card não grita erro enquanto você digita. **Iniciar farm** valida na hora, marca os inputs errados e mostra o motivo. Razão/nome/endereço em título e e-mail minúsculo só entram quando o comprovante CNPJ preenche o card.
- **Por quê:** formatar a cada tecla travava CEP e o resto; o aviso vermelho no card vazio atrapalhava o preenchimento.
- **Não desfazer:** a validação dura no start continua (HTTPS, CNPJ, perfil único). Digitação livre no input.

## 2026-10-27 — Farm: Iniciar farm cria o portfólio em lote

- **O quê:** some o Preencher por etapa. Um **Iniciar farm** + tamanho do lote sobe N perfis AdsPower, abre **aba nova**, captura a tela, preenche razão/responsável/e-mail e tenta Criar. A UI trava com subaba, log e ! se precisar de você. CAPTCHA tenta o checkbox uma vez e pausa. Empresas gravam quando o farm começa.
- **Por quê:** a fase 1 é só o portfólio empresarial; as outras etapas ficam na colinha (`docs/farm-etapas.md`) sem botão.
- **Não desfazer:** Facebook continua só no Chromium do AdsPower. Não fechamos aba alheia nem damos `browser/stop` em perfil que o operador já tinha aberto. Sem solver de CAPTCHA/OTP.


## 2026-10-27 — Farm: seletor de PDF lembra a última pasta

- **O quê:** a primeira abertura é a pasta Downloads real do Windows e do Mac. Depois de escolher um PDF, a próxima vez abre nessa pasta.
- **Por quê:** sempre cair em Downloads obrigava a navegar de novo até `documentos`.
- **Não desfazer:** se a pasta sumir, volta para Downloads. A pasta fica na config, não no rascunho da empresa.

## 2026-10-27 — Farm: nomes em título, e-mail em minúsculo

- **O quê:** razão, responsável, endereço, complemento e cidade saem com a primeira letra de cada palavra; `de/da/do/del` ficam minúsculos. E-mail em minúsculo. UF em maiúsculo. CNPJ, CEP e telefone não mudam.
- **Por quê:** o cartão da Receita vem em caixa alta; o card não precisa gritar.
- **Não desfazer:** o valor original do PDF continua sendo a fonte; a formatação de título não roda na digitação.

## 2026-10-27 — Farm: cartão CNPJ da Receita pelo texto do PDF

- **O quê:** o comprovante impresso em `cnpjreva/comprovante` é lido pelo texto ToUnicode (não por OCR). Preenche razão (`NOME EMPRESARIAL`), CNPJ (`NÚMERO DE INSCRIÇÃO`), endereço (`LOGRADOURO` + `NÚMERO`), cidade, UF e complemento. Asteriscos no complemento ficam vazios. CNAE não vira CNPJ.
- **Por quê:** o PDF do Chrome é `about:blank` com fonte CID; o OCR lia CNAE e inventava `00.332.959/9474-23`.
- **Não desfazer:** e-mail, telefone e CEP continuam vindo do mesmo cartão; OCR só entra se o texto embutido não tiver razão e CNPJ.

## 2026-10-27 — Farm: OCR por palavras, select AdsPower e rascunho

- **O quê:** o comprovante é lido pelas palavras do OCR (não só telefone/CEP). O perfil AdsPower vira select atualizado a cada 5s nesta aba. Cada card tem Excluir. O rascunho das empresas não grava no disco até o farm começar.
- **Por quê:** o GET de listagem pago e o OCR em página inteira perdiam razão, CNPJ e endereço; persistir o card cedo apagava o trabalho ao fechar sem farmar.
- **Não desfazer:** SMS, e-mail e AdsPower continuam persistidos; o farm só fica na memória enquanto troca de aba.

## 2026-10-27 — Farm: ícones, update no GitHub e PDF da Receita

- **O quê:** Farm e Histórico ficam ícone + nome. O app checa atualização sozinho ao abrir, no `latest.json` do GitHub Releases. O comprovante CNPJ vira seletor de PDF (pasta Downloads); o toggle **Ler PDF** (ligado) preenche razão, CNPJ, endereço, bairro, cidade, UF, CEP, telefone, e-mail e site.
- **Por quê:** npm não atualiza app compilado; a release com `.exe` (Windows) e `.zip` (Mac) é o caminho. O PDF da Receita já tem os dados da empresa.
- **Não desfazer:** responsável e perfil AdsPower continuam manuais; CAPTCHA/OTP seguem pausa humana.

## 2026-10-27 — AdsPower: listar perfis sem o GET pago

- **O quê:** se `/user/list` vier "paid subscriptions", o app não finge lista vazia. Ele descobre os perfis pelo serial via `/browser/active` e mostra o status aberto/fechado.
- **Por quê:** no plano gratuito a listagem oficial é bloqueada, mas os 2 perfis locais respondem por serial.
- **Não desfazer:** com plano pago o GET /user/list continua sendo a fonte rica (nome, grupo, proxy).

## 2026-10-27 — AdsPower: listagem de perfis no lugar do ID

- **O quê:** some o botão Testar conexão e o campo de ID. Com a badge ok, a tela lista os perfis da API local (nº, nome, ID, grupo, conta, plataforma, proxy, observação, última abertura) e atualiza a cada 5s.
- **Por quê:** o ID digitado era o passo extra; o AdsPower já tem os perfis.
- **Não desfazer:** a badge continua testando só `/status`; o Facebook continua fora desta janela.

## 2026-10-27 — AdsPower: menu com logo e probe no GitHub

- **O quê:** o item lateral fica ícone + **AdsPower**. A badge testa a API local a cada 5s. **Testar conexão** abre `https://github.com/DGMidias/bm-farm-electron` só no Chromium do perfil (CDP).
- **Por quê:** o mesmo padrão das outras integrações; o Facebook continua fora da janela Electron.
- **Não desfazer:** o poll da badge não inicia o navegador; o farm start() não navega para o GitHub.

## 2026-10-27 — Caixas: copiar e-mail e Mensagens só pela listagem

- **O quê:** cada linha tem copiar endereço e o botão **Mensagens** (no lugar de Abrir). A subaba Mensagens some do menu; só abre pela ação daquela caixa. O item lateral fica ícone + **Email (mail.tm)**.
- **Por quê:** a subaba solta não dizia de qual caixa era; copiar o endereço era o passo que faltava para testar o recebimento.
- **Não desfazer:** Serviço e Caixas continuam no subnav; o GET da caixa aberta segue a cada 5s.

## 2026-10-26 — E-mail volta para mail.tm

- **O quê:** a 22.do sai. O e-mail usa de novo `api.mail.tm` (domínio, criar conta, token por caixa). Menu volta a **2 · E-mail**.
- **Por quê:** a 22.do cobra por chamada de API; o mail.tm cobre gerar caixa e ler mensagem sem essa taxa.
- **Não desfazer:** as subabas Serviço / Caixas / Mensagens e o histórico local continuam.

## 2026-10-26 — E-mail passa a ser 22.do

- **O quê:** mail.tm sai. A aba usa `https://22.do/api/v2` (token → Bearer, POST /account, POST /inbox). Menu lateral fica ícone + **Email (22.do)**. Sem token configurado, o serviço não roda.
- **Por quê:** a 22.do documenta criar caixa e ler mensagem com a mesma conta; o mail.tm não tinha esse controle.
- **Não desfazer:** URL e token ficam no `config.json`; o Bearer cacheado some ao trocar o token.

## 2026-10-26 — E-mail: serviço, caixas e histórico local

- **O quê:** a aba E-mail só checa se o mail.tm está no ar. Subaba Caixas gera e lista endereços; Abrir abre Mensagens daquela caixa (se o token/senha ainda valer) e o GET a cada 5s grava o que chegar no `config.json`.
- **Por quê:** dava para ter só uma caixa por vez e não havia histórico do que o app viu.
- **Não desfazer:** extração de código por template fica para depois; senha e token ficam por caixa, sem misturar.

## 2026-10-26 — Menu lateral Número Virtual

- **O quê:** o primeiro item do menu deixa de ser `1 · SMS` e passa a ser a logo oficial + **Número Virtual**.
- **Por quê:** o provedor é a Número Virtual; o número no menu não dizia isso.
- **Não desfazer:** os outros itens continuam numerados; a logo fica no app, sem hotlink.

## 2026-10-26 — Lista de ativações da plataforma, não só as do app

- **O quê:** o POST abre o envelope (`activation`/`phoneNumber`) em vez de gravar id vazio. A subaba Números faz GET `/activations` a cada 5s, mostra a tabela da loja (opção, serviço, número com copiar, SMS, ATIVO, rest, cancelar, data) e guarda localmente o que o GET enxergar + histórico de mudanças.
- **Por quê:** gerar no app sumia da lista; a API lista o que está em andamento, mas não o histórico frio.
- **Não desfazer:** número sem id não entra no cache; GET da lista tem fallback por IDs já vistos; refresh da aba não trava o botão Gerar.

## 2026-10-26 — SMS em grupo + opção, com DDD só onde a API aceita

- **O quê:** select de grupo (Facebook, WhatsApp…) filtra as opções do serviço; cada opção mostra número, preço e ícone se aceita DDD. O DDD só fica ativo nessas opções, com aviso de opcional e taxa de +30%. `apiId` e DDD vão para o `config.json`.
- **Por quê:** a loja da numero-virtual agrupa assim; mandar DDD em opção que não aceita falha ou cobra errado.
- **Não desfazer:** DDD some do POST quando a opção não aceita; Facebook continua o grupo padrão.

## 2026-10-26 — GET de números a cada abertura da subaba

- **O quê:** o GET dos números roda no clique de Números, inclusive ao voltar da configuração.
- **Por quê:** o efeito só disparava na primeira troca de estado; reabrir a subaba não atualizava status, SMS nem prazo.
- **Não desfazer:** a busca continua sendo por IDs gerados neste app.

## 2026-10-26 — SMS em configuração persistida + subaba de números

- **O quê:** select de todos os DDDs (padrão 35), select de serviços com Facebook padrão, badge de conexão/saldo a cada 5s, subaba Números com GET ao abrir, ler SMS e cancelar/reembolsar.
- **Por quê:** o farm das BMs vai reutilizar DDD e serviço salvos; a tela antiga misturava teste, import e botões soltos.
- **Não desfazer:** serviços só carregam com conexão ok; cancelar usa DELETE da ativação; sem import de número externo.

## 2026-10-26 — DDD 35/49 e números já comprados

- **O quê:** a compra de SMS envia `ddd` (35 ou 49). A tela lista os números gerados aqui, importa um ID já existente e lê o SMS daquele número.
- **Por quê:** a API cobra o DDD na criação e não tem GET de histórico; sem o campo e sem o cache local não dava para forçar área nem reler um número específico.
- **Não desfazer:** `ddd` só vai no POST se tiver 2 dígitos; a listagem pública continua inexistente — só IDs conhecidos.

## 2026-10-26 — SMS Bearer + logs no terminal

- **O quê:** a API `app.numero-virtual.com` autentica com `Authorization: Bearer`, testa `/balance`, gera número em `/activations` e lê `smsCode`. Logs de error/warn/info vão para o terminal, `userData/logs/app.log` e o menu Histórico. Chave colada duas vezes é cortada.
- **Por quê:** o cliente antigo mandava só `x-api-key` para `/me`; esse host responde exatamente "envie Bearer" e `/me` não existe.
- **Não desfazer:** Bearer obrigatório no host `.com`; HTML do site não conta como sucesso; segredos saem redigidos do log.

## 2026-10-26 — Testes reais de SMS, e-mail e AdsPower

- **O quê:** SMS fala com `api.numero-virtual.app` (`/me`, gerar número, ler SMS mais recente). E-mail testa mail.tm, gera caixa e lê código/link de confirmação. AdsPower testa a API local e abre o perfil via CDP.
- **Por quê:** as três telas só “pingavam” URL; agora dá para validar conta, gerar recurso e receber a mensagem/controlar o navegador.
- **Não desfazer:** header `x-api-key`; ler o último SMS por `receivedAt`; Facebook continua fora da `BrowserWindow`.

## 2026-10-26 — Base Electron 0.1.0

- **O quê:** scaffold Electron + Vite + React, cinco menus (SMS, e-mail, AdsPower, Farm, Histórico), persistência em userData, harness Win+Mac, auto-update por `latest.json`, mapa `mapas/meta-bm.v1.json`, motor CDP supervisionado e pausa humana.
- **Por quê:** a fatia 0 do plano precisa de UI estável, HMR e gate de compatibilidade antes de crescer o farm.
- **Não desfazer:** `harness/compat.ts` como única fonte de path/atalho; Facebook fora da janela Electron; CI `windows-latest` + `macos-latest` como gate.
