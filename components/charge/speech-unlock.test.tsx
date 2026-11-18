import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetPaymentSpeechForTests } from "@/adapters/speech/announce";
import { SpeechUnlock } from "@/components/charge/speech-unlock";

describe("SpeechUnlock", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("abre el audio con el primer toque de la página", () => {
    resetPaymentSpeechForTests();
    const speak = vi.fn();
    vi.stubGlobal("speechSynthesis", { speak });
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        volume = 1;
        constructor(public text: string) {}
      },
    );
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0",
      platform: "MacIntel",
      maxTouchPoints: 0,
      userActivation: { isActive: true, hasBeenActive: true },
    });

    render(<SpeechUnlock />);
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak.mock.calls[0]?.[0]).toMatchObject({ text: " ", volume: 0 });
  });
});
