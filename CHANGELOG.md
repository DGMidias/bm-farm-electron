# Changelog

Formato: data · o que mudou · por que · o que não desfazer.

## 2026-10-30 — Menu OpenAI na sidebar

- **O quê:** item OpenAI depois do AdsPower. A chave e a URL base ficam no `userData/config.json`. O main testa `GET /models` e tenta uso/custo da org. Badge e `!` na nav se falhar. Sem botão Testar. Crédito só aparece se a chave tiver permissão de admin.
- **Por quê:** o farm vai usar o agente depois; esta tela só prova a conexão e mostra models/rate/saldo.
- **Não desfazer:** o farm ainda não chama o modelo. Sem Vision. Sem logar a key. Sem facebook.com no Electron.

## 2026-10-29 — Depois de Confirmar, etapa 1 fecha sem seletor

- **O quê:** após o assistente, a etapa 1 espera `/latest/settings/` e lê a razão no heading/toolbar. Não abre o seletor. InnerText vazio na settings recém-aberta não conta como “não criou”.
- **Por quê:** a Pba já estava em `business_info?business_id=1144460734714607` e o farm pedia o seletor.
- **Não desfazer:** locators genéricos. Sem clicar a razão. Confirmar ainda é o fim do assistente.

## 2026-10-28 — Pba não é Vesol; uma aba só

- **O quê:** `business_id` só herda se razão e CNPJ do card forem os mesmos. Chrome de outro BM (Vesol) não pula a etapa 1 nem abre esse id. Home `business_id=` igual ao stored **não** conta se a razão não está na página. Seletor confirma a razão; senão cria e descarta o id vazado. As etapas 1–3 reusam a mesma aba do AdsPower.
- **Por quê:** a Pba reusou o UUID da Vesol e herdou `1013153098495280`. O farm pulou a criação, abriu a Vesol e ainda criava aba nova a cada etapa.
- **Não desfazer:** storedId sozinho não navega, nem na home. Sem clicar a razão. Probe do AdsPower ainda pode abrir aba se o perfil estiver vazio.

## 2026-10-28 — Etapa 3: Confirmação pendente no chrome

- **O quê:** a etapa 3 abre `business_info` e lê o aviso **Confirmação pendente**. Sem o aviso, pula. Com o aviso, abre o checkpoint na caixa e volta na settings. Sem pausa pedindo para o usuário confirmar o e-mail.
- **Por quê:** o farm já tinha confirmado, mas pedia ação humana. O chrome da empresa (Email + Editar, sem badge) é o sinal de pronto.
- **Não desfazer:** login e CAPTCHA ainda pausam. Sem abrir PNG. Sem "confirme o e-mail no AdsPower".

## 2026-10-28 — Link de e-mail: checkpoint, não o PNG

- **O quê:** o extrator ignora `/images/`, `.png` e pixel de abertura. Vale `confirmemail.php` e `business.facebook.com/verify/email/checkpoint`. Sem fallback para qualquer URL da Meta.
- **Por quê:** o HTML da Meta começa com `facebook.com/images/email/meta_icon.png` — o `/email/` no path fazia o farm abrir o ícone.
- **Não desfazer:** sem abrir imagem. Sem facebook.com no Electron; o AdsPower é quem abre o link.

## 2026-10-28 — Etapa 1 vai ao business_id do card

- **O quê:** se o card já tem `business_id` e o chrome é outro BM (home do William), o farm abre esse id — sem seletor. Se já estiver nele, pula a etapa 1. O seletor aceita o combobox do BM aberto e continua ignorando **Ninguém** (2FA).
- **Por quê:** a Vesol (`1013153098495280`) já existia, mas o farm ficava no `147307…` e não ia para a etapa 2.
- **Não desfazer:** storedId ganha. Sem clicar a razão social. Sem 2FA.

## 2026-10-28 — Não clicar no select de 2FA

- **O quê:** o seletor só abre combobox cujo nome tem "portfólio empresarial". País só o combobox **País**. Depois de criar, `/latest/` com `business_id` e a razão no chrome fecha a etapa 1 sem seletor — inclusive `business_info`.
- **Por quê:** na settings o único combobox é **Ninguém** (2FA). O farm clicava nele e pausava pedindo o seletor, em vez de ir para o fill da empresa.
- **Não desfazer:** sem clicar combobox sem nome. Sem locator pela razão social.

## 2026-10-28 — Etapa 1: Aceito na política de anúncios

- **O quê:** no onboarding de perfil vazio, se a Meta abrir a política de não discriminação, o farm clica **Aceito** e depois **Concluir** (papéis button). Só então tenta Criar portfólio.
- **Por quê:** o diálogo tapa o formulário; o farm ficava clicando Criar portfólio e a landing redirecionava sem `business_id`.
- **Não desfazer:** locators genéricos (Aceito / I Accept / Concluir). Sem clicar nome de empresa. Sem bypass de login/CAPTCHA/OTP.

## 2026-10-28 — AdsPower: acha serial mesmo se 1-3 não existem

- **O quê:** `/user/list` pago continua caindo no scan local, mas miss no começo (perfis 1-3 apagados) não aborta. Acha 4 e 5. Também sonda o serial dos cards. "Profile does not exist" deixa de lotar o log.
- **Por quê:** a API local está ok, mas a lista oficial é plano pago e o fallback parava em 3 misses — a tabela ficava vazia com perfil 4 aberto.
- **Não desfazer:** sem fingir `/user/list` no plano free. Sem GET pago.

## 2026-10-28 — AdsPower: API local sem key

- **O quê:** o farm não manda mais `Authorization` na API local. A aba só pede a URL e pede para desligar a autenticação por API key no AdsPower. Config antiga perde a key no read.
- **Por quê:** a chave local rotaciona e quebra o `/status`, a lista e o start do perfil.
- **Não desfazer:** SMS e 22.do continuam com token/key. Sem voltar campo de API key do AdsPower.

## 2026-10-28 — Gmail/Outlook: parse do generate e usa a conta comprada

- **O quê:** `/gmail/generate` devolve `aa.bb.cc+tag` + `domains: [@gmail.com]` — agora monta o e-mail. Se `/microsoft/generate` der 500, usa a conta Outlook/Hotmail que a compra já devolveu.
- **Por quê:** o app achava que o Gmail não gerou endereço e descartava o Outlook recém-comprado.
- **Não desfazer:** sem voltar para domínio twbeta na geração.

## 2026-10-28 — Gerar caixa tenta os 3 se um estiver sem estoque

- **O quê:** `Out of stock` num tipo (Hotmail, p.ex.) não aborta. Tenta Gmail, Outlook e Hotmail; só falha se os três estiverem vazios.
- **Por quê:** o sorteio caía num módulo sem estoque na 22.do e a aba Configuração mostrava erro cru.
- **Não desfazer:** mesma geração na Configuração, Caixas e etapa 1.

## 2026-10-28 — Caixa nova é Gmail, Outlook ou Hotmail

- **O quê:** `POST /account` (twbeta) sai. Cada caixa sorteia Gmail, Outlook ou Hotmail; sem estoque compra 1 ID. Leitura usa `/gmail/inbox` ou `/microsoft/inbox`. Configuração, Caixas e Farm explicam isso. Badge do teste mostra o estoque.
- **Por quê:** a Meta não entregava confirmação em `twbeta.com`.
- **Não desfazer:** etapa 1 sempre gera caixa nova. Sem token, pausa. Caixa antiga twbeta ainda lê em `/inbox`.

## 2026-10-28 — Farm só edita o BM do card

- **O quê:** etapa 1 não fecha só porque a razão está no seletor. Sem o chrome/URL desse BM, vai para o `business_id` gravado ou pausa. Etapa 2 recusa preencher se o chrome for outra empresa. O id fica no card e o save da UI não apaga.
- **Por quê:** perfil com vários BMs (Vesol no chrome, Solfacil no card) gravava os detalhes no portfólio errado.
- **Não desfazer:** não clicar no nome da empresa no seletor. Sem `business_id`, pausa humana.

## 2026-10-28 — 22.do: lê o inbox de verdade e espera o e-mail

- **O quê:** `POST /inbox` aceita array ou `items`/`list`; mensagem sem `messageId` não some. O save da UI não apaga caixa que o farm gravou. Etapa 3 espera ~1,5 min na mesma caixa (20×5s). A aba Caixas sonda a cada 8s.
- **Por quê:** a Ebes (`nttxs1fn9pa6u6ne@twbeta.com`) estava persistida, mas 4 polls em 15s liam 0 e o parse/save podiam esconder o mail.
- **Não desfazer:** sem gerar outra caixa na etapa 3. Sem facebook.com na janela Electron.

## 2026-10-28 — E-mail: gerar na Configuração e excluir na listagem

- **O quê:** a aba Configuração ganha **Gerar caixa nova**. Cada linha de Caixas tem **Excluir**, que tira o endereço do histórico local.
- **Por quê:** gerar só na listagem e não poder limpar caixas mortas (mail.tm antiga, teste) atrapalhava o painel.
- **Não desfazer:** a 22.do não apaga conta por API; a exclusão some só da listagem do app.

## 2026-10-28 — E-mail passa a ser 22.do

- **O quê:** mail.tm sai. A aba usa `https://22.do/api/v2` (token da dashboard → Bearer, POST /account, POST /inbox). Menu lateral fica ícone + **Email (22.do)** com painel de URL e token. Etapas 1 e 3 usam essa caixa. Sem token, o serviço não roda.
- **Por quê:** a assinatura da 22.do cobre gerar caixa e ler a confirmação da Meta com a mesma conta.
- **Não desfazer:** token só no `config.json`. Sem facebook.com na janela Electron. Caixas mail.tm antigas ficam SEM ACESSO.

## 2026-10-28 — mail.tm: /domains em JSON puro

- **O quê:** `GET /domains` com `Accept: application/json` vem como array (`[{ domain }]`), não `hydra:member`. O parser lê os dois formatos.
- **Por quê:** o badge do mail.tm mostrava "respondeu sem domínio" com a API no ar.
- **Não desfazer:** sem trocar o provedor. Sem gravar senha de caixa em outro lugar.

## 2026-10-28 — Farm: etapa 3 confirma o e-mail pela caixa mail.tm

- **O quê:** depois da empresa, o farm lê a caixa mail.tm associada (empresa/perfil ou `email_comercial`), pega o link da Meta no HTML e abre no Chromium do AdsPower. Token vencido tenta de novo com a senha guardada; Mensagens abre mesmo com SEM ACESSO.
- **Por quê:** a listagem marcava todas as caixas sem acesso e o farm parava antes de confirmar o e-mail da BM.
- **Não desfazer:** confirmação só no AdsPower via CDP. Sem facebook.com na janela Electron. Sem clicar pelo nome da empresa.

## 2026-10-28 — Farm: depois do Confirmar, settings com razão fecha a etapa 1

- **O quê:** suite vazia → pessoas do portfólio com `business_id` e a razão no chrome (ex.: Tek Energy Ltda) conclui a etapa 1 sem abrir o seletor. Segue para informações da empresa.
- **Por quê:** o seletor não abre nessa settings e o farm pedia Continuar com o portfólio já criado.
- **Não desfazer:** locators genéricos. Sem clicar pelo nome da empresa. Só compara a razão para saber se é a BM certa.

## 2026-10-28 — Farm: telefone comercial (NN) NNNNN-NNNN

- **O quê:** o número virtual entra no modal como `(35) 99988-7766`. Etapa 2 de informações da empresa fecha nesse formato.
- **Por quê:** a Meta e a conferência visual pedem DDD + 9 dígitos com máscara, não o E.164 cru.
- **Não desfazer:** só o número virtual no telefone comercial. Sem o telefone do PDF.

## 2026-10-28 — Farm: etapa 2 gera número virtual

- **O quê:** ao preencher Detalhes da empresa, o farm gera um número novo no Número Virtual (URL+key), usa só ele no telefone comercial e lista a ativação com razão social e perfil AdsPower. Pular etapa 2 não gera linha. Sem integração, pausa. O telefone do PDF deixa de ser obrigatório no card.
- **Por quê:** a verificação da Meta precisa da linha virtual, no mesmo padrão da caixa mail.tm.
- **Não desfazer:** SMS só com URL e API key. Sem telefone do CNPJ no modal. Sem etapa nova no pipeline.

## 2026-10-28 — Farm: etapa 2 não salva de novo se já estiver preenchida

- **O quê:** se a página já tem razão e endereço, o farm conclui a etapa 2 mesmo com o modal aberto. Depois de um Salvar sem erro, encerra — não preenche outra vez.
- **Por quê:** o operador abriu o modal para conferir e o worker salvou de novo por cima do que já estava ok.
- **Não desfazer:** locators genéricos. Sem clicar pelo nome da empresa.

## 2026-10-28 — Farm: busca Brasil no select de país

- **O quê:** depois de abrir o combobox **País**, o farm digita **Brasil** no campo de busca da listbox (a lista é virtualizada e só renderiza o A). Aí clica a opção.
- **Por quê:** o select abria em Afeganistão e o option Brasil não existia no DOM.
- **Não desfazer:** locators genéricos. País fixo Brasil.

## 2026-10-28 — Farm: País Brasil, bairro na linha 2 e erro de salvar

- **O quê:** o combobox **País** abre a lista fora do modal; o farm clica a opção **Brasil** na página. Sem país, não salva. Toast "Não foi possível salvar" / "Erro ao realizar a consulta" vira pausa, não loop. A linha 2 do endereço usa o **bairro** do comprovante (não sala/complemento). O campo do card passa a se chamar Bairro.
- **Por quê:** a Meta recusa salvar com país vazio; a lista do país é portal fora do diálogo; a linha 2 estava com sala.
- **Não desfazer:** locators genéricos. País fixo Brasil. Sem clicar pelo nome da empresa.

## 2026-10-28 — Farm: etapa 2 usa o BM da sessão e preenche o modal aberto

- **O quê:** ao pular o portfólio já listado, o `business_id` da landing desta sessão vai para as settings. O id antigo gravado no card (outro BM) deixa de ganhar. Se o modal **Editar detalhes da empresa** já está aberto, preenche e salva — sem pausar por "outro portfólio".
- **Por quê:** a Vesol estava na lista (`1618424756678450`) e o worker abriu `business_info` da Pba (`1629787285455853`) e parou no formulário vazio.
- **Não desfazer:** locators genéricos. Sem clicar pelo nome da empresa.

## 2026-10-28 — Farm: modal da empresa já aberto é preenchido

- **O quê:** o diálogo **Editar detalhes da empresa** é detectado pelos campos (País, placeholder da razão, EIN), não pelas 80 linhas do body. Se o modal já está aberto, preenche. `waitForText` no recorte curto deixa de decidir se o Editar funcionou. `business_id` de outro portfólio na home não é gravado no card.
- **Por quê:** o overlay fica no fim do DOM; o worker via o menu atrás e pedia para abrir o modal que já estava na tela.
- **Não desfazer:** locators genéricos. Sem clicar pelo nome da empresa.

## 2026-10-27 — Farm: Editar da página não é o modal

- **O quê:** "Editar" + "Detalhes da empresa" na página de settings deixa de valer como modal aberto. O farm clica o **Editar** que vem depois do título da seção e só então preenche.
- **Por quê:** o snapshot junta as linhas e o worker tentava preencher campos que ainda não existiam.
- **Não desfazer:** locators genéricos. Sem clicar pelo nome da empresa.

## 2026-10-27 — Farm: etapa 2 preenche detalhes da empresa

- **O quê:** depois do portfólio, o farm abre `/latest/settings/business_info?business_id=` e clica **Editar** em **Detalhes da empresa**. Preenche razão, país **Brasil**, endereço, cidade, UF, CEP, telefone, site e CNPJ (EIN) e **Salvar**. Se a página já tiver razão e endereço, pula. CAPTCHA tem um gancho automático (`attemptAutomaticCaptcha`) que hoje sempre falha e só então pede ação humana.
- **Por quê:** a BM recém-criada nasce sem dados fiscais; o card do PDF já tem o que o modal pede.
- **Não desfazer:** locators genéricos (rótulo/seção). Sem clicar pelo nome da empresa. País fixo Brasil. Sem bypass de CAPTCHA.

## 2026-10-27 — Farm: card sem campo de responsável

- **O quê:** o input **Responsável** some do card. Iniciar farm não exige esse dado. Nome e sobrenome do portfólio continuam vindo da conta do Facebook logada (ou do “Seu nome” pré-preenchido no modal de 3 campos).
- **Por quê:** o operador não precisa digitar o nome; o farm já lê da sessão da Meta.
- **Não desfazer:** locators genéricos. Sem nome de empresa no clique.

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
