# Clasificaciones

El modelo `Ranking` es un modelo de lectura calculado a partir de los votos. Cada evento tiene su clasificación desde su creación, incluso sin votos. No requiere una colección adicional ni migrar los eventos existentes.

Todas las rutas requieren JWT:

- `GET /events/:eventId/ranking`: clasificación del evento; accesible a sus participantes y ADMIN, igual que sus resultados.
- `GET /rankings/general`: clasificación general accesible a cualquier usuario autenticado. Suma los puntos de todos los eventos, abiertos y cerrados, incluyendo eventos en los que el usuario que consulta no participa. Solo expone nombres, identificadores y puntos totales; no revela votantes.

Respuesta: `{ scope, totalPoints, entries, leaderIds }`. La clasificación del evento también incluye `eventId` y `status`.

Cada entrada contiene `{ id, name, points, percentage, position }`. Se ordenan por puntos descendentes, despu?s por n?mero de votos de 5 y despu?s de 3. Los empates comparten posición con saltos (1, 1, 3). Se incluyen participantes con cero votos; en la general, cada participante aparece una única vez. Sin votos no hay líderes. Los porcentajes se redondean a dos decimales.

La general conserva los votos de usuarios eliminados con el nombre `Usuario eliminado`. Los resultados de eventos abiertos son provisionales. La ruta existente `/events/:eventId/results` sigue disponible con el formato de puntos descrito en `votes-api.md`.

Las consultas generales de votos, participantes y nombres son independientes: durante actividad concurrente no representan una instantánea transaccional única.

El desempate se aplica en resultados, clasificaci?n del evento y clasificaci?n general: puntos totales, n?mero de votos de 5 (`fivePointVotes`) y n?mero de votos de 3 (`threePointVotes`), todos descendentes. Ambos contadores se incluyen en cada candidato o entrada. Si coinciden los tres valores, comparten posici?n y, si encabezan la clasificaci?n, aparecen juntos en `leaderIds`. El ID solo estabiliza el orden visual; no rompe el empate. Los votos antiguos de un punto no incrementan ninguno de estos contadores.
