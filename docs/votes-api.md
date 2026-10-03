# Votaciones y resultados REST

Cada participante emite una sola votaci?n por evento, repartiendo 5, 3 y 1 punto entre tres candidatos distintos. No puede votarse a s? mismo (tampoco ADMIN). Todos los candidatos y el votante deben participar en el evento. Por tanto, para votar hacen falta al menos cuatro participantes. No se editan ni eliminan votaciones.

Todas las rutas requieren JWT. El evento debe estar abierto y dentro del intervalo de votaci?n. Las consultas de resultados y voto propio conservan los permisos del detalle del evento: participantes o ADMIN.

## Emitir votaci?n

`POST /events/:eventId/votes`

```json
{ "candidateIds": ["ID_5_PUNTOS", "ID_3_PUNTOS", "ID_1_PUNTO"] }
```

El orden determina la puntuaci?n. El servidor asigna los puntos y obtiene al votante del JWT. No acepta puntos, voterId ni eventId en el cuerpo. Deben enviarse exactamente tres IDs v?lidos y distintos, incluso comparando may?sculas y min?sculas.

Respuesta 201:

```ts
{
  eventId: string;
  allocations: { votedUserId: string; points: number }[];
  createdAt: string;
}
```

Repetir votaci?n devuelve 409; candidatos inv?lidos, repetidos, ajenos o el propio votante devuelven 400; votaci?n fuera de plazo o evento cerrado devuelve 409; ADMIN ajeno devuelve 403; USER ajeno devuelve 404.

## Votaci?n propia

`GET /events/:eventId/votes/me`

Devuelve el mismo formato o null si todav?a no ha votado. No se exponen votaciones individuales de otras personas.

## Resultados

`GET /events/:eventId/results`

```ts
interface EventResults {
  eventId: string;
  status: 'open' | 'closed';
  totalVotes: number; // votaciones emitidas, no asignaciones ni puntos
  totalPoints: number;
  participantCount: number;
  participationPercentage: number;
  candidates: { id: string; name: string; points: number; percentage: number }[];
  leaderIds: string[];
}
```

Cada nueva votaci?n suma nueve puntos y cuenta como una participaci?n. Los candidatos se ordenan por puntos descendentes, despu?s por n?mero de votos de 5 y despu?s de 3, incluyendo candidatos con cero puntos. Los porcentajes de candidatos se calculan sobre totalPoints y se redondean a dos decimales. Sin puntos no hay l?deres. Los resultados de eventos abiertos son provisionales.

Las clasificaciones por evento y general utilizan la misma suma de puntos; ver rankings-api.md.

## Consistencia y votos anteriores

El ?ndice ?nico (eventId, voterId) impide duplicados. Las tres asignaciones se guardan juntas en un ?nico documento dentro de la transacci?n que comprueba el estado y todos los participantes. Se incrementa votingRevision para coordinar cierres y votaciones concurrentes. Cuando todos los participantes han emitido su votaci?n se cierra el evento: se cuentan documentos, no asignaciones.

Se necesita MongoDB Atlas o un replica set con soporte de transacciones. Los tests usan dobles de los modelos; no validan la atomicidad contra una base de datos real.

Los documentos antiguos con votedUserId siguen ley?ndose como una asignaci?n de un punto, tanto en el voto propio como en resultados y clasificaciones. No se inventan los otros dos candidatos ni se modifican esos documentos. Los nuevos env?os usan exclusivamente candidateIds. Es un cambio de contrato: las entradas de candidatos y clasificaciones ahora exponen points y las clasificaciones totalPoints.

El desempate se aplica en resultados, clasificaci?n del evento y clasificaci?n general: puntos totales, n?mero de votos de 5 (`fivePointVotes`) y n?mero de votos de 3 (`threePointVotes`), todos descendentes. Ambos contadores se incluyen en cada candidato o entrada. Si coinciden los tres valores, comparten posici?n y, si encabezan la clasificaci?n, aparecen juntos en `leaderIds`. El ID solo estabiliza el orden visual; no rompe el empate. Los votos antiguos de un punto no incrementan ninguno de estos contadores.
