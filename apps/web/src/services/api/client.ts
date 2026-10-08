import type { ApiResponse } from '@weather/shared-types'

const BASE = import.meta.env.VITE_API_BASE_URL ?? ''

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message)
  }
}

const FRIENDLY: Record<string, string> = {
  NETWORK: "Can't reach the weather service. Check your connection.",
  RATE_LIMITED: 'Too many requests — give it a few seconds.',
}

/** Typed request against our backend. Never surfaces raw HTTP errors to the UI. */
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
    })
  } catch {
    throw new ApiError(FRIENDLY.NETWORK!, 'NETWORK', 0)
  }

  let body: ApiResponse<T> | null = null
  try {
    body = (await response.json()) as ApiResponse<T>
  } catch {
    body = null
  }

  if (!body) throw new ApiError('Weather data is temporarily unavailable.', 'BAD_RESPONSE', response.status)
  if (!body.success) throw new ApiError(FRIENDLY[body.error.code] ?? body.error.message, body.error.code, response.status)
  return body.data
}
