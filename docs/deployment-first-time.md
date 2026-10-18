# Primer despliegue de Fangón de Oro: manual paso a paso

Este manual lleva desde el proyecto local hasta una dirección HTTPS que puedes abrir desde el móvil y compartir para pruebas. Usa Render y MongoDB Atlas con sus planes gratuitos. No necesitas comprar dominio, instalar Docker ni mantener encendido tu ordenador. Los nombres de algunos botones pueden variar; se indican también los nombres habituales en inglés.

La primera puesta en marcha incluye registro con contraseña, administración, eventos, votos, resultados, rankings y estadísticas. Google se configura al final. El correo requiere una adaptación pendiente: el código usa SMTP y Render Free bloquea esos puertos. Por tanto, la recuperación de contraseña por correo no estará operativa en esta primera fase.

## Coste previsto y dominio

**Configuración elegida tras el primer despliegue:** web `https://fangon-oro-web.onrender.com`, base existente `fangon-oro`, API de pago durante los meses de uso intenso y Free el resto. No se contratará dominio propio. Las instrucciones iniciales de Free se conservan para el alta; para activar correo con la API ya de pago, sigue el apartado 14.

El objetivo es mantener el alojamiento a **0 € dentro de los límites gratuitos**, reutilizando tu cluster actual de Atlas si es Free/M0. No necesitas contratar otro cluster para tener una base de pruebas.

| Concepto | Opción elegida | Coste previsto |
| --- | --- | --- |
| Web | Render Static Site, espacio Hobby | Gratis dentro de las cuotas incluidas |
| API | Un Web Service Render Free | Gratis dentro de las cuotas; se suspende por inactividad |
| Base de datos | Tu cluster Atlas Free/M0 actual | Gratis dentro de sus límites; las bases comparten recursos |
| Dirección inicial | Subdominio `onrender.com` que asigne Render | Incluida |
| Dominio propio opcional | Por ejemplo `fangon-oro.es` o `fangon-oro.com` | Registro y renovación anual en un registrador |

`fangon-oro` necesita una extensión para ser un dominio propio. Los ejemplos anteriores son candidatos: no se ha comprobado su disponibilidad ni su precio. Antes de comprar, compara el precio de renovación, impuestos y extras; no contrates hosting adicional para conectarlo a Render. Puedes empezar gratis y añadir el dominio después siguiendo el apartado 15.

Comprueba en los paneles el consumo y el plan antes de confirmar cambios. Evita instancias de pago, Atlas Flex/Dedicated y extras de pago como copias automáticas. Las cuotas y condiciones pueden cambiar: [Render Free](https://render.com/docs/free), [Atlas Free](https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/).

## Qué vamos a crear

| Elemento | Dónde | Para qué sirve |
| --- | --- | --- |
| Código | GitHub, repositorio `moramraul/fangon-oro` | Render descarga el proyecto desde aquí |
| Web / frontend | Render, Static Site | Pantallas que abres en el navegador |
| API / backend | Render, Web Service | Login, permisos, eventos, votos y cálculos |
| Base de datos | MongoDB Atlas, cluster Free | Guarda las cuentas, eventos y votos |

Web y API tendrán URLs distintas. Compartirás la de la **web**. La API será pública, pero sus operaciones protegidas exigen autenticación. El despliegue utilizará tu base existente `fangon-oro` dentro de tu cluster actual, con sus cuentas y eventos.

## 1. Subir la preparación a GitHub

En VS Code abre **Terminal → New Terminal**. La terminal debe estar en la raíz del proyecto, donde aparecen las carpetas `frontend`, `backend` y `docs`. Si no está ahí:

```powershell
Set-Location 'C:\Users\Rmm81\OneDrive\Escritorio\fangon-oro-project'
```

Comprueba el estado:

```powershell
git status
git branch --show-current
git remote -v
```

En la revisión de este proyecto, la rama era `main` y el repositorio remoto `https://github.com/moramraul/fangon-oro.git`. No hace falta crear otro repositorio.

El archivo local `frontend/.env` ya estaba versionado. Retíralo del seguimiento sin borrarlo de tu ordenador:

```powershell
git rm --cached frontend/.env
```

Si dice que la ruta no está en Git, comprueba `git ls-files frontend/.env`: si no muestra nada, ya está fuera del seguimiento. La regla para ignorarlo ya está preparada en `frontend/.gitignore`. Esto no borra versiones anteriores del historial; el client ID de Google es público, pero cualquier secreto que se hubiera publicado debe rotarse.

Guarda los cambios. Para el conjunto de archivos de preparación de este manual:

```powershell
git add backend/src/app.module.ts backend/src/main.ts backend/src/health.controller.ts backend/src/health.controller.spec.ts frontend/.env.example frontend/.gitignore frontend/src/api.ts frontend/src/views/PasswordRecoveryView.vue render.yaml docs/deployment-staging.md docs/deployment-first-time.md
git diff --cached --stat
```

La salida debe mostrar los archivos de preparación y la retirada de `frontend/.env`. No añadas `backend/.env` ni contraseñas. Si hay otros cambios tuyos, revísalos antes de incluirlos.

```powershell
git commit -m "Prepare free staging deployment and deployment manual"
git push origin main
```

Si Git solicita acceso, inicia sesión con tu cuenta de GitHub. Si el push se rechaza porque hay cambios remotos, no uses `--force`: conserva el mensaje para resolverlo antes de continuar.

Abre [tu repositorio](https://github.com/moramraul/fangon-oro) en el navegador. Debes ver `render.yaml` y `backend/src/health.controller.ts` en la rama `main`. **Este es el punto de comprobación del paso 1.**

## 2. Crear las cuentas

Entra en tu cuenta actual de MongoDB Atlas y abre el proyecto donde tienes Fangón. No necesitas otra cuenta. Si no tienes cuenta, créala en [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register). Esta cuenta administra la base de datos; no es una cuenta de usuario de Fangón.

Abre [Render](https://dashboard.render.com/) y regístrate, preferiblemente con GitHub para facilitar la conexión del repositorio. Selecciona el espacio de trabajo gratuito/Hobby si te pregunta por el plan. En los servicios posteriores comprueba que la API esté en **Free**, no en un plan de pago. Si la plataforma exige una tarjeta o muestra un coste que no esperabas, revisa la selección antes de aceptarlo.

## 3. Reutilizar Atlas y elegir la base

Abre tu proyecto y cluster actuales de Fangón. Comprueba que el plan sea **Free/M0**. Si ya existe, omite la creación de proyecto y cluster: varias bases pueden compartir el mismo cluster y sus límites de almacenamiento y recursos. Atlas permite un cluster Free por proyecto.

Solo si no tienes cluster: crea un proyecto y pulsa **Build a Database**, **Create** o **Create a deployment**. Selecciona **Free/M0**, sin Flex ni Dedicated, una región europea gratuita y sin datos de ejemplo. [Instrucciones oficiales](https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/).

Este manual reutiliza tu base existente **`fangon-oro`**. No tienes que crear otra base ni migrar sus datos. La web desplegada modificará esas mismas cuentas y eventos; guarda una exportación antes de probar votos, cierres o cambios de administrador. Si tu aplicación local también apunta a esa base de Atlas, ambos entornos compartirán los datos.

### Usuario de conexión

En **Security → Database Access** / **Database Users**, pulsa **Add New Database User**:

| Campo | Valor |
| --- | --- |
| Authentication Method | Password |
| Username | `fangon_app` |
| Password | Una contraseña nueva, larga, guardada en tu gestor de contraseñas |
| Database privileges | Rol `readWrite` sobre la base `fangon-oro` |

En el selector de permisos, busca **Specific Privileges** o una opción equivalente para asignar `readWrite`, base `fangon-oro`, todas las colecciones de esa base. No hace falta conceder administración del cluster. Si el asistente inicial creó un usuario con acceso más amplio, ajusta sus permisos desde Database Access.

Hay tres identidades diferentes: tu cuenta de Atlas, este usuario de conexión y los usuarios que se registrarán en Fangón. No uses tu contraseña de Atlas como contraseña de conexión. [Explicación oficial](https://www.mongodb.com/docs/atlas/tutorial/create-mongodb-user-for-cluster/).

### Copiar la URI

En tu cluster pulsa **Connect → Drivers**. Selecciona Node.js y copia la cadena de conexión a un lugar privado. No la pegues en este documento.

En esa copia privada, sustituye `<db_password>` por la contraseña del usuario de conexión. El nombre de la base tras `.net/` y antes de `?` debe ser `fangon-oro`: si ya aparece, consérvalo; si aparece otro nombre, sustitúyelo. Conserva el hostname real y los parámetros que traiga la URI.

No incluimos una URI con usuario y contraseña de ejemplo porque los detectores de secretos pueden marcarla como una credencial expuesta aunque sea ficticia. Si la contraseña contiene caracteres especiales, deben codificarse en la URI. Es más sencillo usar una contraseña aleatoria larga compuesta por letras y números para este usuario.

Guarda esta URI en un lugar privado. Es un secreto. No la pegues en GitHub, archivos del frontend ni capturas públicas. La API creará la base y sus colecciones al arrancar/escribir; no necesitas crearlas manualmente.

El acceso de red se termina en el paso 6, cuando Render proporcione sus rangos de salida. No hace falta abrir Atlas a todo Internet durante el alta.

## 4. Crear primero la web en Render

Vamos a crear los servicios manualmente. El archivo `render.yaml` queda como referencia para automatizarlo posteriormente; no uses **Blueprint** además de estos pasos, porque crearías servicios duplicados.

En Render pulsa **New + → Static Site**. Conecta GitHub si lo solicita. Autoriza el repositorio `moramraul/fangon-oro`; puede ser privado. Si no aparece, revisa **Configure GitHub App** y el acceso al repositorio.

Selecciona el repositorio y rellena:

| Campo | Valor exacto |
| --- | --- |
| Name | `fangon-pruebas-web` o un nombre disponible |
| Branch | `main` |
| Root Directory | `frontend` |
| Build Command | `npm ci --include=dev && npm run build` |
| Publish Directory | `dist` |

En **Environment Variables** / **Advanced** añade cada variable en una fila, nombre a la izquierda y valor a la derecha:

| Nombre | Valor |
| --- | --- |
| `NODE_VERSION` | `24` |
| `VITE_API_URL` | `https://example.invalid` |
| `VITE_API_TIMEOUT_MS` | `90000` |
| `VITE_GOOGLE_CLIENT_ID` | Vacío; si el panel no permite vacío, no añadir todavía |

`example.invalid` es intencionado: aún no conocemos la dirección de la API. Lo sustituiremos en el paso 7. No es la dirección de tu web ni un servicio que tengas que contratar.

Pulsa **Create Static Site** / **Deploy Static Site** y espera a que termine. En los logs deben completarse el type-check y el build de Vite. El servicio debe aparecer como **Live**.

Copia su URL HTTPS, por ejemplo `https://fangon-pruebas-web-xxxx.onrender.com`. Render puede añadir un sufijo; usa la URL que muestre tu panel. La llamaremos **URL_WEB**.

Ábrela: debes ver la interfaz. El login todavía no funcionará, porque falta la API. **Este es el punto de comprobación del paso 4.** Render aloja sitios estáticos con URL y HTTPS gestionados. [Documentación](https://render.com/docs/static-sites).

Opcionalmente, en **Headers** añade `Path: /*`, `Name: X-Robots-Tag`, `Value: noindex, nofollow`. Evita que los buscadores la indexen voluntariamente; no restringe quién puede abrirla.

## 5. Crear la API en Render

Primero genera un secreto JWT en la terminal de VS Code:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copia la cadena que aparece y guárdala de forma privada. Este secreto firma las sesiones; no es una contraseña que deban conocer tus amigos.

En Render pulsa **New + → Web Service**, elige el mismo repositorio y rellena:

| Campo | Valor exacto |
| --- | --- |
| Name | `fangon-pruebas-api` o un nombre disponible |
| Runtime / Language | Node |
| Branch | `main` |
| Region | Frankfurt, si está disponible |
| Root Directory | `backend` |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `node dist/main.js` |
| Instance Type / Plan | **Free** |
| Health Check Path, en Advanced/Settings | `/health` |

Añade las variables:

| Nombre | Valor |
| --- | --- |
| `NODE_VERSION` | `24` |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | La URI completa del paso 3 con `fangon-oro` |
| `JWT_SECRET` | La cadena recién generada |
| `FRONTEND_URL` | **URL_WEB**, incluyendo `https://`, sin `#/login` ni otras rutas |
| `MAIL_ENABLED` | `false` |

Pega los valores en los campos de Render sin envolverlos en comillas. No añadas `PORT`: Render lo proporciona. No copies las variables de tu `.env` local como un bloque: esas direcciones y secretos corresponden a otro entorno.

Pulsa **Create Web Service** / **Deploy Web Service**. [Flujo oficial](https://render.com/docs/web-services).

Es posible que el primer arranque todavía falle con un error de conexión a MongoDB, porque Atlas no permite aún el acceso desde Render. No cambies la URI a tu MongoDB local. Continúa al paso 6.

## 6. Autorizar Render en Atlas

Dentro del servicio de la **API** en Render, abre **Connect**, arriba a la derecha, y entra en **Outbound**. Copia todos los rangos de IP mostrados, incluidos sus sufijos `/xx`. No copies la URL pública ni las IPs de entrada. [Dónde encontrarlos](https://render.com/docs/outbound-ip-addresses).

Vuelve a Atlas, al proyecto de pruebas. Abre **Security → Network Access** / **IP Access List** y pulsa **Add IP Address**. Añade cada rango de salida de Render, uno por entrada. Puedes poner el comentario `Render Frankfurt pruebas`.

No necesitas el botón **Allow Access from Anywhere**. Añadir solo tu IP doméstica tampoco permitirá que Render se conecte: son conexiones diferentes.

Espera a que las entradas se activen. Vuelve a Render y, si el despliegue sigue fallido, pulsa **Manual Deploy → Deploy latest commit**. Espera a que la API aparezca como **Live**.

Copia su URL HTTPS. La llamaremos **URL_API**. Abre en el navegador:

```text
URL_API/health
```

Por ejemplo, `https://fangon-pruebas-api-xxxx.onrender.com/health`. Debes ver:

```json
{"status":"ok"}
```

Esta respuesta confirma que la API está arrancada y MongoDB responde. Abrir solo la raíz `/` puede devolver 404; no es la comprobación de estado. **Este es el punto de comprobación del paso 6.**

## 7. Conectar la web a la API

En Render abre el servicio de la **web**, no el de la API. En **Environment** edita `VITE_API_URL`: sustituye `https://example.invalid` por **URL_API**.

Ejemplo correcto: `https://fangon-pruebas-api-xxxx.onrender.com`. No añadas `/api`, `/health`, `#/login` ni `localhost`.

Pulsa **Save, rebuild, and deploy**, o guarda y después **Manual Deploy → Deploy latest commit** si esos botones aparecen separados. Debe ejecutarse un nuevo build: las variables `VITE_*` se incorporan cuando se construye el frontend.

Comprueba en la API que `FRONTEND_URL` contiene exactamente **URL_WEB**. Si cambias esta variable, guarda y redespliega la API.

Cuando la web vuelva a estar **Live**, ábrela y recarga con `Ctrl+F5`. Entra en registro, introduce tus datos y una contraseña nueva. Debe aparecer el mensaje de cuenta pendiente de activación. **Este es el punto de comprobación del paso 7.**

## 8. Crear tu primer administrador

Tu registro crea un usuario desactivado y con rol `USER`. Al ser el primero, todavía no hay administrador que pueda activarte; por eso esta primera vez lo haremos desde Atlas.

En Atlas abre el cluster y pulsa **Browse Collections** / **Data Explorer**. Selecciona la base `fangon-oro` y la colección `users`. Si no aparece, actualiza la lista. No selecciones una base local ni una colección del sistema.

Filtra por tu correo en minúsculas:

```json
{"email":"tu-correo@example.com"}
```

Localiza tu documento, pulsa editar (habitualmente un lápiz) y cambia únicamente:

| Campo | Valor | Tipo |
| --- | --- | --- |
| `isActive` | `true` | Boolean |
| `role` | `ADMIN` | String |

`true` debe ser un booleano, no el texto `"true"`. `ADMIN` sí es texto y va en mayúsculas. Conserva `_id`, correo y `passwordHash`. Guarda con **Update** / **Save**.

Vuelve a la web e inicia sesión con tu correo y contraseña. En tu perfil deben aparecer **Crear o modificar evento**, **Usuarios pendientes de activar** y la gestión de ediciones.

Si no aparecen, cierra sesión y vuelve a entrar. Si la colección está vacía, revisa que el registro del paso 7 se completó y que la URI usa `fangon-oro`.

## 9. Probar desde el móvil y con tus amigos

Abre **URL_WEB** desde el móvil usando datos móviles. No hace falta estar en el mismo Wi-Fi ni tener Vite arrancado. También puedes cerrar VS Code: el despliegue sigue en los servidores.

Comparte esa URL con dos o tres personas para la primera prueba. Cada una se registra con contraseña. Desde tu perfil de administrador, usa **Usuarios pendientes de activar → Activar** para habilitarlas. No necesitan Atlas ni Render.

Crea un evento corto desde **Crear o modificar evento**, incluye a los participantes y prueba:

1. Cada participante consulta el evento y vota desde su propia sesión.
2. Intentar votar otra vez no debe crear otro voto.
3. Un usuario sin participación no debe votar en ese evento.
4. Al finalizar, comprueba resultados, empates, clasificación y estadísticas.
5. Recarga, cierra sesión y vuelve a entrar: los datos deben conservarse.

Prueba también un evento que termine mientras la API está dormida. Al arrancar de nuevo debe procesar el cierre y permitir consultar los resultados. El cierre de edición puede probarse después; crea los datos de ensayo necesarios y ten en cuenta la espera de 60 segundos antes de abrir la siguiente edición.

## 10. Activar Google, si quieres probarlo

Este paso es opcional para el primer despliegue. Puedes utilizar el cliente OAuth que ya uses en local y añadir el origen de pruebas.

Abre [Google Cloud Console](https://console.cloud.google.com/) y selecciona el proyecto del acceso con Google. Ve a **Google Auth Platform → Clients**, o **APIs & Services → Credentials** si conserva la navegación anterior. Abre el cliente OAuth de tipo **Web application**.

En **Authorized JavaScript origins** añade **URL_WEB**, sin hash ni rutas, y guarda. No borres los orígenes locales si quieres seguir probando en tu ordenador.

En Render, añade el mismo client ID a `GOOGLE_CLIENT_ID` en la API y `VITE_GOOGLE_CLIENT_ID` en la web. Redespliega la API y reconstruye la web. Si Google presenta una restricción de audiencia/usuarios de prueba, revisa el estado del proyecto y añade las cuentas de prueba requeridas.

No necesitas compartir un client secret con el frontend: este flujo usa el client ID público y el backend verifica la credencial. Un nuevo usuario de Google también requiere activación según las reglas de la aplicación. [Configuración oficial](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid).

## 11. Qué queda fuera de esta primera puesta en marcha

**Correo:** dejar `MAIL_ENABLED=false`. No llegarán avisos de activación/invitación ni enlaces de recuperación. Render Free bloquea SMTP; para probar esos flujos debemos implementar un proveedor por HTTPS y configurarlo. Una API key de correo no sirve como sustitución directa de `SMTP_PASSWORD`.

**Límite por IP:** existe en el backend, pero antes de considerarlo validado en Render hay que comprobar la IP que resuelve el proxy. No uses los rangos **Outbound** de Atlas como `TRUSTED_PROXY_IPS`: sirven para otra conexión. No actives confianza indiscriminada en cabeceras. Si varias redes comparten el bloqueo, tendremos que ajustar la configuración de proxy a la cadena real. No es necesario inventar este valor para completar el despliegue, pero sí revisarlo antes de ampliar las pruebas.

**Disponibilidad:** Render Free suspende la API tras 15 minutos sin tráfico. El siguiente acceso puede tardar aproximadamente un minuto; la web tolera hasta 90 segundos. Mientras está suspendida no corre el temporizador de eventos. Los límites de intentos se reinician con el proceso. Atlas conserva los datos. [Limitaciones oficiales](https://render.com/docs/free).

**Datos existentes:** el despliegue utilizará las cuentas y eventos que ya estén en `fangon-oro` en Atlas. Los datos que estén exclusivamente en otro MongoDB local no se trasladan automáticamente. Guarda una exportación de Atlas antes de las pruebas y prepara su restauración. Atlas Free tiene límites; revisa el coste de cualquier opción de copia automática antes de activarla. [Límites Atlas Free](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/).

## 12. Cómo desplegar cambios después

Haz los cambios y compruébalos localmente. En la terminal de la raíz:

```powershell
git status
git add RUTA-DEL-ARCHIVO-QUE-HAS-CAMBIADO
git commit -m "Descripcion del cambio"
git push origin main
```

`RUTA-DEL-ARCHIVO-QUE-HAS-CAMBIADO` es un marcador: sustitúyelo por las rutas reales. También puedes seleccionar los archivos y hacer commit desde Source Control de VS Code. No añadas secretos.

Si mantienes Auto-Deploy activado, Render despliega los cambios de la rama seleccionada. Comprueba **Events** y los logs del servicio correspondiente. Un cambio solo en `frontend` no debería necesitar reconstruir el backend. Si no arranca automáticamente, usa **Manual Deploy → Deploy latest commit**.

Las variables del servidor se cambian en Environment de la API y requieren redespliegue. Las variables `VITE_*` se cambian en Environment de la web y requieren reconstrucción. Estos cambios no deberían borrar la base de Atlas.

## 13. Solución de errores habituales

| Síntoma | Qué comprobar |
| --- | --- |
| No aparece el repositorio en Render | Cuenta de GitHub y permisos de la GitHub App para `fangon-oro` |
| `package.json` no encontrado | Root Directory: `frontend` para web, `backend` para API |
| `nest: not found` / `vue-tsc: not found` | Build Command con `npm ci --include=dev` |
| `Cannot find module ... dist/main.js` | Root Directory, build terminado y Start Command exacto |
| Error de conexión / timeout de MongoDB | URI con hostname real y todos los rangos Outbound permitidos en Atlas |
| `Authentication failed` de MongoDB | Usuario de Database Access, contraseña, codificación y permisos; no tu cuenta Atlas |
| API Live pero la web no conecta | `VITE_API_URL` real, sin `/api`, y web reconstruida |
| Error CORS en el navegador | `FRONTEND_URL` coincide con el origen HTTPS de la web; redesplegar API |
| `/health` devuelve 404 | Cambios de preparación subidos a GitHub y desplegados en Render |
| Cuenta desactivada | `isActive=true` booleano en el documento correcto |
| No aparecen acciones de administrador | `role="ADMIN"` y nueva sesión |
| Primer acceso muy lento | Esperar al arranque de Render Free; consultar Events si falla tras la espera |
| No llega el correo | Esperado con `MAIL_ENABLED=false`; falta transporte HTTPS |
| `429 Demasiados intentos` | Esperar el tiempo indicado; comprobar proxy si afecta a otras redes |

En Render, **Events** muestra despliegues y **Logs** los mensajes del servidor. En el navegador de escritorio, abre `F12 → Network`, repite el fallo y mira la petición: URL, código de estado y respuesta. No compartas las cabeceras Authorization, contraseñas, JWT secret ni URI completa de MongoDB.

Si necesitas ayuda, indica el número de paso, servicio (web/API/Atlas), mensaje exacto y captura con secretos ocultos. Eso permite localizar el problema sin rehacer todo el despliegue.

## 14. Activar Gmail y Google con la API de pago

Con la API en un plan de pago, el código actual permite Gmail por SMTP. No basta con cambiar `MAIL_ENABLED`: configura todas las variables siguientes en **fangon-oro-api → Environment**. Los valores se pegan sin comillas ni backticks.

| Variable | Valor |
| --- | --- |
| `MAIL_ENABLED` | `true` |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `465` |
| `SMTP_SECURE` | `true` |
| `SMTP_USER` | La dirección completa de tu cuenta de Gmail emisora |
| `SMTP_PASSWORD` | Una contraseña de aplicación de esa cuenta de Google |
| `MAIL_FROM` | `Fangón de Oro <TU_CORREO_GMAIL>` sustituyendo el marcador por el mismo correo de `SMTP_USER` |
| `FRONTEND_URL` | `https://fangon-oro-web.onrender.com` |
| `GOOGLE_CLIENT_ID` | El client ID OAuth web que ya usas para el login local |

Para crear la contraseña de aplicación, activa la verificación en dos pasos y sigue las [instrucciones de Google](https://support.google.com/accounts/answer/185833). Usa esa contraseña, no la contraseña normal de tu cuenta. Si ya tienes SMTP funcionando en local, puedes reutilizar la configuración compatible; conserva la URL pública anterior. Guarda los secretos únicamente en Render o en tu configuración local privada.

En Google Cloud Console, abre el cliente OAuth web existente y añade `https://fangon-oro-web.onrender.com` a **Authorized JavaScript origins**, sin rutas ni barra final. Conserva los orígenes locales. Este flujo no necesita añadir una URI de redirección ni un client secret. [Configuración oficial](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid).

En **fangon-oro-web → Environment**, añade `VITE_GOOGLE_CLIENT_ID` con el mismo client ID que `GOOGLE_CLIENT_ID` en la API. Guarda y despliega la API; en la web utiliza **Save, rebuild, and deploy**. Cuando ambas estén Live, recarga la web y prueba el acceso con Google y la recuperación de contraseña con una cuenta existente que tenga contraseña. Comprueba recepción, spam y que el enlace apunte a la web pública; el mensaje de recuperación por sí solo no confirma el envío.

Si vuelves a Free, desactiva el correo con `MAIL_ENABLED=false` y redespliega, o adapta antes el envío a HTTPS. El acceso con Google puede seguir activo en Free.

## 15. Añadir un dominio propio opcional

Completa primero el despliegue con la dirección gratuita. Después puedes registrar un dominio disponible, por ejemplo `fangon-oro.es` o `fangon-oro.com`. El registro se paga al registrador y tiene renovación periódica; revisa su precio de renovación y los impuestos. Basta con dominio y gestión DNS, sin contratar otro alojamiento ni un certificado SSL.

Render Hobby incluye actualmente dos dominios personalizados en el espacio de trabajo y gestiona los certificados HTTPS automáticamente. Revisa cuántos tienes ya antes de añadirlos: superar los incluidos tiene coste. [Condiciones y configuración oficial](https://render.com/docs/custom-domains).

1. En el servicio de la **web** de Render, abre **Settings → Custom Domains → Add Custom Domain** e introduce el dominio que hayas registrado.
2. En el panel DNS del registrador, configura los registros que Render indique para ese dominio. Sigue las instrucciones del proveedor enlazadas por Render; no copies IPs de ejemplos. Render añade también la variante con/sin `www` y redirige a la elegida: revisa ambas entradas.
3. Vuelve a Render, pulsa **Verify** y espera a que el dominio y el certificado estén activos. Comprueba que la web abre con HTTPS.
4. Usa ese origen como nueva **URL_WEB**. En la API, actualiza `FRONTEND_URL` al origen final, por ejemplo `https://fangon-oro.es`, sin rutas ni barra final, y redespliega. Comparte esa dirección con los usuarios.
5. Si activaste Google, añade ese mismo origen en **Authorized JavaScript origins** del cliente OAuth. Comprueba de nuevo el acceso con contraseña y con Google desde el dominio definitivo.

Puedes mantener la API en su dirección `onrender.com`: `VITE_API_URL` seguirá apuntando a ella y no necesitas un dominio adicional para la API. Añadir un dominio propio no cambia los límites del plan Free ni evita la suspensión por inactividad.
