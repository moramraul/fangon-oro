# Eventos de pruebas

En Gestionar eventos, activar **Evento de pruebas** antes de crear el evento. La marca `isTest: true` queda fijada al crearlo; no se puede convertir un evento oficial en prueba ni una prueba en oficial. Los eventos anteriores sin el campo siguen siendo oficiales.

Los votos conservan las reglas habituales: participantes autorizados, reparto de 5, 3 y 1 puntos, un solo envio y cierre por plazo, administrador o participacion completa. El muro anonimo se consulta en la pagina del evento, pestana **Respuestas**, despues del cierre. Tambien se puede abrir desde administracion. No hay clasificacion individual del evento de pruebas.

Los eventos de pruebas:

- No crean snapshots individuales, parciales, por edicion ni generales, ni avanzan la revision del snapshot.
- No aportan puntos, participaciones, desempates, estadisticas o premios.
- No modifican la revision de la edicion al crearse ni bloquean su cierre.
- No envian correos de invitacion al crearlos o anadir participantes.
- Se identifican visualmente en administracion, listados y formulario.

## API

`POST /events` admite el booleano opcional `isTest` (por defecto `false`), solo para ADMIN. `PATCH /events/:id` rechaza ese campo. El resumen y detalle devuelven `isTest`.

Los endpoints `/events/:id/results`, `/events/:id/ranking` y `/overview/events/:id/results` rechazan las pruebas con 409. `/events/:id/responses` conserva autorizacion y comprobacion de cierre, tambien en pruebas.

`DELETE /events/:id`, solo para ADMIN, permite borrar pruebas abiertas o cerradas. Elimina fisicamente el evento y todos sus votos (incluidas las justificaciones) en una unica transaccion. El borrado escribe el mismo documento de evento que el envio de votos: los envios concurrentes se eliminan o fallan al reintentarse despues del borrado. Si falla la eliminacion de votos, MongoDB revierte la transaccion completa. Los eventos oficiales conservan sus restricciones de borrado.

No quedan documentos del evento en la aplicacion: no se generan snapshots, historiales propios ni correos. Los usuarios participantes son cuentas independientes y no se borran con el evento. Esto no elimina backups, auditorias o registros de infraestructura que conserve Atlas o el proveedor del despliegue. No convierte ni limpia eventos oficiales usados anteriormente para hacer pruebas.

## Comprobacion manual

1. Crear una prueba con al menos cuatro participantes, incluida la cuenta que va a votar.
2. Comprobar la etiqueta y que no se reciben invitaciones.
3. Votar con justificaciones y verificar que el muro rechaza el acceso mientras siga abierta.
4. Cerrar con **Cerrar prueba** o completar todos los votos. Abrir **Ver respuestas** y comprobar el anonimato.
5. Comprobar que las clasificaciones, estadisticas y premios oficiales no cambian.
6. Usar **Borrar prueba** y confirmar. Comprobar que desaparece de los listados y que el detalle y el muro responden 404; en Atlas no deben quedar votos con su `eventId` ni snapshots con su `key`.

Las pruebas automatizadas usan dobles de Mongoose. La atomicidad de MongoDB requiere Atlas o un replica set y se debe comprobar en ese entorno.
