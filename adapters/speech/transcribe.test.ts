import { describe, expect, it, vi } from "vitest";
import {
  TRANSCRIBE_MODEL,
  createOpenAiTranscriber,
} from "./transcribe";

const audio = { bytes: Uint8Array.from([1, 2, 3, 4]), mimeType: "audio/webm" };

describe("createOpenAiTranscriber", () => {
  it("pide gpt-transcribe en español y devuelve el texto", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const form = init?.body as FormData;
      expect(form.get("model")).toBe(TRANSCRIBE_MODEL);
      expect(form.get("languages[]")).toBe("es");
      expect(form.get("language")).toBeNull();
      const header = new Headers(init?.headers);
      expect(header.get("Authorization")).toBe("Bearer secret");
      return Response.json({ text: " ciento cincuenta " });
    });

    const result = await createOpenAiTranscriber({
      apiKey: "secret",
      fetch: fetchImpl as unknown as typeof fetch,
    }).transcribe(audio);

    expect(result).toEqual({ ok: true, text: "ciento cincuenta" });
    const logged = info.mock.calls.map((call) => String(call[0])).join("\n");
    expect(logged).toContain('"model":"gpt-transcribe"');
    expect(logged).toContain('"bytes":4');
    expect(logged).toContain('"event":"voice_transcribe_response"');
    expect(logged).toContain("ciento cincuenta");
    expect(logged).not.toContain("secret");
    expect(logged).not.toContain("Bearer");
  });

  it("un fallo de la API no inventa un texto", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const fetchImpl = vi.fn(async () => new Response("no", { status: 500 }));
    const result = await createOpenAiTranscriber({
      apiKey: "secret",
      fetch: fetchImpl as unknown as typeof fetch,
    }).transcribe(audio);
    expect(result).toEqual({ ok: false, reason: "failed" });
    const logged = info.mock.calls.map((call) => String(call[0])).join("\n");
    expect(logged).toContain('"status":500');
    expect(logged).toContain("no");
    expect(logged).not.toContain("secret");
  });
});
