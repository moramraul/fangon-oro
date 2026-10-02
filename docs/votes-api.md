# Votos y resultados REST

Primera versión: un voto por participante y evento, sin editar ni eliminar votos. No se permite votar a uno mismo, tampoco siendo ADMIN. El candidato debe participar y el evento estar OPEN. ADMIN también debe participar para votar.

Los resultados agregados se pueden consultar antes y después del cierre, con los mismos permisos que el detalle: participantes o ADMIN. No se publican votantes ni votos individuales de otras personas. Los empates devuelven todos los líderes; sin votos no hay líderes.

Estas reglas iniciales se podrán ajustar antes del frontend. No hay WebSockets todavía.

Todas las rutas requieren `Authorization: Bearer <token>`.

## Emitir voto

`POST /events/:eventId/votes`

```json
{ "votedUserId": "ID_DEL_PARTICIPANTE" }
```

Respuesta 201: `{ eventId, votedUserId, createdAt }`. El servidor obtiene el votante del JWT. No acepta voterId ni eventId en el cuerpo. Repetir voto devuelve 409; candidato inválido o voto a uno mismo 400; evento cerrado 409; ADMIN ajeno que intenta votar 403; USER ajeno 404.

## Recuperar voto propio

`GET /events/:eventId/votes/me`

Respuesta 200: `{ eventId, votedUserId, createdAt }`, o `null` si aún no has votado. Vue puede usarlo para marcar la selección y desactivar el formulario.

## Resultados

`GET /events/:eventId/results`

Respuesta:

```ts
interface EventResults {
  eventId: string;
  status: 'DRAFT' | 'OPEN' | 'CLOSED';
  totalVotes: number;
  participantCount: number;
  participationPercentage: number;
  candidates: { id: string; name: string; votes: number; percentage: number }[];
  leaderIds: string[];
}
```

Se incluyen candidatos con cero votos, ordenados por votos descendentes y luego ID. Los porcentajes se redondean a dos decimales; pueden no sumar exactamente 100 por redondeo. Los líderes en OPEN son provisionales.

## Consistencia

El índice único `(eventId, voterId)` impide duplicados incluso en peticiones simultáneas. Al iniciar el módulo se espera la inicialización del modelo y sus índices con la configuración actual de Mongoose.

El voto se escribe en una transacción junto con una actualización interna de Event condicionada a OPEN y a ambos participantes. Esta escritura incrementa `votingRevision`, que no se expone en la API, y hace que cierre y voto compitan sobre el mismo documento. Si el cierre gana, la transacción del voto no se confirma; si el voto gana, se acepta antes del cierre. MongoDB puede reintentar conflictos transitorios.

Se necesita MongoDB con soporte de transacciones: Atlas o un replica set local. No funciona con un servidor local standalone. No se introduce ningún servicio adicional.

## Comprobación manual

1. Con un ADMIN, consultar GET /users y crear un evento con dos participantes.
2. Abrirlo mediante PATCH /events/:id/status con `{ "status": "OPEN" }`.
3. Con un participante, intentar votarse a sí mismo: debe devolver 400. Después, votar al otro participante y comprobar GET /events/:id/votes/me.
4. Repetir el voto: debe devolver 409.
5. Consultar resultados: un voto, candidato elegido con 100 %, restante con cero.
6. Cerrar con ADMIN; un participante que todavía no ha votado debe recibir 409 al intentar votar.
7. Un USER ajeno no debe poder consultar resultados ni votar.

Las pruebas automáticas validan reglas y consultas con dobles de los modelos. La atomicidad real y la creación del índice requieren comprobarse contra MongoDB; no se conectó a Atlas para estas pruebas.
