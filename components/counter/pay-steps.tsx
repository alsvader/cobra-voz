const STEPS = [
  "Entra a CoDi en la aplicación de tu banco",
  "Apunta la cámara a este código",
  "Captura el importe y autoriza el pago",
] as const;

/** Pasos que ve el cliente, en la pantalla y en la hoja impresa. */
export function CounterPaySteps() {
  return (
    <ol className="flex w-full list-decimal flex-col gap-2 pl-5 text-base text-foreground">
      {STEPS.map((step) => (
        <li key={step} className="pl-1">
          {step}
        </li>
      ))}
    </ol>
  );
}
