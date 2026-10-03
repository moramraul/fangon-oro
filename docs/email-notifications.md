# Correo de inclusión en eventos

Se envía un correo individual a cada participante al crear un evento con participantes y a los nuevos participantes al actualizar su lista. No se reenvía al guardar una lista idéntica, quitar participantes o editar los demás datos. Si se elimina a alguien y después se vuelve a incluir, recibe un nuevo aviso.

El correo contiene el nombre del evento, fechas de inicio y fin en horario Europe/Madrid y, si se configura, un enlace a la aplicación. No comparte direcciones de otros participantes. Las direcciones se obtienen de los usuarios registrados; no se aceptan destinatarios desde la petición.

## Configuración

Añadir las variables de `backend/.env.mail.example` al `.env` existente (sin reemplazar la configuración de MongoDB y autenticación):

- `MAIL_ENABLED=true` activa los correos. Por defecto están desactivados.
- `MAIL_FROM`: remitente autorizado por tu proveedor.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`: conexión SMTP. Puerto 587 con `false` permite STARTTLS; puerto 465 con `true` utiliza TLS desde el inicio.
- `SMTP_USER`, `SMTP_PASSWORD`: credenciales. Deben estar ambos definidos o ambos vacíos para un relay sin autenticación.
- `FRONTEND_URL`: enlace opcional a la aplicación.

Reiniciar el backend después de configurar las variables. La configuración habilitada incompleta o inválida impide el arranque. La creación del transporte no conecta ni envía correos por sí sola.

La implementación utiliza [Nodemailer SMTP](https://nodemailer.com/smtp).

## Entrega y errores

La inclusión se guarda antes de intentar el envío. El correo no forma parte de la transacción de MongoDB: un fallo de SMTP o de consulta de destinatarios se registra y no revierte la inclusión ni convierte la petición en un error. Los errores del proveedor y las credenciales no se imprimen en los logs.

El envío se espera antes de responder, con hasta cinco envíos simultáneos y tiempos de espera de conexión. Los cambios concurrentes en participantes se comprueban al guardar: una petición con una lista desactualizada recibe 409 y no genera avisos.

Esta versión no tiene cola persistente ni reintentos automáticos. Si el proceso se interrumpe después de guardar o SMTP falla, el aviso puede perderse. Activar el correo no envía avisos retroactivos a eventos existentes. La aceptación por SMTP tampoco garantiza la llegada a la bandeja de entrada.

## Verificación

Las pruebas usan un transporte simulado y no envían correos reales. Para probar la entrega, configura un buzón o servidor SMTP de pruebas, activa los correos y crea un evento con un usuario de prueba. Comprueba el aviso, añade un segundo participante y verifica que solo él recibe el nuevo correo. Volver a guardar la misma lista no debe generar otro aviso.
