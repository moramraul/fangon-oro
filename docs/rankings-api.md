# Clasificaciones

Las clasificaciones definitivas se guardan en la colecci?n MongoDB `ranking_snapshots`. Cada cierre genera un documento inmutable con fecha `calculatedAt`, datos del evento, clasificacion final del evento, clasificacion general acumulada y clasificaciones por edicion. Se conservan nombres, avatares, puntos, contadores de desempate, porcentajes, posiciones y l?deres.

El cierre por ultimo voto guarda el snapshot dentro de la misma transacci?n del voto y del cambio de estado. Los cierres manuales y los eventos creados cerrados guardan el snapshot antes de responder. Los vencimientos y los cierres detectados al completar la participaci?n generan los snapshots mediante la reconciliaci?n del ciclo de cierre.

La reconciliaci?n se ejecuta al iniciar el backend, cada segundo y antes de las consultas de eventos. Genera los snapshots pendientes de eventos antiguos o de un cierre cuyo guardado se interrumpi?. La fecha de los snapshots hist?ricos es la fecha de generaci?n; no se inventa una fecha de cierre que no estaba registrada. No permite recuperar eventos borrados antes de disponer de su snapshot.

Una clave ?nica por evento evita guardar o sumar dos veces un cierre. Un documento reservado `__lock__` serializa las escrituras dentro de transacciones MongoDB: cada snapshot nuevo agrega los resultados finales previamente guardados, incluso si sus eventos o votos originales han desaparecido. Los lectores excluyen ese documento y eligen la revisi?n m?s reciente. MongoDB debe admitir transacciones, igual que para el env?o de votos existente.

Todas las rutas requieren JWT:

Los eventos cerrados se leen siempre de su `eventRanking` guardado: tanto `GET /events/:eventId/ranking` como `GET /events/:eventId/results` y `GET /overview/events/:id/results`. Los eventos abiertos no tienen resultados ni clasificaciones: estas rutas devuelven 409 hasta el cierre. Los permisos y las restricciones de edición de cada ruta se mantienen; la ruta de resultados de overview sigue limitada al año actual. Si falta el snapshot de un evento cerrado después de reconciliar, se devuelve 503 para reintentar, sin recalcular un resultado que podría haber cambiado.

La general y cada edición suman exclusivamente los puntos y contadores de desempate de los snapshots individuales. Nunca suman clasificaciones generales previas ni vuelven a consultar votos de eventos ya guardados. Los snapshots existentes no se sobrescriben. Los nuevos incluyen portada, número de votaciones y número de participantes. En `/events/:eventId/results`, los snapshots antiguos que no almacenaban el número de votaciones devuelven `totalVotes` y `participationPercentage` como null; conservan intactos sus puntos y posiciones.

- `GET /events/:eventId/ranking`: devuelve el snapshot final del evento cerrado; para eventos abiertos devuelve 409. Acceso limitado a participantes y ADMIN, comprobando existencia y permisos.
- `GET /rankings/general`: devuelve la clasificacion general del snapshot m?s reciente, con `calculatedAt`, sin recalcular votos. Antes del primer snapshot devuelve una clasificacion vac?a.
- `GET /overview`: la página principal recupera las posiciones de la edición abierta desde el último snapshot. La nueva edición empieza vacía inmediatamente, aunque la anterior tenga resultados. `?edition=<id>` permite consultar una edición concreta y `?edition=global` el histórico. Las ediciones cerradas utilizan su clasificación final guardada. El listado de eventos y la participación del usuario siguen consultándose por separado. Consulta el contrato completo en [editions-api.md](editions-api.md).

Formato de clasificacion: `{ scope, totalPoints, entries, leaderIds }`. La del evento incluye `eventId` y `status`. Cada entrada contiene `{ id, name, points, fivePointVotes, threePointVotes, percentage, position }`. La pagina principal expone adem?s `avatar` y `rank`.

Se suman ?nicamente resultados de eventos cerrados. Los participantes de eventos abiertos no se incorporan hasta su cierre. El desempate usa puntos, n?mero de votos de 5 y n?mero de votos de 3, en orden descendente. Los empates completos comparten posici?n con saltos (1, 1, 3), y comparten liderazgo si encabezan la tabla. El ID estabiliza el orden visual sin romper el empate. Se incluyen participantes sin puntos; sin puntos no hay l?deres. Los porcentajes se redondean a dos decimales. Los votos antiguos de un punto no incrementan los contadores de desempate.

Los snapshots preservan resultados, pero no son copias de seguridad de las papeletas originales. La API sigue impidiendo eliminar eventos cuya votaci?n ha empezado.

No se calculan clasificaciones temporales. Los snapshots se generan exclusivamente al cerrar un evento. Las rutas de resultados rechazan eventos abiertos con 409, incluso para ADMIN. La consulta del voto propio y el formulario de votacion mantienen su funcionamiento.


### Publicacion de la clasificacion de temporada

- La general se sigue calculando al cerrar cada evento. Durante la temporada, solo ADMIN recibe los puestos desde `/overview`; `/rankings/general` tambien requiere ADMIN.
- Al cerrar explicitamente la edicion con `POST /editions/:id/close`, comienza la revelacion de su clasificacion final congelada. Cerrar un evento por si solo no cierra la temporada.
- Se publican inmediatamente los cinco ultimos puestos, despues cinco puestos distintos cada 30 minutos; los empates se publican juntos y los ganadores al final. El ultimo bloque puede tener menos de cinco puestos. El reloj parte de `closedAt`, persiste entre reinicios y se aplica en el servidor.
- `/overview` incluye `publication.state` (`hidden`, `revealing`, `published`, `admin`) y `nextRevealAt`; solo devuelve nombres y puntos de puestos publicados a USER. La pagina de clasificaciones consulta las novedades cada 30 segundos durante la revelacion.
- Los premios y estadisticas de una edicion quedan ocultos a USER hasta completar la revelacion. La general global y sus estadisticas quedan reservadas a ADMIN para no filtrar la temporada activa. Las ediciones cerradas pueden consultarse individualmente en Historica.
- Los resultados individuales de eventos requieren ADMIN o que la revelacion de su edicion haya terminado, tanto en `/overview/events/:id/results` como en `/events/:eventId/ranking`. ADMIN tiene un acceso a la general privada desde Administracion de eventos.

La revelacion tiene su propia vista `#/reveal/:editionId` y endpoint autenticado `GET /overview/reveal/:editionId`. Solo este endpoint publica puestos parciales. La vista habitual de clasificaciones y `/overview` no muestran puestos durante la revelacion; se desbloquean al publicarse el ganador.
