# Límites de intentos de autenticación

Los endpoints públicos de autenticación tienen un guard que limita peticiones antes de validar datos, consultar usuarios, verificar contraseñas o enviar correos. Cuenta todas las peticiones, incluidas las correctas y las mal formadas.

| Operación | Límite | Ventana móvil |
| --- | --- | --- |
| Login y Google, juntos | 20 por IP | 5 minutos |
| Login con el mismo correo | 5 por combinación IP + correo | 5 minutos |
| Solicitar recuperación | 5 por IP | 15 minutos |
| Restablecer contraseña | 10 por IP | 15 minutos |
| Registro | 5 por IP | 15 minutos |

Al superar un límite, la API devuelve HTTP 429 y `Retry-After` con los segundos restantes. Las peticiones rechazadas no prolongan la ventana del límite alcanzado. El frontend muestra el tiempo de espera redondeado a minutos. Una cuenta no se bloquea globalmente: puede iniciar sesión desde otra IP. Los usuarios que comparten una conexión comparten el presupuesto por IP.

La recuperación mantiene además su protección existente en MongoDB: como máximo un correo por cuenta cada 60 segundos, incluso entre procesos. Su respuesta sigue siendo genérica para no revelar si la cuenta existe. El correo del login se normaliza y se guarda como hash en los contadores; no se guardan contraseñas ni tokens.

## Proxy y despliegue

Por defecto se utiliza la IP de la conexión; no se confía en cabeceras enviadas por el cliente. Si el backend está detrás de un proxy, configurar `TRUSTED_PROXY_IPS` con las direcciones o subredes de los proxies que realmente controla el despliegue, separadas por comas. Ejemplo para un proxy local: `TRUSTED_PROXY_IPS=loopback`. No incluir redes de clientes ni confiar indiscriminadamente en todas las direcciones. Consultar la [documentación oficial de Express](https://expressjs.com/en/guide/behind-proxies/).

El proxy de Vite en desarrollo no reenvía la IP original: las conexiones a través de él comparten el límite. Para probar IPs independientes, usar un proxy configurado para sobrescribir las cabeceras de origen y confiar solo en ese proxy.

Los contadores se mantienen en memoria por proceso y se reinician al reiniciar el backend. La memoria admite hasta 10.000 contadores; al llenarse, se rechazan claves nuevas temporalmente en lugar de eliminar límites activos. Las entradas caducadas se limpian al recibir peticiones, como máximo una vez por minuto. Esta implementación está orientada a una instancia del backend; varias instancias requieren un almacén compartido (por ejemplo Redis) o límites en el proxy. No protege frente a ataques volumétricos ni distribuidos desde muchas IPs.

## Verificación

`cd backend` y `npm test -- auth-rate-limit.spec.ts --runInBand` ejecuta pruebas HTTP del controlador real con los servicios sustituidos, sin necesitar MongoDB ni enviar correos. Comprueban bloqueo previo a los servicios, expiración, ventana móvil, cabeceras falsificadas, aislamiento por IP, datos inválidos y límites de cada endpoint.
