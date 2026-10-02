# Pruebas del backend en Postman

1. Levanta el backend y usa MongoDB Atlas o un replica set: los votos necesitan transacciones.
2. En Postman, importa `fangon-oro.postman_collection.json` y `local.postman_environment.json` con **Import**.
3. Selecciona el entorno **Fangon Oro · Local**. Ajusta `baseUrl` si tu puerto no es 3000.
4. Ejecuta únicamente la carpeta **01 · Registro** en Collection Runner, con una iteración. Genera cinco cuentas con correos nuevos y guarda sus tokens.
5. En las variables de la colección, copia el valor de `adminEmail`. En MongoDB Compass, busca ese usuario en la colección `users` y cambia `role` a `ADMIN`. El registro no permite asignar roles y no existe un endpoint de promoción.
6. En Collection Runner, selecciona únicamente las carpetas **02 a 08**, en orden, con una iteración. No vuelvas a ejecutar 01 entre estos pasos: crearía nuevas cuentas.
7. Consulta los resultados de los tests en Runner. Cada petición comprueba el código HTTP esperado; los resultados de votos también comprueban cantidades, porcentajes y líderes.

Alternativa a Compass, desde mongosh conectado a la base de datos del backend:

```javascript
db.users.updateOne(
  { email: "COPIA_AQUI_EL_VALOR_DE_adminEmail" },
  { $set: { role: "ADMIN" } }
)
```

Los tokens e IDs se guardan automáticamente en variables de colección. Si la identidad del administrador no tiene rol ADMIN, el Runner se detiene en la carpeta 02. Corrige el rol y ejecuta de nuevo desde 02.

La colección tiene 106 peticiones: registro, login, identidad, permisos, usuarios, creación y edición de eventos, participantes, estados, votos, duplicados, autovotos USER/ADMIN, resultados, empates, cierre y eliminación de borradores. Los errores 400/401/403/404/409 son casos esperados y tienen tests que los validan. Login y registro devuelven 201 actualmente.

Las peticiones crean usuarios y eventos en la base de datos configurada. Solo se elimina el borrador utilizado para probar DELETE; las cuentas y los dos eventos cerrados permanecen. Una nueva ejecución completa comienza por 01 y requiere promover el nuevo administrador. Para repetir pruebas individuales de votos o estados, ten en cuenta que dependen del estado dejado por las peticiones anteriores.

La comprobación de voto propio sin votar acepta JSON `null` o cuerpo vacío, según cómo Nest serialice el retorno del servicio. La colección no prueba concurrencia entre voto/cierre o votos simultáneos.

Los archivos se han validado como JSON y los scripts se han comprobado sintácticamente. Ejecutar el Runner contra el backend es necesario para verificar el comportamiento real.
