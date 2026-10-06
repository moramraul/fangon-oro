export interface User {
  id: string
  hasPassword: boolean
  hasGoogle: boolean
  passwordPromptSeen: boolean
  name: string
  avatar?: string
  email: string
  role: 'USER' | 'ADMIN'
  isActive: boolean
}
export interface EditionSummary {
  id: string
  name: string
  number: number
  status: 'open' | 'closed'
  opensAt: string
  expectedEndsAt: string
  closedAt: string | null
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
      signal: options.signal ?? AbortSignal.timeout(15000),
    })
  } catch {
    throw new Error(
      'No podemos conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.',
    )
  }
  if (!response.ok) {
    if (path === '/auth/reset-password' && response.status === 400) {
      throw new ApiError(400, 'El enlace no es válido o ha caducado. Solicita uno nuevo.')
    }
    const messages: Record<number, string> = {
      400: 'Revisa los datos. La contraseña debe tener entre 8 y 100 caracteres.',
      401: 'El correo o la contraseña no son correctos. Vuelve a intentarlo.',
      403: ['/auth/login', '/auth/google'].includes(path)
        ? 'Tu cuenta está desactivada. Contacta con un administrador para activarla.'
        : 'No tienes permisos para realizar esta operación.',
      409: 'Ya existe una cuenta con este correo. Inicia sesión.',
      429: 'Demasiados intentos. Espera un momento antes de volver a probar.',
    }
    if (path === '/auth/google' && response.status === 401) {
      throw new ApiError(
        401,
        'No hemos podido verificar tu cuenta de Google. Prueba de nuevo o entra con tu contraseña.',
      )
    }
    throw new ApiError(
      response.status,
      messages[response.status] ||
        'El servidor no ha podido completar la operación. Inténtalo de nuevo.',
    )
  }
  const body = await response.text()
  return (body.trim() ? JSON.parse(body) : null) as T
}
