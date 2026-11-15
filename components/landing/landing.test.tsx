import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { LandingPage } from "@/components/landing/landing-page";
import { faq, hero, howItWorks } from "@/components/landing/content";

describe("Landing del MVP", () => {
  it("muestra un solo H1 con el copy del hero y los tres pasos", () => {
    render(<LandingPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: hero.title }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);

    for (const step of howItWorks.steps) {
      expect(
        screen.getByRole("heading", { level: 3, name: step.title }),
      ).toBeInTheDocument();
    }
  });

  it("abre la primera pregunta y permite dejar todas cerradas", async () => {
    const user = userEvent.setup();
    render(<LandingPage />);

    const first = screen.getByRole("button", { name: faq.items[0].question });
    const second = screen.getByRole("button", { name: faq.items[1].question });
    expect(first).toHaveAttribute("aria-expanded", "true");
    expect(second).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText(faq.items[0].answer)).toBeVisible();

    await user.click(second);
    expect(first).toHaveAttribute("aria-expanded", "false");
    expect(second).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(faq.items[1].answer)).toBeVisible();

    await user.click(second);
    expect(second).toHaveAttribute("aria-expanded", "false");
  });

  it("no publica contacto ni privacidad sin un destino real", () => {
    render(<LandingPage />);

    const contact = screen.getByRole("button", { name: "Contactar al equipo" });
    expect(contact).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.queryByRole("link", { name: "Contactar al equipo" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("El canal de contacto todavía no está publicado."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Privacidad" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Privacidad")).toBeInTheDocument();
    expect(
      screen.queryByText(/Registrarse|Comenzar gratis/),
    ).not.toBeInTheDocument();
  });

  it("lleva a la aplicación desde el hero, el menú y el pie", async () => {
    const user = userEvent.setup();
    render(<LandingPage />);

    expect(
      screen.getByRole("link", { name: "Conoce el piloto" }),
    ).toHaveAttribute("href", "/acceso");

    const visibleLogin = screen.getAllByRole("link", {
      name: "Iniciar sesión",
    });
    expect(visibleLogin).toHaveLength(2);
    for (const link of visibleLogin) {
      expect(link).toHaveAttribute("href", "/acceso");
    }

    await user.click(screen.getByRole("button", { name: "Abrir menú" }));
    const withMenu = screen.getAllByRole("link", { name: "Iniciar sesión" });
    expect(withMenu).toHaveLength(3);
    for (const link of withMenu) {
      expect(link).toHaveAttribute("href", "/acceso");
    }

    expect(
      screen.getAllByRole("link", { name: "Cómo funciona" }).length,
    ).toBeGreaterThan(0);
    expect(document.querySelectorAll("img")).toHaveLength(0);
  });
});
