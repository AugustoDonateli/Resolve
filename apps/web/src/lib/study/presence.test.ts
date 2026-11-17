import { describe, expect, it } from "vitest";
import { presenceKind, shouldPing } from "./presence";

describe("tempo de estudo automático", () => {
  it("conta só nas páginas de estudo", () => {
    expect(presenceKind("/estudar/sessao/abc")).toBe("questoes");
    expect(presenceKind("/estudar/dia-d/abc")).toBe("simulado");
    expect(presenceKind("/revisar")).toBe("revisao");
    expect(presenceKind("/redacao/escrever/x")).toBe("redacao");
    expect(presenceKind("/diagnostico")).toBe("diagnostico");
    for (const p of ["/hoje", "/estudar", "/redacao", "/mais", "/grupos", "/progresso", "/rotina"]) expect(presenceKind(p)).toBeNull();
  });
  it("para de contar com a aba escondida ou 3 minutos sem mexer", () => {
    expect(shouldPing(1_000_000, 1_000_000 - 60_000, true)).toBe(true);
    expect(shouldPing(1_000_000, 1_000_000 - 181_000, true)).toBe(false);
    expect(shouldPing(1_000_000, 1_000_000, false)).toBe(false);
  });
});
