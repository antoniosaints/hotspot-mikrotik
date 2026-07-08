import { describe, expect, it } from "vitest";

import { campanhaEstaAtiva } from "./campaigns.routes.js";

function base() {
  return {
    ativo: true,
    dataInicio: null as Date | null,
    dataFim: null as Date | null,
    diasSemana: "0,1,2,3,4,5,6",
    horaInicio: null as string | null,
    horaFim: null as string | null,
  };
}

describe("campanhaEstaAtiva", () => {
  const agora = new Date(2026, 6, 8, 12, 0, 0); // 8 jul 2026, 12:00
  const diaAgora = String(agora.getDay());

  it("retorna false quando inativa", () => {
    expect(campanhaEstaAtiva({ ...base(), ativo: false }, agora)).toBe(false);
  });

  it("retorna true sem restricoes de data/hora e todos os dias", () => {
    expect(campanhaEstaAtiva(base(), agora)).toBe(true);
  });

  it("respeita a janela de datas", () => {
    expect(campanhaEstaAtiva({ ...base(), dataInicio: new Date(2026, 6, 9) }, agora)).toBe(false);
    expect(campanhaEstaAtiva({ ...base(), dataFim: new Date(2026, 6, 7) }, agora)).toBe(false);
    expect(
      campanhaEstaAtiva({ ...base(), dataInicio: new Date(2026, 6, 1), dataFim: new Date(2026, 6, 31) }, agora),
    ).toBe(true);
  });

  it("respeita os dias da semana", () => {
    const outrosDias = ["0", "1", "2", "3", "4", "5", "6"].filter((dia) => dia !== diaAgora).join(",");
    expect(campanhaEstaAtiva({ ...base(), diasSemana: outrosDias }, agora)).toBe(false);
    expect(campanhaEstaAtiva({ ...base(), diasSemana: diaAgora }, agora)).toBe(true);
  });

  it("respeita a janela de horario diaria", () => {
    expect(campanhaEstaAtiva({ ...base(), horaInicio: "08:00", horaFim: "18:00" }, agora)).toBe(true);
    expect(campanhaEstaAtiva({ ...base(), horaInicio: "13:00", horaFim: "18:00" }, agora)).toBe(false);
    expect(campanhaEstaAtiva({ ...base(), horaInicio: "08:00", horaFim: "11:00" }, agora)).toBe(false);
  });

  it("suporta janela que cruza a meia-noite", () => {
    const noite = new Date(2026, 6, 8, 23, 0, 0);
    const madrugada = new Date(2026, 6, 8, 5, 0, 0);
    const tarde = new Date(2026, 6, 8, 12, 0, 0);
    expect(campanhaEstaAtiva({ ...base(), horaInicio: "22:00", horaFim: "06:00" }, noite)).toBe(true);
    expect(campanhaEstaAtiva({ ...base(), horaInicio: "22:00", horaFim: "06:00" }, madrugada)).toBe(true);
    expect(campanhaEstaAtiva({ ...base(), horaInicio: "22:00", horaFim: "06:00" }, tarde)).toBe(false);
  });
});
