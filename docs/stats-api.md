# Estadísticas

`GET /stats` requiere JWT y utiliza exclusivamente el último snapshot, para la edición seleccionada o para todas las ediciones. No consulta usuarios ni votos actuales y no incorpora eventos abiertos. Los nombres y fotos se conservan aunque se elimine la cuenta original. Por defecto muestra la misma edición que la página principal.

Respuesta: `{ scope, editionId, editionName, editions, calculatedAt, awards }`. Cada título contiene `{ id, title, description, votes, people }`; cada persona incluye `{ id, name, avatar }`. Sin un snapshot con participantes se devuelve `awards: []`; la interfaz muestra «Aun no hay estadísticas para mostrar».

Sin parámetros se muestra la edición abierta. `GET /stats?edition=<id>` consulta una edición concreta y `GET /stats?edition=global` utiliza los totales históricos del `generalRanking` guardado. Las ediciones cerradas utilizan su `finalRanking` inmutable. Las pestañas permiten elegir cada edición o Globales; ninguna consulta utiliza votos en curso. Una edición sin snapshots devuelve títulos vacíos. Los parámetros inválidos devuelven 400.

- Mister 5: máximo contador `fivePointVotes`.
- Mister 3: máximo contador `threePointVotes`.
- Mister 1: máximo de `points - 5 * fivePointVotes - 3 * threePointVotes`. Incluye los votos antiguos de un punto.
- El anti fangón: mínimo número de votos recibidos, sumando los de 5, 3 y 1 punto. No se compara la suma de puntos ni se divide por el número de eventos jugados. Se incluyen personas sin votos que hayan participado en eventos cerrados.

Todos los empates comparten el título. Un máximo de cero no otorga Mister 5/3/1; el anti fangón sí puede corresponder a personas con cero votos. Sin foto se muestran las iniciales. No se requiere modificar snapshots existentes ni añadir una colección.
