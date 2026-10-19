# Ediciones

Una edición es un periodo definido por el administrador, no un año natural. `editions` almacena nombre, número, estado, apertura, fin orientativo, cierre real, administrador que cerró y clasificación final. El número identifica la edición del trofeo (por ejemplo, 2027 puede empezar en diciembre de 2026).

Al arrancar, se crea la primera edición si no existe una abierta. Una edición permanece abierta hasta su cierre manual. El 31 de diciembre a las 23:59:59.999, horario de Madrid, es únicamente una referencia visual: no cierra ni impide crear eventos.

`POST /events` asigna automáticamente `editionId` consultando la edición abierta. La asignación y la creación se realizan en una transacción que escribe también en la edición, coordinando creaciones concurrentes con su cierre. La edición no se puede escoger ni cambiar desde el formulario o los DTOs. Antes de `opensAt`, la creación devuelve 409.

## Administración

- `GET /editions`: listado autenticado de ediciones, con `{ id, name, number, status, opensAt, expectedEndsAt, closedAt }`.
- `POST /editions/:id/close`: solo ADMIN. Procesa los eventos vencidos de esa edición, comprueba que no quede ninguno abierto, captura los snapshots finales pendientes y guarda su suma como `finalRanking`. Cierra la edición y crea la siguiente con apertura exactamente 60 segundos después del cierre, dentro de una misma transacción. Un cierre repetido devuelve 409. Un índice único parcial garantiza una sola edición abierta.

El perfil del administrador ofrece la acción con revisión de la clasificación y confirmación. El resultado definitivo se calcula al confirmar; un evento abierto con plazo pendiente bloquea el cierre. Si falla cualquier escritura, la transacción revierte el cierre y la nueva edición.

## Clasificaciones y estadísticas

`GET /editions/:id/winners` requiere sesión y devuelve `{ edition, preview, awards }`. Las ediciones abiertas solo admiten ADMIN (404 para USER): su vista previa utiliza los snapshots de eventos cerrados y no guarda premios ni ejecuta el sorteo definitivo. En el empate final de la vista previa se muestra el primer candidato; el sorteo se realiza al cerrar. Las ediciones cerradas admiten cualquier usuario autenticado y devuelven los premios definitivos con `preview: false`. `awards` contiene `gold`, `silver`, `bronze` y `goldenUnderpants`, con listas de premiados y sus puntos. Los premios se guardan junto con `finalRanking` en la transacción de cierre. Las ediciones cerradas anteriormente los derivan de su clasificación guardada. Nombres y avatares se resuelven desde el perfil actual.

Oro, plata y bronce corresponden a las posiciones 1, 2 y 3; sus empates comparten premio y las posiciones omitidas quedan desiertas. Calzón de Oro se asigna a un único participante: menos puntos, después menos votos recibidos (cada asignación de 5, 3 o 1 cuenta como un voto), después más eventos participados y, si persiste el empate, selección al azar al cerrar. El resultado se guarda para evitar nuevos sorteos al consultar. Sin participantes, todos los premios quedan desiertos. La página `#/winners` muestra cuatro banners y permite elegir entre ediciones cerradas; ADMIN también puede seleccionar la edición abierta con aviso de vista previa. El header muestra Ganadores siempre a ADMIN y a USER cuando existe alguna edición cerrada.

Los snapshots de eventos guardan `event.editionId`; los acumulados `editions` se agrupan por ese ID. La general histórica continúa sumando snapshots individuales. La clasificación final de una edición cerrada se conserva en su propio documento.

- `GET /overview`: edición activa, sus eventos y clasificación. Una edición nueva empieza vacía, aunque haya resultados del mismo año natural en la anterior.
- `GET /overview?edition=<id>`: edición concreta, usando su clasificación final si está cerrada.
- `GET /overview?edition=global`: clasificación histórica y eventos cerrados de todas las ediciones.
- `GET /stats?edition=<id>` y `GET /stats?edition=global`: estadísticas por edición o históricas. Sin parámetro utiliza la edición activa. La respuesta incluye `editionId`, `editionName` y `editions`.
- `GET /overview/events/:id/results`: snapshot del evento cerrado, también de ediciones anteriores. Los eventos abiertos no exponen resultados.

Los datos de prueba sin `editionId` no se migran ni se borran automáticamente. No aparecen en la edición activa ni en los nuevos acumulados; sus snapshots antiguos tampoco se utilizan como base del nuevo historial. Antes de comenzar el uso real, el administrador puede limpiar sus datos de prueba por separado.

MongoDB debe admitir transacciones (Atlas o replica set), como ya requiere el envío de votos. No se modifica el estado de una edición por cambios directos del calendario.
