import { FIELD_LIMITS } from "@harness/ui-contract";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "@renderer/App";
import { Field } from "@renderer/components/Field";

describe("UI contrato", () => {
  it("mostra os 5 menus e troca de página", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole("button", { name: /SMS/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /E-mail/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /AdsPower/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Farm de BM/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Histórico/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /SMS/ }));
    expect(screen.getByRole("heading", { name: /Provedor de SMS/ })).toBeInTheDocument();
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
});
