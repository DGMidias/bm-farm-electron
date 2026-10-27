import { FIELD_LIMITS } from "@harness/ui-contract";
import { DEFAULT_CONFIG } from "@shared/types";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "@renderer/App";
import { Field } from "@renderer/components/Field";
import { EmailPage } from "@renderer/pages/EmailPage";
import { SmsPage } from "@renderer/pages/SmsPage";

describe("UI contrato", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("mostra os 5 menus e troca de página", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole("button", { name: /Número Virtual/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Email \(22\.do\)/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /AdsPower/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Farm de BM/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Histórico/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Número Virtual/ }));
    expect(screen.getByRole("heading", { name: /Provedor de SMS/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Gerar número/ })).toBeInTheDocument();
    expect(screen.getByLabelText(/^DDD/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Grupo de serviço/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Opção do serviço/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Números/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Números/ }));
    expect(screen.getByText(/Ativações em andamento/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Email \(22\.do\)/ }));
    expect(screen.getByRole("button", { name: /Caixas/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Caixas/ }));
    expect(screen.getByRole("button", { name: /Gerar caixa nova/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /AdsPower/ }));
    expect(screen.getByRole("button", { name: /Abrir e controlar navegador/ })).toBeInTheDocument();
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

  it("mostra a tabela de ativações e busca de novo a cada 5s", async () => {
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
      await vi.advanceTimersByTimeAsync(5000);
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
    expect(screen.getByText("ATIVO")).toBeInTheDocument();
    expect(onListInboxes).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: /Abrir/ }));
    expect(onOpenInbox).toHaveBeenCalledWith("bmteste@mail.tm");
    expect(screen.getByText("Confirme sua BM")).toBeInTheDocument();
    expect(screen.getByText(/meta@fb.com/)).toBeInTheDocument();
  });
});
