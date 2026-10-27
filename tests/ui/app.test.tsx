import { FIELD_LIMITS } from "@harness/ui-contract";
import { emptyEmpresa } from "@shared/empresa";
import { DEFAULT_CONFIG } from "@shared/types";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "@renderer/App";
import { Field } from "@renderer/components/Field";
import { AdsPowerPage } from "@renderer/pages/AdsPowerPage";
import { EmailPage } from "@renderer/pages/EmailPage";
import { FarmPage } from "@renderer/pages/FarmPage";
import { FarmRunPage } from "@renderer/pages/FarmRunPage";
import { SmsPage } from "@renderer/pages/SmsPage";

describe("UI contrato", () => {
  afterEach(() => {
    vi.useRealTimers();
    delete (window as { desktop?: unknown }).desktop;
  });

  it("mostra os 5 menus e troca de página", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole("button", { name: /Número Virtual/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Email \(mail\.tm\)/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /AdsPower/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Farm de BM$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Histórico$/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /4 · Farm/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Ainda não verificada/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Número Virtual/ }));
    expect(screen.getByRole("heading", { name: /Provedor de SMS/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Gerar número/ })).toBeInTheDocument();
    expect(screen.getByLabelText(/^DDD/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Grupo de serviço/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Opção do serviço/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Números/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Números/ }));
    expect(screen.getByText(/Ativações em andamento/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Email \(mail\.tm\)/ }));
    expect(screen.getByRole("button", { name: /Caixas/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Mensagens$/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Caixas/ }));
    expect(screen.getByRole("button", { name: /Gerar caixa nova/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /AdsPower/ }));
    expect(screen.queryByRole("button", { name: /Testar conexão/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Checando AdsPower/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Perfil de teste/)).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: /Grupo/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Farm de BM$/ }));
    expect(screen.getByRole("heading", { name: /Farm de BM/ })).toBeInTheDocument();
  });

  it("mostra ! na sidebar se SMS, e-mail ou AdsPower falhar", async () => {
    vi.useFakeTimers();
    window.desktop = {
      getConfig: async () => DEFAULT_CONFIG,
      getHistory: async () => [],
      engineStatus: async () => ({ running: false, mensagem: "Motor ocioso." }),
      farmState: async () => ({ running: false, batchSize: 1, companies: [], mensagem: "Farm ocioso." }),
      platform: async () => ({ id: "win", modKey: "Ctrl", version: "0.1.0" }),
      listLogs: async () => [],
      checkUpdate: async () => undefined,
      onLog: () => () => undefined,
      onPause: () => () => undefined,
      onFarmState: () => () => undefined,
      testSms: async () => ({ ok: false, mensagem: "SMS caiu" }),
      testEmail: async () => ({ ok: true, mensagem: "mail ok" }),
      listAdsPowerProfiles: async () => [],
    } as typeof window.desktop;
    render(<App />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByLabelText(/integração falhou/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Número Virtual/ })).toHaveTextContent("!");
    expect(screen.getByRole("button", { name: /^Farm de BM/ })).not.toHaveTextContent("!");
    expect(screen.getByRole("button", { name: /^Histórico$/ })).not.toHaveTextContent("!");
  });

  it("no card da empresa o PDF é seletor e o toggle de leitura vem ligado", () => {
    const config = structuredClone(DEFAULT_CONFIG);
    config.empresas = [emptyEmpresa("e1")];
    render(
      <FarmPage
        config={config}
        profiles={[
          { userId: "h1yynkm", serial: "2", name: "Perfil 2" },
          { userId: "abc123", serial: "1", name: "Perfil 1" },
        ]}
        onChange={() => undefined}
        onStartFarm={async () => undefined}
        onPickDocument={async () => undefined}
        onRemove={async () => undefined}
      />,
    );
    expect(screen.getByRole("checkbox", { name: /Ler PDF/ })).toBeChecked();
    expect(screen.getByRole("button", { name: /Escolher PDF/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Excluir empresa/ })).toBeInTheDocument();
    expect(screen.getByLabelText(/Perfil AdsPower/)).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /2 · Perfil 2/ })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /Documento original/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Preencher portfolio/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Iniciar farm/ })).toBeInTheDocument();
    expect(screen.getByLabelText(/Tamanho do lote/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Iniciar farm/ })).toBeEnabled();
    expect(screen.queryByText(/Obrigatório/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Adicione pelo menos uma empresa/)).not.toBeInTheDocument();
  });

  it("valida e destaca os campos só ao clicar em Iniciar farm", async () => {
    const user = userEvent.setup();
    const onStartFarm = vi.fn(async () => undefined);
    const config = structuredClone(DEFAULT_CONFIG);
    config.empresas = [emptyEmpresa("e1")];
    render(
      <FarmPage
        config={config}
        profiles={[{ userId: "h1yynkm", serial: "2", name: "Perfil 2" }]}
        onChange={() => undefined}
        onStartFarm={onStartFarm}
        onPickDocument={async () => undefined}
        onRemove={async () => undefined}
      />,
    );
    expect(screen.getByLabelText(/Razão social/)).not.toHaveAttribute("aria-invalid");
    await user.click(screen.getByRole("button", { name: /Iniciar farm/ }));
    expect(onStartFarm).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Razão social/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(/CEP/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getAllByText(/Obrigatório/).length).toBeGreaterThan(0);
  });

  it("não formata o texto enquanto o usuário digita", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [config, setConfig] = useState(() => {
        const next = structuredClone(DEFAULT_CONFIG);
        next.empresas = [emptyEmpresa("e1")];
        return next;
      });
      return (
        <FarmPage
          config={config}
          profiles={[]}
          onChange={setConfig}
          onStartFarm={async () => undefined}
          onPickDocument={async () => undefined}
          onRemove={async () => undefined}
        />
      );
    }
    render(<Harness />);
    await user.type(screen.getByLabelText(/Razão social/), "vesol energia");
    expect(screen.getByLabelText(/Razão social/)).toHaveValue("vesol energia");
    await user.type(screen.getByLabelText(/^CEP/), "89258001");
    expect(screen.getByLabelText(/^CEP/)).toHaveValue("89258001");
  });

  it("mostra o log da empresa e o badge de atenção durante o farm", () => {
    render(
      <FarmRunPage
        state={{
          running: true,
          batchSize: 1,
          mensagem: "Farm iniciado · lote 1.",
          companies: [
            {
              id: "e1",
              razaoSocial: "Vesol Energia Solar Ltda",
              status: "paused",
              attention: true,
              pause: { id: "p1", empresaId: "e1", reason: "captcha", message: "Meta pediu CAPTCHA — clique no card" },
              logs: [
                {
                  id: "l1",
                  timestamp: "2026-10-27T12:00:00.000Z",
                  empresaId: "e1",
                  level: "info",
                  message: "Abrindo perfil 2…",
                },
              ],
            },
          ],
        }}
        selectedId="e1"
        onSelect={() => undefined}
        onStop={async () => undefined}
        onResume={async () => undefined}
        onReport={async () => undefined}
        onDismiss={async () => undefined}
        onDismissAll={async () => undefined}
      />,
    );
    expect(screen.getByText(/Abrindo perfil 2/)).toBeInTheDocument();
    expect(screen.getByLabelText(/atenção/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Encerrar farm/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continuar/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reportar tela/ })).toBeEnabled();
  });

  it("mostra check verde e concluir por empresa quando a etapa termina", () => {
    render(
      <FarmRunPage
        state={{
          running: false,
          batchSize: 1,
          mensagem: "Farm concluído nesta fase (portfólio).",
          companies: [
            {
              id: "e1",
              razaoSocial: "Vesol Energia Solar Ltda",
              status: "ok",
              attention: false,
              logs: [
                {
                  id: "l1",
                  timestamp: "2026-10-27T12:00:00.000Z",
                  empresaId: "e1",
                  level: "info",
                  message: "Etapa portfolio já concluída · pulando · Bmnovaativa",
                },
              ],
            },
          ],
        }}
        selectedId="e1"
        onSelect={() => undefined}
        onStop={async () => undefined}
        onResume={async () => undefined}
        onReport={async () => undefined}
        onDismiss={async () => undefined}
        onDismissAll={async () => undefined}
      />,
    );
    expect(screen.getByLabelText(/concluída/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Concluir Vesol Energia Solar Ltda/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Concluir farm/ })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /Encerrar farm/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Ações de Vesol Energia Solar Ltda/)).toBeInTheDocument();
  });

  it("mostra as ações só da aba selecionada, acima do log", () => {
    render(
      <FarmRunPage
        state={{
          running: false,
          batchSize: 2,
          mensagem: "Farm concluído nesta fase (portfólio).",
          companies: [
            {
              id: "e1",
              razaoSocial: "Vesol Energia Solar Ltda",
              status: "ok",
              attention: false,
              logs: [{ id: "l1", timestamp: "2026-10-27T12:00:00.000Z", empresaId: "e1", level: "info", message: "Vesol ok" }],
            },
            {
              id: "e2",
              razaoSocial: "Outra Empresa Ltda",
              status: "ok",
              attention: false,
              logs: [{ id: "l2", timestamp: "2026-10-27T12:00:00.000Z", empresaId: "e2", level: "info", message: "Outra ok" }],
            },
          ],
        }}
        selectedId="e2"
        onSelect={() => undefined}
        onStop={async () => undefined}
        onResume={async () => undefined}
        onReport={async () => undefined}
        onDismiss={async () => undefined}
        onDismissAll={async () => undefined}
      />,
    );
    expect(screen.getByLabelText(/Ações de Outra Empresa Ltda/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Ações de Vesol Energia Solar Ltda/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Concluir Outra Empresa Ltda/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Concluir Vesol Energia Solar Ltda/ })).not.toBeInTheDocument();
    const actions = screen.getByLabelText(/Ações de Outra Empresa Ltda/);
    const log = screen.getByText(/Outra ok/).parentElement;
    expect(actions.compareDocumentPosition(log!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("lista os perfis do AdsPower quando a API local está ok", async () => {
    vi.useFakeTimers();
    const onListProfiles = vi.fn(async () => undefined);
    render(
      <AdsPowerPage
        config={DEFAULT_CONFIG}
        live={{ ok: true, mensagem: "AdsPower local ok." }}
        profiles={[
          {
            userId: "h1yynkm",
            serial: "2",
            name: "Loja Centro",
            groupName: "BMs",
            username: "loja@meta",
            domain: "facebook.com",
            remark: "proxy BR",
            ip: "13.251.172.174",
            ipCountry: "sg",
            lastOpenAt: "2021-05-18T10:17:10.000Z",
          },
        ]}
        onChange={() => undefined}
        onListProfiles={onListProfiles}
      />,
    );
    expect(screen.queryByLabelText(/Perfil de teste/)).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /^Nº$/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Nome/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /ID/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Grupo/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Conta/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Plataforma/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Proxy/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Observação/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Status/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Última abertura/ })).toBeInTheDocument();
    expect(screen.getByText("Loja Centro")).toBeInTheDocument();
    expect(screen.getByText("h1yynkm")).toBeInTheDocument();
    expect(screen.getByText("BMs")).toBeInTheDocument();
    expect(onListProfiles).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(onListProfiles).toHaveBeenCalledTimes(1);
  });

  it("não finge lista vazia quando o GET de perfis é plano pago", () => {
    render(
      <AdsPowerPage
        config={DEFAULT_CONFIG}
        live={{ ok: true, mensagem: "AdsPower local ok." }}
        profiles={[]}
        listError="A listagem oficial é plano pago. Buscando pelos seriais locais."
        onChange={() => undefined}
        onListProfiles={async () => undefined}
      />,
    );
    expect(screen.queryByText(/Crie um perfil no AdsPower/)).not.toBeInTheDocument();
    expect(screen.getByText(/plano pago/i)).toBeInTheDocument();
  });

  it("busca números toda vez que a subaba Números abre", async () => {
    const user = userEvent.setup();
    const onListNumbers = vi.fn(async () => undefined);
    render(
      <SmsPage
        config={DEFAULT_CONFIG}
        services={[]}
        onChange={() => undefined}
        onCreate={async () => undefined}
        onListNumbers={onListNumbers}
        onInbox={async () => undefined}
        onCancel={async () => undefined}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Números/ }));
    await user.click(screen.getByRole("button", { name: /Configuração/ }));
    await user.click(screen.getByRole("button", { name: /Números/ }));
    expect(onListNumbers).toHaveBeenCalledTimes(2);
  });

  it("mostra a tabela de ativações e busca de novo sem empilhar GET", async () => {
    vi.useFakeTimers();
    const onListNumbers = vi.fn(async () => undefined);
    const config = structuredClone(DEFAULT_CONFIG);
    config.sms.knownActivations = [
      {
        id: "88",
        phone: "5549920063023",
        status: "waiting_sms",
        serviceName: "Facebook",
        optionLabel: "1",
        createdAt: "2026-10-26T23:12:00.000Z",
        expiresAt: "2026-10-26T23:32:00.000Z",
        messages: [],
      },
    ];
    render(
      <SmsPage
        config={config}
        services={[]}
        onChange={() => undefined}
        onCreate={async () => undefined}
        onListNumbers={onListNumbers}
        onInbox={async () => undefined}
        onCancel={async () => undefined}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Números/ }));
    expect(screen.getByText("Facebook")).toBeInTheDocument();
    expect(screen.getByText("5549920063023")).toBeInTheDocument();
    expect(screen.getByText("ATIVO")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cancelar/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Código SMS/ })).toBeInTheDocument();
    expect(onListNumbers).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });
    expect(onListNumbers).toHaveBeenCalledTimes(2);
  });

  it("filtra opções pelo grupo e só ativa DDD quando a opção aceita", async () => {
    const user = userEvent.setup();
    const services = [
      {
        id: "60033",
        code: "fb",
        name: "Facebook",
        options: [
          { apiId: "1", name: "Opção 1", priceFormatted: "R$ 1.30", available: 10, allowsDdd: true },
          { apiId: "3", name: "Opção 3", priceFormatted: "R$ 1.43", available: 8, allowsDdd: false },
        ],
      },
      {
        id: "2",
        code: "wa",
        name: "Whatsapp",
        options: [{ apiId: "9", name: "Opção 3", priceFormatted: "R$ 2.00", available: 1, allowsDdd: false }],
      },
    ];
    function Harness() {
      const [config, setConfig] = useState(structuredClone(DEFAULT_CONFIG));
      return (
        <SmsPage
          config={config}
          live={{ ok: true, mensagem: "SMS autenticado." }}
          services={services}
          onChange={setConfig}
          onCreate={async () => undefined}
          onListNumbers={async () => undefined}
          onInbox={async () => undefined}
          onCancel={async () => undefined}
        />
      );
    }
    render(<Harness />);
    expect(screen.getByLabelText(/Grupo de serviço/)).toHaveDisplayValue(/Facebook/);
    expect(screen.getByLabelText(/Opção do serviço/)).toHaveDisplayValue(/Opção 1/);
    expect(screen.getByLabelText(/^DDD/)).toBeEnabled();
    expect(screen.getByText(/Opcional · taxa de \+30%/)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/Opção do serviço/), "3");
    expect(screen.getByLabelText(/^DDD/)).toBeDisabled();
    await user.selectOptions(screen.getByLabelText(/Grupo de serviço/), "2");
    expect(screen.getByLabelText(/Opção do serviço/)).toHaveDisplayValue(/Opção 3/);
    expect(screen.getByLabelText(/^DDD/)).toBeDisabled();
  });

  it("limita input e mantém o valor rolável", async () => {
    const user = userEvent.setup();
    let value = "";
    const view = render(
      <Field id="t" label="Razão" maxLength={FIELD_LIMITS.short} value={value} onChange={(next) => {
        value = next;
        view.rerender(<Field id="t" label="Razão" maxLength={FIELD_LIMITS.short} value={value} onChange={(n) => { value = n; }} />);
      }} />,
    );
    const input = screen.getByLabelText(/Razão/);
    expect(input).toHaveAttribute("maxLength", String(FIELD_LIMITS.short));
    await user.type(input, "A".repeat(120));
    expect(value.length).toBeLessThanOrEqual(FIELD_LIMITS.short);
  });

  it("Tab vai ao próximo campo", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <Field id="a" label="Um" maxLength={20} value="" onChange={() => undefined} />
        <Field id="b" label="Dois" maxLength={20} value="" onChange={() => undefined} />
      </div>,
    );
    await user.tab();
    expect(screen.getByLabelText(/Um/)).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText(/Dois/)).toHaveFocus();
  });

  it("abre a caixa pela ação e mostra o histórico local das mensagens", async () => {
    const user = userEvent.setup();
    const onOpenInbox = vi.fn(async () => undefined);
    const onListInboxes = vi.fn(async () => undefined);
    const config = structuredClone(DEFAULT_CONFIG);
    config.email.knownInboxes = [
      {
        id: "a1",
        address: "bmteste@mail.tm",
        token: "t1",
        password: "p1",
        createdAt: "2026-10-26T23:00:00.000Z",
        active: true,
        empresaId: "e1",
        razaoSocial: "Vesol Energia Solar Ltda",
        adspowerProfile: "2",
        messages: [{ id: "m1", from: "meta@fb.com", subject: "Confirme sua BM", intro: "código a caminho" }],
      },
    ];
    render(
      <EmailPage
        config={config}
        onChange={() => undefined}
        onCreate={async () => undefined}
        onListInboxes={onListInboxes}
        onOpenInbox={onOpenInbox}
      />,
    );
    expect(screen.queryByRole("button", { name: /Gerar caixa nova/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Caixas/ }));
    expect(screen.getByText("bmteste@mail.tm")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Empresa \/ perfil AdsPower/ })).toBeInTheDocument();
    expect(screen.getByText("Vesol Energia Solar Ltda · perfil 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Copiar e-mail/ })).toBeInTheDocument();
    expect(screen.getByText("ATIVO")).toBeInTheDocument();
    expect(onListInboxes).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("tab", { name: /^Mensagens$/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Mensagens$/ }));
    expect(onOpenInbox).toHaveBeenCalledWith("bmteste@mail.tm");
    expect(screen.getByText("Confirme sua BM")).toBeInTheDocument();
    expect(screen.getByText(/meta@fb.com/)).toBeInTheDocument();
  });
});
