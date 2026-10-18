# Despliegue gratuito para pruebas

Si es tu primer despliegue, sigue el [manual completo paso a paso](deployment-first-time.md), que incluye el alta de cuentas, cada campo del panel, la activación del primer administrador y la solución de errores. Este documento es la referencia resumida.

La propuesta es una web estática y una API gratuita en Render, más MongoDB Atlas Free con una base `fangon-oro`. Se usan las direcciones HTTPS de los proveedores; no hace falta comprar un dominio. Mantener una sola instancia de la API por los límites de intentos en memoria.

Objetivo: 0 € de alojamiento dentro de las cuotas gratuitas, reutilizando el cluster Atlas existente. Un dominio propio como `fangon-oro.es` o `fangon-oro.com` es opcional y requiere pagar registro y renovación; disponibilidad y precio pendientes de comprobar. Render Hobby incluye actualmente dos dominios personalizados y HTTPS gestionado. Consultar el apartado 15 del manual completo para DNS, `FRONTEND_URL` y Google, y las [condiciones de Render](https://render.com/docs/custom-domains).

`render.yaml` describe los servicios. También pueden crearse manualmente siguiendo los pasos siguientes. Esta preparación no crea cuentas ni publica el proyecto.

## 1. Preparar el repositorio y Atlas

Guardar los cambios y subir el repositorio a GitHub/GitLab para que Render pueda construirlo. Mantenerlo privado si se prefiere. No subir secretos. `frontend/.env` ya estaba versionado: retirarlo del índice con `git rm --cached frontend/.env` antes de publicar (el archivo local se conserva). El client ID de Google es público, pero las credenciales de MongoDB, SMTP y JWT nunca deben estar en variables `VITE_*`.

Reutilizar el cluster Atlas actual si es Free/M0 y su base existente `fangon-oro`, con un usuario de conexión independiente con permiso `readWrite` sobre ella. No crear otra base. Obtener la URI de conexión y comprobar que su ruta sea `/fangon-oro` antes de los parámetros, sustituyendo cualquier otro nombre de base. Exportar antes los datos, porque el despliegue modificará las cuentas y eventos existentes. Los votos y cierres requieren transacciones: no sustituir Atlas por un MongoDB standalone.

En Network Access de Atlas permitir las IPs/rangos de salida de la región del servicio Render, disponibles en su panel. Preferir esos rangos a abrir el acceso a todas las IPs. Se utilizarán las cuentas y eventos existentes en Atlas; los datos de otro MongoDB local no se copian automáticamente.

## 2. Crear el frontend

Crear un Static Site de Render conectado al repositorio:

| Campo | Valor |
| --- | --- |
| Root Directory | `frontend` |
| Build Command | `npm ci --include=dev && npm run build` |
| Publish Directory | `dist` |
| `NODE_VERSION` | `24` |
| `VITE_API_TIMEOUT_MS` | `90000` |
| `VITE_GOOGLE_CLIENT_ID` | Vacío inicialmente; configurar al habilitar Google |
| `VITE_API_URL` | Temporalmente `https://example.invalid`; después la URL HTTPS real de la API |

Este primer build obtiene la URL de la web; no está listo para usar hasta conectar la API. La aplicación navega por hash, así que no requiere reglas SPA adicionales. Añadir la cabecera `X-Robots-Tag: noindex, nofollow` a `/*` para desalentar la indexación; no sustituye el control de acceso.

## 3. Crear la API

Crear un Web Service de Render con runtime Node y plan **Free**, en Frankfurt si está disponible, conectado al mismo repositorio:

| Campo | Valor |
| --- | --- |
| Root Directory | `backend` |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `node dist/main.js` |
| Health Check Path | `/health` |
| `NODE_VERSION` | `24` |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | URI Atlas con base `fangon-oro` |
| `JWT_SECRET` | Un secreto nuevo, diferente del local |
| `FRONTEND_URL` | URL HTTPS exacta de la web, sin hash |
| `MAIL_ENABLED` | `false` inicialmente |

Render proporciona `PORT`; el backend ya lo respeta. `/health` devuelve 200 solo si MongoDB responde y 503 si no está disponible. El build de Nest copia el emblema usado por los correos. `FRONTEND_URL` habilita CORS solo para ese origen y expone `Retry-After` para que la web pueda mostrar la espera.

Generar un JWT secret localmente si se crea el servicio manualmente:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Si se usa Blueprint en lugar del flujo manual, Render solicita `MONGODB_URI`, `FRONTEND_URL` y `VITE_API_URL` al crear los servicios. Si aún no hay URLs, usar `https://example.invalid` para los dos campos de URL y sustituirlos después en el panel. La conexión a MongoDB debe ser real desde el primer arranque. `JWT_SECRET` se genera automáticamente en el Blueprint.

## 4. Conectar y comprobar

Copiar la URL HTTPS pública de la API a `VITE_API_URL` del Static Site y reconstruirlo. No añadir `/api`: Render expone las rutas Nest directamente. Si la URL final de la web difiere de la provisional, actualizar `FRONTEND_URL` en la API y redesplegarla.

Visitar `https://URL-DE-LA-API/health` y comprobar `{"status":"ok"}`. Registrar tu cuenta en la web y activar/promover únicamente esa cuenta desde Atlas Data Explorer:

```js
// En la base fangon-oro, después de comprobar el correo del documento.
db.users.updateOne(
  { email: "TU-CORREO-NORMALIZADO" },
  { $set: { isActive: true, role: "ADMIN" } }
)
```

Si se usa Data Explorer, editar esos dos campos del documento correspondiente. El script es una alternativa para mongosh. El registro no concede permisos administrativos automáticamente. Registrar las demás cuentas y activarlas desde el panel de administración de la app.

## 5. Google y límites por IP

Para habilitar Google, añadir el origen HTTPS de la web a Authorized JavaScript origins del cliente OAuth. Configurar el mismo ID en `GOOGLE_CLIENT_ID` de la API y `VITE_GOOGLE_CLIENT_ID` de la web, y reconstruir la web. Si se usa Blueprint, actualizar también el valor vacío de `VITE_GOOGLE_CLIENT_ID` en `render.yaml` antes de volver a sincronizarlo, para que no lo sobrescriba.

Los límites por IP requieren verificar la cadena de proxies real del alojamiento. No activar `trust proxy=true`. Configurar `TRUSTED_PROXY_IPS` solo con las direcciones/subredes comprobadas del proxy que conecta a Nest. Hasta entonces las peticiones que llegan a través de una misma IP del proxy pueden compartir presupuesto.

Antes de invitar al grupo, comprobar el límite desde dos redes (Wi-Fi y datos móviles): agotar el login de una cuenta desde una red no debe bloquear la otra. Probar también cambiando `X-Forwarded-For`; no debe permitir saltarse el bloqueo desde la red limitada. Si esto falla, resolver la confianza del proxy antes de considerar validada la protección por IP.

## 6. Correo y limitaciones del plan gratuito

Render Free suspende la API tras 15 minutos sin peticiones; el primer acceso puede tardar aproximadamente un minuto. La web estática sigue disponible. Se configura una espera de 90 segundos para tolerar ese arranque, aunque una petición todavía puede fallar si tarda más. No se reintentan automáticamente escrituras.

Mientras la API está suspendida, el temporizador de cierre de eventos no se ejecuta. Al arrancar, el servicio procesa eventos vencidos; probar este caso expresamente. Los contadores de intentos en memoria se reinician con cada proceso. Los datos de Atlas persisten independientemente de la API.

Render Free bloquea SMTP en 25, 465 y 587. El envío actual usa SMTP, por lo que dejar `MAIL_ENABLED=false`: las invitaciones y avisos no llegarán, y la recuperación no enviará enlaces. Para probar esos flujos con este alojamiento falta implementar un transporte de correo por HTTPS, por ejemplo la API de Brevo, y verificar el remitente. No basta con añadir una API key a las variables SMTP.

Atlas Free tiene límites de almacenamiento y no incluye las mismas funciones de backup que los planes dedicados. Mantener los datos de pruebas separados; si se quieren conservar, preparar exportaciones y comprobar su restauración. Revisar los límites actuales de cada proveedor antes de usarlo como producción.

## Plan de pruebas con el grupo

1. Registro, cuenta pendiente, activación, login y restauración de sesión en móvil.
2. Crear evento corto con varios participantes, votar desde conexiones diferentes y confirmar que el voto repetido se rechaza.
3. Esperar el cierre automático y comprobar resultados, empates, rankings e historial.
4. Probar un evento que venza mientras la API está suspendida; comprobar resultados tras reactivarla.
5. Cerrar edición y comprobar el arranque de la siguiente, incluyendo sus 60 segundos de espera.
6. Revisar permisos USER/ADMIN y límites de intentos. Añadir Google y recuperación cuando sus servicios estén configurados.

Anotar cada fallo con pantalla, hora Europe/Madrid, pasos y captura del mensaje. Consultar los logs de Render; nunca compartir tokens ni contraseñas.

Fuentes: [Render Free](https://render.com/docs/free), [Blueprint](https://render.com/docs/blueprint-spec), [IP de salida](https://render.com/docs/outbound-ip-addresses), [límites Atlas Free](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/), [Google Identity](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid), [proxies Express](https://expressjs.com/en/guide/behind-proxies/), [API de correo Brevo](https://developers.brevo.com/docs/send-a-transactional-email).
