# Recuperación de contraseña

En la pantalla de acceso, «¿Olvidaste tu contraseña?» solicita el correo. La respuesta es la misma exista o no la cuenta. Solo las cuentas activas que ya tienen contraseña reciben el enlace; las cuentas exclusivamente de Google siguen entrando con Google.

- `POST /auth/forgot-password`: `{ "email": "usuario@example.com" }`.
- `POST /auth/reset-password`: `{ "token": "token hexadecimal de 64 caracteres", "password": "nueva contraseña" }`.

El token aleatorio tiene 256 bits, se guarda como hash SHA-256 y caduca en 30 minutos. Cada nueva solicitud elegible sustituye el token anterior. Se permite como máximo una solicitud por cuenta cada minuto mediante una condición atómica en MongoDB. No es un límite global por IP; un despliegue público debe configurar también límites de tráfico en el proxy.

El restablecimiento consume el token y actualiza la contraseña en una sola operación; no puede reutilizarse, tampoco en peticiones simultáneas. La contraseña debe tener entre 8 y 72 caracteres y no superar los 72 bytes de bcrypt. Incrementa la versión de sesión para invalidar todos los JWT anteriores. No activa cuentas pendientes ni inicia sesión automáticamente.

## Configuración y prueba local

Configura `MAIL_ENABLED=true`, el SMTP existente y **`FRONTEND_URL=http://localhost:5173`** en `backend/.env`. En producción debe ser la dirección HTTPS pública del frontend. Reinicia el backend. Si falta la URL o el correo está desactivado, no se generan enlaces.

1. Solicita la recuperación de una cuenta activa con contraseña y correo real.
2. Abre el enlace del correo, introduce la contraseña y confírmala.
3. Comprueba que puedes entrar con la nueva contraseña y que la anterior falla.
4. Reutiliza el enlace: debe rechazarse. Los JWT previos también deben rechazarse.
5. Un correo inexistente devuelve el mismo mensaje y no recibe correo.

Los correos de evento y recuperación usan HTML con tablas, estilos en línea, colores negro y dorado y el emblema adjunto mediante CID. Conservan una alternativa en texto plano. El contenido dinámico se escapa para evitar inyectar HTML. Algunos clientes pueden ocultar las imágenes; el contenido y el botón siguen disponibles.

Los fallos de entrega se registran, no hay reintentos automáticos. Tras un fallo se puede pedir otro enlace pasado un minuto. No se imprimen tokens ni direcciones en el log de recuperación.
