# Changelog

Formato: data · o que mudou · por que · o que não desfazer.

## 2026-10-27 — Farm: seletor de PDF lembra a última pasta

- **O quê:** a primeira abertura é a pasta Downloads real do Windows e do Mac. Depois de escolher um PDF, a próxima vez abre nessa pasta.
- **Por quê:** sempre cair em Downloads obrigava a navegar de novo até `documentos`.
- **Não desfazer:** se a pasta sumir, volta para Downloads. A pasta fica na config, não no rascunho da empresa.

## 2026-10-27 — Farm: nomes em título, e-mail em minúsculo

- **O quê:** razão, responsável, endereço, complemento e cidade saem com a primeira letra de cada palavra; `de/da/do/del` ficam minúsculos. E-mail em minúsculo. UF em maiúsculo. CNPJ, CEP e telefone não mudam.
- **Por quê:** o cartão da Receita vem em caixa alta; o card não precisa gritar.
- **Não desfazer:** o valor original do PDF continua sendo a fonte; só a apresentação do input muda.

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
