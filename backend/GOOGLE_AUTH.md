# Acceso con Google

## Contraseña opcional

Tras entrar con Google, las cuentas sin contraseña ven un aviso en la vista general. Ambas respuestas guardan `passwordPromptSeen: true` en MongoDB; «Sí» lleva a `/profile/edit` y «No» conserva la vista general. Las cuentas antiguas sin el campo se consideran pendientes de respuesta. El aviso no se muestra a cuentas que ya tienen contraseña.

La edición del perfil permite crear una contraseña incluso después de rechazar el aviso. `POST /auth/me/password` recibe `{ "password": "..." }`, requiere JWT de una cuenta activa de Google y solo permite establecer la primera contraseña. Exige entre 8 y 72 caracteres y un máximo de 72 bytes UTF-8, la cifra con bcrypt y conserva Google, rol y activación. No sirve para cambiar una contraseña existente.

`POST /auth/me/password-prompt` guarda la respuesta. `/auth/me` devuelve `hasPassword`, `hasGoogle` y `passwordPromptSeen`, sin revelar el hash ni el identificador de Google. No hace falta migrar las cuentas existentes.

1. Crea un cliente OAuth de tipo «Aplicación web» en Google Cloud y configura la pantalla de consentimiento.
2. Añade el origen del frontend a los orígenes JavaScript autorizados (por ejemplo `http://localhost:5173` y el dominio de producción). Este flujo usa un popup y no requiere callback de redirección.
3. Configura `GOOGLE_CLIENT_ID` en `backend/.env` y el mismo valor como `VITE_GOOGLE_CLIENT_ID` en `frontend/.env`. Reinicia ambos procesos; vuelve a compilar el frontend en producción.

El botón oficial aparece en login y registro cuando existe `VITE_GOOGLE_CLIENT_ID`. Envía `{ "credential": "<Google ID token>" }` a `POST /auth/google`. El servidor verifica firma, audiencia, emisor y expiración mediante `google-auth-library`, y exige email verificado.

Las cuentas nuevas tienen rol USER y quedan pendientes de activación por un administrador, igual que el registro con contraseña. Las cuentas activas reciben el JWT habitual. Las desactivadas obtienen HTTP 403, también si ya existían.

El identificador estable de Google (`sub`) identifica la cuenta. Solo se vincula automáticamente una cuenta existente por email cuando Google es autoridad sobre ese correo (Gmail o Google Workspace). Para otros proveedores de correo, una cuenta existente debe usar su contraseña; no se vincula automáticamente. Se conservan contraseña, rol y activación existentes.

No se requiere un client secret. Nunca envíes el JWT de la aplicación ni el token de Google en URLs o logs.

Referencia: https://developers.google.com/identity/gsi/web/guides/verify-google-id-token
