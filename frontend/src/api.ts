export interface User {
  id: string
  name: string
  email: string
  role: 'USER' | 'ADMIN'
}
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}
const baseUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')
export async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
      signal: AbortSignal.timeout(15000),
    })
  } catch {
    throw new Error(
      'No podemos conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.',
    )
  }
  if (!response.ok) {
    const messages: Record<number, string> = {
      400: 'Revisa los datos. La contraseña debe tener entre 8 y 100 caracteres.',
      401: 'El correo o la contraseña no son correctos. Vuelve a intentarlo.',
      409: 'Ya existe una cuenta con este correo. Inicia sesión.',
      429: 'Demasiados intentos. Espera un momento antes de volver a probar.',
    }
    throw new ApiError(
      response.status,
      messages[response.status] ||
        'El servidor no ha podido completar la operación. Inténtalo de nuevo.',
    )
  }
  return response.json() as Promise<T>
}
