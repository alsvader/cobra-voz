# modules/

Monolito modular (Architecture Specification §3). Un directorio por dominio:

| Módulo        | Responsabilidad                                         |
| ------------- | ------------------------------------------------------- |
| `identity`    | Validar sesión y alcance por `merchant_id`              |
| `merchant`    | Nombre y datos mínimos de la cuenta receptora           |
| `voice`       | Validación de audio, transcripción y parser de importes |
| `charges`     | Intención de cobro, idempotencia y generación de QR     |
| `payments`    | Webhooks, conciliación y pagos                          |
| `sales`       | Historial y agregados de pagos conciliados              |
| `preferences` | Preferencias de audio del comerciante                   |

Reglas:

- La lógica de negocio vive en servicios de dominio, **no** en componentes React.
- Un módulo solo depende de los permitidos en la arquitectura y de los adaptadores en `adapters/`.
- Dinero siempre en centavos enteros; el `merchant_id` se deriva de la sesión, nunca del cliente.
