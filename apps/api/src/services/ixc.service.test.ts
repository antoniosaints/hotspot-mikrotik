import http from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { getIxcInvoicePix, listCurrentMonthOpenInvoices, validateIxcLogin } from "./ixc.service.js";

let server: http.Server | null = null;

function listen(handler: http.RequestListener): Promise<string> {
  server = http.createServer(handler);

  return new Promise((resolve) => {
    server?.listen(0, "127.0.0.1", () => {
      const address = server?.address();
      if (address && typeof address === "object") {
        resolve(`http://127.0.0.1:${address.port}`);
      }
    });
  });
}

function readBody(request: http.IncomingMessage): Promise<Record<string, string>> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, string>));
  });
}

describe("validateIxcLogin", () => {
  afterEach(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    server = null;
  });

  it("allows login when IXC finds an active internet contract", async () => {
    const seen: Array<{ url: string | undefined; auth: string | undefined; ixcsoft: string | undefined; body: Record<string, string> }> = [];
    const baseUrl = await listen(async (request, response) => {
      const body = await readBody(request);
      seen.push({
        url: request.url,
        auth: request.headers.authorization,
        ixcsoft: String(request.headers.ixcsoft),
        body,
      });

      response.setHeader("content-type", "application/json");
      if (request.url === "/cliente") {
        response.end(JSON.stringify({ page: "1", total: "1", registros: [{ id: "42" }] }));
        return;
      }

      response.end(JSON.stringify({ page: "1", total: "1", registros: [{ id: "99", status: "A", status_internet: "A" }] }));
    });

    await expect(validateIxcLogin({ baseUrl, usuario: "user", senha: "pass" }, "62065876301")).resolves.toEqual({
      allowed: true,
      clienteId: "42",
      contratoId: "99",
    });

    expect(seen[0]).toMatchObject({
      url: "/cliente",
      auth: `Basic ${Buffer.from("user:pass").toString("base64")}`,
      ixcsoft: "listar",
      body: { qtype: "cliente.cnpj_cpf", query: "620.658.763-01", oper: "=" },
    });
    expect(seen[1]?.body).toMatchObject({ qtype: "cliente_contrato.id_cliente", query: "42", oper: "=" });
  });

  it("blocks login when no active contract is returned", async () => {
    const baseUrl = await listen(async (request, response) => {
      await readBody(request);
      response.setHeader("content-type", "application/json");
      if (request.url === "/cliente") {
        response.end(JSON.stringify({ registros: [{ id: "42" }] }));
        return;
      }

      response.end(JSON.stringify({ registros: [{ id: "99", status: "A", status_internet: "AA" }] }));
    });

    await expect(validateIxcLogin({ baseUrl, usuario: "user", senha: "pass" }, "620.658.763-01")).resolves.toEqual({
      allowed: false,
      code: "CLIENTE_COM_DEBITOS",
      clienteId: "42",
      reason: "Login nao permitido: cliente contem debitos.",
    });
  });

  it("returns a structured not found result when the document is not in IXC", async () => {
    const baseUrl = await listen(async (_request, response) => {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ registros: [] }));
    });

    await expect(validateIxcLogin({ baseUrl, usuario: "user", senha: "pass" }, "620.658.763-01")).resolves.toEqual({
      allowed: false,
      code: "CLIENTE_NAO_ENCONTRADO",
      reason: "CPF nao encontrado na base.",
    });
  });

  it("lists current month open invoices for a client", async () => {
    const seen: Record<string, string>[] = [];
    const baseUrl = await listen(async (request, response) => {
      seen.push(await readBody(request));
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ registros: [{ id: "55", valor: "89.90" }] }));
    });

    await expect(
      listCurrentMonthOpenInvoices(
        { baseUrl, usuario: "user", senha: "pass" },
        "42",
        new Date("2026-07-03T12:00:00"),
      ),
    ).resolves.toEqual([{ id: "55", valor: "89.90" }]);

    expect(seen[0]).toMatchObject({
      qtype: "fn_areceber.id_cliente",
      query: "42",
      oper: "=",
      sortname: "fn_areceber.data_vencimento",
      sortorder: "asc",
    });
    expect(seen[0]?.grid_param).toContain("01/07/2026");
    expect(seen[0]?.grid_param).toContain("31/07/2026");
  });

  it("gets PIX data for an IXC invoice", async () => {
    const seen: Record<string, string>[] = [];
    const baseUrl = await listen(async (request, response) => {
      seen.push(await readBody(request));
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          pix: {
            dadosPix: { pixCopiaECola: "PIX-COPIA" },
            qrCode: { qrCode: "PIX-COPIA", imagemQrcode: "BASE64", imageSrc: "https://qr.example" },
          },
        }),
      );
    });

    await expect(getIxcInvoicePix({ baseUrl, usuario: "user", senha: "pass" }, "55")).resolves.toEqual({
      pixCopiaECola: "PIX-COPIA",
      qrCode: "PIX-COPIA",
      imagemQrcode: "BASE64",
      imageSrc: "https://qr.example",
    });
    expect(seen[0]).toEqual({ id_areceber: "55" });
  });
});
