# Events y participantes

Diseño de la primera implementación REST, implementada en `backend/src/events`. Los estados y restricciones descritos se aplican en el backend. Votos y frontend quedan para fases posteriores.

## Base existente

El backend usa NestJS 11, Mongoose, CommonJS, JWT Bearer y los roles USER/ADMIN. El frontend ya existe con Vue 3, TypeScript, Vite y Pinia, pero todavía no tiene vistas de eventos.

## Modelo propuesto

Guardar los participantes dentro de Event como referencias a User. No crear EventParticipant: actualmente la participación no tiene datos propios como asistencia confirmada, invitación o fecha de incorporación. Si aparecen esas necesidades, se podrá revisar esta decisión.

```ts
type EventStatus = 'DRAFT' | 'OPEN' | 'CLOSED';

interface EventData {
  name: string;
  date: Date;
  description?: string;
  status: EventStatus;
  createdBy: Types.ObjectId;
  participants: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}
```

`Types.ObjectId` representa una referencia de MongoDB. Mongoose puede resolver estas referencias con `populate`, pero una referencia no garantiza que el usuario exista: el servicio debe comprobarlo antes de guardar.

- `name`: obligatorio, recortado, entre 1 y 100 caracteres.
- `date`: instante del evento; entrada y salida ISO 8601 con zona horaria. Vue lo presenta en la zona local del usuario.
- `description`: opcional, máximo propuesto de 2.000 caracteres.
- `status`: DRAFT por defecto. La fecha no abre ni cierra automáticamente la votación.
- `createdBy`: lo obtiene el backend del usuario autenticado; no se acepta en el cuerpo de la petición y no se modifica.
- `participants`: lista sin duplicados de usuarios existentes; puede estar vacía en DRAFT.
- Fechas de auditoría: generadas mediante `timestamps: true`.
- Índice inicial propuesto: `{ participants: 1, date: -1 }`, para consultar eventos propios ordenados por fecha.

## Estados y participantes

Propuesta conservadora para no invalidar votos al cambiar participantes:

| Estado | Significado | Editar participantes | Votar |
| --- | --- | --- | --- |
| DRAFT | Preparación | Sí, ADMIN | No |
| OPEN | Votación abierta | No | Solo participantes |
| CLOSED | Votación cerrada | No | No |

Transiciones propuestas: DRAFT → OPEN → CLOSED. Abrir exige al menos un participante. No reabrir en esta primera versión; esa posibilidad se puede decidir junto con las reglas de votos. Nombre, fecha y descripción siguen siendo editables por ADMIN.

Estas reglas forman la primera versión. Congelar participantes al abrir evita tener que decidir ahora qué hacer con los votos de un usuario eliminado o con los recibidos por un candidato eliminado.

## Permisos

Todos los endpoints requieren autenticación. Cualquier ADMIN puede gestionar cualquier evento; `createdBy` registra autoría y no limita la gestión al creador.

| Operación | USER | ADMIN |
| --- | --- | --- |
| Consultar mis eventos | Solo los propios | Solo los propios |
| Consultar detalle | Si participa | Cualquier evento para gestionarlo |
| Listar todos para administración | No | Sí |
| Crear, editar, cambiar participantes o estado | No | Sí |
| Eliminar | No | Solo DRAFT |
| Votar (módulo posterior) | Si participa y está OPEN | Si participa y está OPEN |

Los borradores también aparecen en «mis eventos» si el usuario participa. Vue puede presentarlos como «En preparación».

La comprobación de participación se hace en EventsService, usando el usuario autenticado. RolesGuard solo resuelve el rol general: no conoce los participantes de un evento. Para consultas no autorizadas de un USER se propone 404, igual que si el evento no existiera, sin revelar eventos ajenos.

## Contrato REST propuesto

| Método y ruta | Uso |
| --- | --- |
| GET /events | Mis eventos, filtrados por el ID autenticado, fecha descendente |
| GET /events/:id | Detalle autorizado con participantes |
| GET /admin/events | Todos los eventos para ADMIN |
| POST /events | Crear un borrador, solo ADMIN |
| PATCH /events/:id | Editar nombre, fecha o descripción, solo ADMIN |
| PUT /events/:id/participants | Sustituir participantes de un DRAFT, solo ADMIN |
| PATCH /events/:id/status | Aplicar una transición, solo ADMIN |
| DELETE /events/:id | Eliminar un DRAFT, solo ADMIN |
| GET /users | Selector de usuarios registrados, solo ADMIN, respuesta pública mínima |

Crear recibe `{ name, date, description?, participantIds? }`. Si no hay participantes, se guarda una lista vacía.

Actualizar participantes recibe `{ participantIds: string[] }`. Sustituir la lista completa simplifica el formulario Vue: selecciona usuarios y guarda una vez. Validar IDs, duplicados y existencia de todos los usuarios antes de escribir; rechazar toda la operación si falla alguno. No usar `populate` como validación de existencia.

Actualizar estado recibe `{ status }`. No aceptar `status`, `createdBy` o participantes en el PATCH general.

Errores: 400 para entradas inválidas; 401 sin sesión válida; 403 para acciones administrativas sin rol; 404 para evento ausente o detalle ajeno; 409 para acciones incompatibles con el estado. Las escrituras dependientes del estado deben filtrar también por el estado esperado en MongoDB, evitando que una edición de participantes se aplique después de abrir el evento por una petición concurrente.

Inicialmente no se necesita paginación por el tamaño del grupo. Se añadirá si el historial lo requiere.

## Respuestas para Vue

No devolver directamente documentos de Mongoose. Mapear a respuestas explícitas: los IDs son strings y las fechas son ISO 8601. Esto mantiene un contrato estable aunque cambie el almacenamiento.

```ts
type EventStatus = 'DRAFT' | 'OPEN' | 'CLOSED';

interface EventSummary {
  id: string;
  name: string;
  date: string;
  status: EventStatus;
  participantCount: number;
}

interface ParticipantSummary {
  id: string;
  name: string;
}

interface EventDetail extends EventSummary {
  description: string | null;
  createdBy: string;
  participants: ParticipantSummary[];
  createdAt: string;
  updatedAt: string;
}
```

GET /events y GET /admin/events devuelven `EventSummary[]`; el detalle devuelve `EventDetail`. Para participantes y selector de usuarios basta `{ id, name }`: no exponer emails, hashes ni googleId. La respuesta del detalle también sirve tras crear o actualizar.

El dashboard usa el resumen sin descargar todos los usuarios. El detalle carga los candidatos. El formulario ADMIN carga GET /users y envía los IDs seleccionados. Vue puede ocultar acciones según rol y estado, pero el servidor vuelve a comprobar cada permiso.

## Ajustes incluidos en la implementación

- `passwordHash` usa `select: false`; el login lo solicita explícitamente y rechaza cuentas sin contraseña.
- GET /users exige ADMIN y devuelve únicamente `{ id, name }`.
- Se retira POST /users, que duplicaba registro y devolvía el documento guardado. POST /auth/register sigue siendo la entrada de registro.
- /auth/me permanece disponible para cualquier autenticado, sin @Roles, con respuesta explícita `{ id, name, email, role }`.
- Mantener CommonJS, la importación actual de bcrypt y JWT Bearer. La decisión de cookies se revisará conjuntamente con auth frontend.

## Implementación posterior y validación

Un EventsModule agrupa schema, DTOs, servicio y controladores, y registra el modelo con Mongoose. Los DTOs validan la forma de la petición; el servicio comprueba usuarios, permisos y reglas de estado. No se necesitan repositorios adicionales ni una colección de participación.

Verificar especialmente: USER no crea eventos; USER no consulta eventos ajenos; ADMIN gestiona eventos de otro ADMIN; mis eventos nunca incluye eventos sin participación; IDs inexistentes o repetidos se rechazan; participantes no cambian al abrir; respuestas no exponen passwordHash; una edición concurrente no salta la restricción del estado.

Vote ya está implementado como colección separada. El contrato y las reglas iniciales están en [votes-api.md](votes-api.md): un voto fijo, voto propio permitido, resultados visibles y todos los líderes en caso de empate. No se permite reapertura. No implementar WebSockets hasta validar el flujo REST de votos.
