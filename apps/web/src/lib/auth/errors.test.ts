import { describe, expect, it } from "vitest";
import { authErrorMessage, createAccountMessage } from "./errors";
import { safeNext } from "../supabase/env";

describe("mensagens de autenticação", () => {
  it("credenciais inválidas", () => {
    expect(authErrorMessage({ code: "invalid_credentials" })).toMatch(/não conferem/);
  });
  it("cadastro bloqueado pelo gatilho do banco", () => {
    expect(authErrorMessage({ message: "Database error saving new user", status: 500 })).toMatch(/não está liberado/);
  });
  it("resultados de create_account", () => {
    expect(createAccountMessage("not_allowed")).toMatch(/não está liberado/);
    expect(createAccountMessage("exists")).toMatch(/Use Entrar/);
    expect(createAccountMessage("rate_limited")).toMatch(/Aguarde/);
    expect(createAccountMessage("???")).toMatch(/continuam no formulário/);
  });
  it("erro desconhecido preserva o formulário", () => {
    expect(authErrorMessage({ message: "boom" })).toMatch(/continuam no formulário/);
  });
});

describe("destino após login", () => {
  it("aceita só caminhos internos", () => {
    expect(safeNext("/redacao")).toBe("/redacao");
    expect(safeNext("//evil.example")).toBe("/hoje");
    expect(safeNext("https://evil.example")).toBe("/hoje");
    expect(safeNext("/\\evil")).toBe("/hoje");
    expect(safeNext("/entrar")).toBe("/hoje");
    expect(safeNext(null)).toBe("/hoje");
  });
});
