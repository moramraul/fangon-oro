# Fangón de Oro · Frontend

MVP móvil en Vue 3: registro, login y perfil conectado al backend NestJS.

## Desarrollo

Con el backend y MongoDB arrancados, ejecutar desde `frontend`:

```sh
npm install
npm run dev
```

Desde un móvil conectado a la misma red, abrir la dirección de red indicada por Vite.

`/api` se reenvía al backend en `http://localhost:3000`. Para cambiarlo, copiar `.env.example` a `.env` y ajustar `API_PROXY_TARGET`.

## Pantallas

La interfaz se organiza en `src/views` (login, registro y perfil),
`src/components` (layout, acceso y tarjeta de miembro), `src/stores/auth.ts`
(autenticación y sesión con Pinia) y `src/composables/useHashRoute.ts`
(navegación por hash). `App.vue` compone el layout y selecciona la pantalla.
Los formularios mantienen sus campos localmente y envían los datos al store;
los estilos visuales compartidos siguen en `src/style.css`.

- `#/login`: correo y contraseña.
- `#/register`: nombre, correo y contraseña de 8 a 100 caracteres.
- `#/profile`: datos reales de `GET /auth/me`; se abre tras registro y login.

El JWT se conserva en localStorage. Al recargar se valida con el backend. Una sesión caducada vuelve al login; un fallo de red permite reintentar. Cerrar sesión elimina el token local. Eventos y votaciones quedan para la siguiente iteración.

## Verificación y producción

```sh
npm run build
npm run lint
```

El build genera `dist`. En producción, reenviar `/api` al backend desde el servidor del alojamiento, o configurar `VITE_API_URL` antes del build y permitir el origen del frontend mediante CORS en el backend. El proxy de Vite solo funciona en desarrollo.

El trofeo proporcionado está en `public/images/trofeo-fangon.png`. Las fuentes se cargan desde Google Fonts con alternativas locales.
