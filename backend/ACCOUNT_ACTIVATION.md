# Activación de usuarios

Los usuarios nuevos tienen `isActive: false`. El registro devuelve un mensaje de
confirmación sin token. Solo las cuentas con `isActive: true` pueden iniciar sesión
y usar endpoints autenticados, incluso si conservan un token anterior.

Un administrador activo puede consultar `GET /users` y cambiar el estado mediante
`PATCH /users/:id/activation`, con el cuerpo `{ "isActive": true }` para activar o
`{ "isActive": false }` para desactivar. Se requiere su token Bearer.

Antes de desplegar, establece explícitamente `isActive: true` en la cuenta del
administrador existente desde MongoDB. Por ejemplo, en mongosh, usando la base
de datos de la aplicación y sustituyendo el correo:

```js
db.users.updateOne(
  { email: "admin@example.com", role: "ADMIN" },
  { $set: { isActive: true } }
)
```

Comprueba que `matchedCount` sea 1. Las cuentas existentes sin `isActive` se
consideran desactivadas y necesitarán activación del administrador. No se ha
ejecutado ninguna modificación de la base de datos como parte de este cambio.
