import { describe, expect, it } from "vitest";
import { buildTicketCredentials, hasProspectData, normalizeBuyerFields } from "./billing.service.js";

describe("billing service", () => {
  it("uses normalized CPF as the MikroTik login when CPF is collected", () => {
    expect(buildTicketCredentials({ cpf: "123.456.789-00" }, () => "IGNORED")).toEqual({
      username: "12345678900",
      password: "12345678900",
    });
  });

  it("uses a generated unique code when CPF is not collected", () => {
    expect(buildTicketCredentials({}, () => "TCK12345")).toEqual({
      username: "TCK12345",
      password: "TCK12345",
    });
  });

  it("normalizes configured buyer fields and detects prospect data", () => {
    const fields = normalizeBuyerFields({
      nome: " Maria ",
      telefone: "(11) 99999-0000",
      email: " MARIA@EXAMPLE.COM ",
      cpf: "123.456.789-00",
      endereco: " Rua A ",
    });

    expect(fields).toEqual({
      nome: "Maria",
      telefone: "(11) 99999-0000",
      email: "maria@example.com",
      cpf: "12345678900",
      endereco: "Rua A",
    });
    expect(hasProspectData(fields)).toBe(true);
    expect(hasProspectData({})).toBe(false);
  });
});
