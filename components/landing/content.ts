/**
 * Copy canónico de CobraVoz Landing Handoff v1.0 (Anexo B).
 * PEND-01 y PEND-02 siguen sin URL: no se inventa correo, WhatsApp ni aviso legal.
 * La landing no muestra un botón de registro. El alta está en `/registro`.
 */

import { ROUTES } from "@/lib/routes";

export const contactHref: string | null = null;
export const privacyHref: string | null = null;

/** Entrada a la aplicación para quien ya tiene cuenta del piloto. */
export const loginLink = {
  href: ROUTES.login,
  label: "Iniciar sesión",
} as const;

export const contactPendingNote =
  "El canal de contacto todavía no está publicado.";

export const privacyPendingNote =
  "El aviso de privacidad todavía no está publicado.";

export const headerLinks = [
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#beneficios", label: "Beneficios" },
  { href: "#contacto", label: "Contacto" },
] as const;

export const footerExplore = [
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#beneficios", label: "Beneficios" },
  { href: "#para-quien-es", label: "Para quién es" },
] as const;

export const footerHelp = [
  { href: "#preguntas-frecuentes", label: "Preguntas frecuentes" },
  { href: "#contacto", label: "Contacto" },
  loginLink,
] as const;

export const hero = {
  eyebrow: "Cobros por voz + CoDi",
  title: "Cobra con tu voz. Sigue atendiendo tu negocio.",
  description:
    "Di el importe, confirma la cantidad y muestra un QR CoDi para recibir el pago. CobraVoz te avisa cuando el pago está verificado.",
  primaryCta: "Conoce el piloto",
  primaryHref: loginLink.href,
  secondaryCta: "Cómo funciona",
  secondaryHref: "#como-funciona",
} as const;

export const howItWorks = {
  eyebrow: "CÓMO FUNCIONA",
  title: "Tres pasos para cobrar con CobraVoz.",
  description: "Desde dictar el importe hasta verificar el pago.",
  steps: [
    {
      number: "01",
      title: "Di cuánto quieres cobrar",
      description:
        "Presiona el micrófono y di la cantidad. También puedes ingresar el importe manualmente.",
    },
    {
      number: "02",
      title: "Confirma y genera tu QR",
      description:
        "Revisa que la cantidad sea correcta y confírmala. CobraVoz genera un QR CoDi para que tu cliente pueda pagar.",
    },
    {
      number: "03",
      title: "Verifica el pago",
      description:
        "Tu cliente paga con CoDi. CobraVoz muestra la confirmación cuando el pago se ha verificado.",
    },
  ],
} as const;

export const benefits = {
  eyebrow: "BENEFICIOS",
  title: "Menos pasos para cobrar. Más claridad en cada venta.",
  description: "Una herramienta sencilla para el ritmo de tu negocio.",
  primary: {
    title: "Menos pasos para cobrar",
    description:
      "Dicta el importe, revísalo y confirma. También puedes escribir la cantidad cuando lo necesites.",
  },
  payments: {
    title: "Pagos claros y verificables",
    description:
      "Distingue fácilmente cuándo un pago sigue pendiente y cuándo ha sido verificado.",
  },
  sales: {
    title: "Tus ventas a la vista",
    description:
      "Consulta cuánto has cobrado hoy y revisa tus movimientos recientes desde tu celular.",
    totalLabel: "Total cobrado hoy",
    total: "$850.00",
    count: "7 pagos confirmados",
    sample: "Ejemplo ilustrativo",
  },
} as const;

export const trust = {
  eyebrow: "PAGOS CON CLARIDAD",
  title: "El pago se confirma, no se supone.",
  description:
    "CobraVoz te muestra cuándo un pago sigue pendiente y cuándo ha sido verificado. Sin depender de capturas de pantalla ni de confirmaciones verbales.",
  noticeTitle: "Confirmación bancaria verificable",
  notice:
    "CobraVoz utiliza la integración Pey/CoDi para consultar y verificar el estado del cobro.",
  pending: {
    label: "Esperando pago",
    amount: "$85.00",
    detail: "Aún no se ha confirmado el pago.",
  },
  received: {
    label: "Pago recibido",
    amount: "$85.00",
    detail: "Pago verificado correctamente.",
    reference: "Referencia ilustrativa: CV-0085",
  },
} as const;

export const useCases = {
  eyebrow: "PENSADO PARA TU NEGOCIO",
  title: "Hecho para quienes atienden y cobran al mismo tiempo.",
  description:
    "Desde un puesto de comida hasta un local de mercado, CobraVoz está pensado para comerciantes que necesitan cobrar de forma sencilla desde su celular.",
  capsule: "Desde tu celular",
  cases: [
    {
      title: "Puestos de comida",
      description:
        "Entre preparar pedidos, entregar productos y atender clientes, cada paso cuenta. Dicta el importe, revísalo y genera tu cobro desde el celular.",
      icon: "utensils",
    },
    {
      title: "Mercados y tianguis",
      description:
        "Cuando atiendes a varios clientes durante el día, necesitas saber qué cobros ya fueron confirmados. CobraVoz te permite consultar el estado de cada operación.",
      icon: "store",
    },
    {
      title: "Pequeños comercios",
      description:
        "Para negocios que necesitan cobrar y continuar atendiendo. Revisa el total cobrado hoy y consulta tus movimientos recientes desde un mismo lugar.",
      icon: "bag",
    },
  ],
} as const;

export const faq = {
  eyebrow: "PREGUNTAS FRECUENTES",
  title: "¿Tienes dudas? Aquí te ayudamos.",
  description: "Todo lo que necesitas saber sobre cómo funciona CobraVoz.",
  items: [
    {
      id: "faq-01",
      question: "¿Necesito descargar una aplicación?",
      answer:
        "CobraVoz es una aplicación web instalable (PWA). Puedes utilizarla desde un navegador compatible y agregarla a tu dispositivo cuando esté disponible esa opción.",
    },
    {
      id: "faq-02",
      question: "¿Qué pasa si no funciona el micrófono?",
      answer:
        "Puedes ingresar el importe manualmente. Siempre tendrás la oportunidad de revisar y confirmar la cantidad antes de generar el QR.",
    },
    {
      id: "faq-03",
      question: "¿Cómo sé si realmente recibí el pago?",
      answer:
        "CobraVoz muestra «Pago recibido» únicamente cuando la operación ha sido verificada. Si todavía no existe confirmación, el cobro permanece pendiente.",
    },
    {
      id: "faq-04",
      question: "¿Qué sucede si el pago sigue pendiente?",
      answer:
        "Puedes consultar nuevamente su estado. La app no marcará el cobro como pagado sin una confirmación bancaria verificable.",
    },
    {
      id: "faq-05",
      question: "¿Funciona sin conexión a internet?",
      answer:
        "Necesitas conexión para generar nuevos códigos QR. Si se interrumpe tu sesión, CobraVoz puede recuperar el estado de los cobros registrados cuando vuelvas a conectarte.",
    },
    {
      id: "faq-06",
      question: "¿Puedo registrar mi negocio?",
      answer:
        "Sí. En Crear comercio dejas el nombre, el correo y una contraseña, y entras de inmediato. No enviamos un correo de verificación.",
    },
  ],
} as const;

export const finalCta = {
  eyebrow: "CONOCE COBRAVOZ",
  title: "Haz que cobrar sea más sencillo.",
  description:
    "Descubre una forma de cobrar con tu voz y seguir atendiendo lo que más importa: tu negocio.",
  cta: "Contactar al equipo",
} as const;

export const footer = {
  wordmark: "CobraVoz",
  slogan: "Cobra fácilmente, sin dejar de atender tu negocio.",
  explore: "Explora",
  help: "Ayuda",
  copyright: "© 2026 CobraVoz",
  privacy: "Privacidad",
} as const;
