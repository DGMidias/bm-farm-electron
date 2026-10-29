import {
  emailConfirmSucceeded,
  emailReady,
  extractConfirmationLink,
  extractValidationCode,
  filterMicrosoftByKind,
  firstGeneratedAddress,
  forgetInbox,
  inboxApiForKind,
  isMailOutOfStock,
  mailKindsToTry,
  inboxRecords,
  inboxStatusLabel,
  isLegacyMailInbox,
  mailKindFromAddress,
  map22DoMessage,
  mergeKnownInboxes,
  mapMailMessage,
  mergeSeenMessages,
  normalizeEmailBase,
  parse22DoData,
  parseMailIdList,
  pickRealMailKind,
  rememberInbox,
  sanitizeEmailToken,
  shouldPurchaseMailStock,
} from "../../src/main/mail-22do";
import {
  confirmationLinkFromInbox,
  emailConfirmEtapaConcluida,
  emailConfirmPendingOnSettings,
  findCompanyInbox,
  inboxOwnerLabel,
} from "@shared/mail-view";
import { smsReady } from "../../src/main/sms";
import { describe, expect, it } from "vitest";

describe("adapters", () => {
  it("guarda caixas e mescla só o que o GET enxergar", () => {
    const first = {
      id: "a1",
      address: "bm1@22.do",
      token: "",
      password: "",
      createdAt: "2026-10-26T23:00:00.000Z",
      active: true,
      messages: [],
    };
    const second = { ...first, id: "a2", address: "bm2@22.do" };
    expect(rememberInbox([], { ...first, address: "" })).toEqual([]);
    const list = rememberInbox(rememberInbox([], first), second);
    expect(list.map((item) => item.address)).toEqual(["bm2@22.do", "bm1@22.do"]);
    expect(forgetInbox(list, "bm1@22.do").map((item) => item.address)).toEqual(["bm2@22.do"]);
    expect(forgetInbox(list, "")).toEqual(list);
    const live = [mapMailMessage({ id: "m2", from: { address: "meta@fb.com" }, subject: "Novo", intro: "oi", createdAt: "2026-10-26T23:10:00.000Z" })];
    const cached = [mapMailMessage({ id: "m1", from: { address: "old@x.com" }, subject: "Velho", intro: "já vi" })];
    const merged = mergeSeenMessages(live, cached);
    expect(merged.map((item) => item.id).sort()).toEqual(["m1", "m2"]);
    expect(inboxStatusLabel(true)).toBe("ATIVO");
    expect(inboxStatusLabel(false)).toBe("SEM ACESSO");
    const owned = rememberInbox([], {
      ...first,
      razaoSocial: "Vesol Energia Solar Ltda",
      adspowerProfile: "2",
      empresaId: "e1",
    });
    expect(owned[0]?.razaoSocial).toBe("Vesol Energia Solar Ltda");
    expect(inboxOwnerLabel(owned[0]!)).toBe("Vesol Energia Solar Ltda · perfil 2");
  });

  it("só fica pronto com URL e token da 22.do", () => {
    expect(emailReady({ baseUrl: "", token: "abc" })).toBe(false);
    expect(emailReady({ baseUrl: "https://22.do/api/v2", token: "" })).toBe(false);
    expect(emailReady({ baseUrl: "https://22.do/dash/", token: "  tok  " })).toBe(true);
    expect(normalizeEmailBase("https://22.do/dash/")).toBe("https://22.do/api/v2");
    expect(sanitizeEmailToken("  ab cd  ")).toBe("abcd");
    expect(isLegacyMailInbox("bm1@mail.tm")).toBe(true);
    expect(isLegacyMailInbox("user@premium.22do.test")).toBe(false);
  });

  it("lê /inbox como array, items ou message_id e não dropa sem id", () => {
    expect(inboxRecords([{ messageId: "1" }])).toHaveLength(1);
    expect(inboxRecords({ items: [{ message_id: "2", subject: "Oi" }] })).toHaveLength(1);
    expect(inboxRecords({ list: [{ mailId: "3" }] })).toHaveLength(1);
    expect(inboxRecords({ hello: true })).toEqual([]);
    const byAlt = map22DoMessage({ message_id: "abc", subject: "Confirme", from: "meta@fb.com" });
    expect(byAlt.id).toBe("abc");
    const noId = map22DoMessage({ time: 1745411165, from: "meta@fb.com", subject: "Confirme" });
    expect(noId.id).toContain("1745411165");
    const merged = mergeSeenMessages([noId], []);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.subject).toBe("Confirme");
    const base = {
      id: "x",
      token: "",
      password: "",
      createdAt: "2026-10-26T23:00:00.000Z",
      active: true,
      messages: [],
    };
    const disk = [{ ...base, address: "farm@twbeta.com", empresaId: "e1" }];
    const ui = [{ ...base, address: "ui@twbeta.com" }];
    expect(mergeKnownInboxes(disk, ui).map((item) => item.address).sort()).toEqual(["farm@twbeta.com", "ui@twbeta.com"]);
  });

  it("lê envelope da 22.do e a mensagem do inbox", () => {
    expect(parse22DoData<{ email: string }>({ code: 200, status: true, data: { email: "a@b.com" } }).email).toBe("a@b.com");
    expect(() => parse22DoData({ code: 401, status: false, msg: "Unauthorized" })).toThrow(/Unauthorized/);
    const mapped = map22DoMessage({
      messageId: "1589",
      time: 1745411165,
      subject: "Confirme",
      from: "noreply@facebookmail.com",
      body: "Clique https://www.facebook.com/confirmemail.php?c=abc",
    });
    expect(mapped.id).toBe("1589");
    expect(mapped.link).toBe("https://www.facebook.com/confirmemail.php?c=abc");
    expect(mapped.from).toContain("facebookmail");
  });

  it("extrai código da validação", () => {
    expect(extractValidationCode("Seu código é 482913 e expira em 10 minutos.")).toBe("482913");
  });

  it("acha a caixa da empresa e o link da Meta no HTML", () => {
    const inbox = {
      id: "a1",
      address: "bm1@22.do",
      token: "",
      password: "",
      createdAt: "2026-10-26T23:00:00.000Z",
      active: false,
      empresaId: "e1",
      razaoSocial: "Tek Energy Ltda",
      adspowerProfile: "4",
      messages: [
        {
          id: "m1",
          from: "facebook@facebookmail.com",
          subject: "Confirme",
          intro: "https://tracker.example/click",
          link: "https://www.facebook.com/confirmemail.php?c=abc",
        },
      ],
    };
    expect(findCompanyInbox([inbox], { id: "e1" })?.address).toBe("bm1@22.do");
    expect(findCompanyInbox([inbox], { email_comercial: "bm1@22.do" })?.address).toBe("bm1@22.do");
    expect(confirmationLinkFromInbox(inbox)).toBe("https://www.facebook.com/confirmemail.php?c=abc");
    expect(
      extractConfirmationLink(
        'Clique <a href="https://l.facebook.com/l.php?u=https%3A%2F%2Fwww.facebook.com%2Fconfirmemail.php%3Fc%3Dabc">aqui</a> ou https://tracker.example/x',
      ),
    ).toBe("https://www.facebook.com/confirmemail.php?c=abc");
    expect(
      extractConfirmationLink(
        [
          "https://business.facebook.com/",
          "https://facebook.com/images/email/meta_icon.png",
          "https://business.facebook.com/?business_id=1013153098495280",
          "https://business.facebook.com/verify/email/checkpoint/?token=abc",
          "https://www.facebook.com/email_open_log_pic.php?mid=1",
        ].join(" "),
      ),
    ).toBe("https://business.facebook.com/verify/email/checkpoint/?token=abc");
    expect(extractConfirmationLink("ícone https://facebook.com/images/email/meta_icon.png")).toBeUndefined();
    expect(
      confirmationLinkFromInbox({
        messages: [{ id: "m2", from: "facebook", subject: "x", intro: "", link: "https://facebook.com/images/email/meta_icon.png" }],
      }),
    ).toBeUndefined();
    expect(emailConfirmSucceeded({ url: "https://www.facebook.com/confirmemail.php", texts: ["E-mail confirmado"] })).toBe(true);
  });

  it("pula a etapa 3 se Informações da empresa não tem Confirmação pendente", () => {
    const settings = "https://business.facebook.com/latest/settings/business_info?business_id=1013153098495280";
    const confirmed = [
      "Informações da empresa",
      "Informações de contato do perfil",
      "Email",
      "domi.nic.k.to.nga.tegkg.55+g6rei@gmail.com",
      "Editar",
    ];
    const pending = [...confirmed, "Confirmação pendente"];
    expect(emailConfirmPendingOnSettings(pending)).toBe(true);
    expect(emailConfirmPendingOnSettings(confirmed)).toBe(false);
    expect(emailConfirmEtapaConcluida({ url: settings, texts: confirmed })).toBe(true);
    expect(emailConfirmEtapaConcluida({ url: settings, texts: pending })).toBe(false);
    expect(
      emailConfirmEtapaConcluida({
        url: "https://business.facebook.com/verify/email/checkpoint/?token=abc",
        texts: confirmed,
      }),
    ).toBe(false);
  });

  it("sorteia Gmail, Outlook ou Hotmail e roteia inbox pelo domínio", () => {
    expect(pickRealMailKind(() => 0)).toBe("gmail");
    expect(pickRealMailKind(() => 0.4)).toBe("outlook");
    expect(pickRealMailKind(() => 0.8)).toBe("hotmail");
    expect(mailKindFromAddress("a+x@gmail.com")).toBe("gmail");
    expect(mailKindFromAddress("b@googlemail.com")).toBe("gmail");
    expect(mailKindFromAddress("c@outlook.com")).toBe("outlook");
    expect(mailKindFromAddress("d@hotmail.com")).toBe("hotmail");
    expect(mailKindFromAddress("rwanhagfmbm9c9c@twbeta.com")).toBe("premium");
    expect(inboxApiForKind("gmail")).toEqual({ list: "/gmail/inbox", message: "/gmail/message" });
    expect(inboxApiForKind("outlook")).toEqual({ list: "/microsoft/inbox", message: "/microsoft/message" });
    expect(inboxApiForKind("hotmail")).toEqual({ list: "/microsoft/inbox", message: "/microsoft/message" });
    expect(inboxApiForKind("premium")).toEqual({ list: "/inbox", message: "/inbox/message" });
    expect(parseMailIdList({ items: ["aa.bb.cc", "aa.b.bcc"], count: 2 })).toEqual(["aa.bb.cc", "aa.b.bcc"]);
    expect(filterMicrosoftByKind(["x@outlook.com", "y@hotmail.com", "z@live.com"], "outlook")).toEqual([
      "x@outlook.com",
      "z@live.com",
    ]);
    expect(filterMicrosoftByKind(["x@outlook.com", "y@hotmail.com"], "hotmail")).toEqual(["y@hotmail.com"]);
    expect(firstGeneratedAddress({ items: ["aa.bb.cc+2gwhp1f03@gmail.com"] })).toBe("aa.bb.cc+2gwhp1f03@gmail.com");
    expect(firstGeneratedAddress({ items: ["aa.bb.cc+2gwhp1f03"], domains: ["@gmail.com", "@googlemail.com"] })).toBe(
      "aa.bb.cc+2gwhp1f03@gmail.com",
    );
    expect(firstGeneratedAddress({ items: ["aa.bb.cc"] }, "gmail.com")).toBe("aa.bb.cc@gmail.com");
    expect(firstGeneratedAddress({ items: ["user@outlook.com"] })).toBe("user@outlook.com");
    expect(shouldPurchaseMailStock(0)).toBe(true);
    expect(shouldPurchaseMailStock(2)).toBe(false);
    expect(mailKindsToTry("hotmail")).toEqual(["hotmail", "gmail", "outlook"]);
    expect(isMailOutOfStock("Out of stock")).toBe(true);
    expect(isMailOutOfStock("Insufficient balance")).toBe(false);
  });

  it("SMS só fica pronto com URL e chave", () => {
    expect(smsReady({ baseUrl: "", apiKey: "x", countryCode: "BR", serviceCode: "fb", serviceId: "60033", apiId: "", ddd: "35", lastActivationId: "", lastPhone: "", knownActivations: [], activationChanges: [] })).toBe(false);
    expect(
      smsReady({
        baseUrl: "https://app.numero-virtual.com/api/v1",
        apiKey: "x",
        countryCode: "BR",
        serviceCode: "fb",
        serviceId: "60033",
        apiId: "",
        ddd: "35",
        lastActivationId: "",
        lastPhone: "",
        knownActivations: [],
        activationChanges: [],
      }),
    ).toBe(true);
  });
});
