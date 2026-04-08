/**
 * @fluxstack/config — Environment Variable Loader
 *
 * Standalone environment variable loader with:
 * - Automatic type casting
 * - Build-safe dynamic access (prevents Bun inlining)
 * - Simple, intuitive API
 * - TypeScript type inference
 *
 * @example
 * ```ts
 * import { env } from '@fluxstack/config'
 *
 * const port = env.get('PORT', 3000)        // number
 * const debug = env.get('DEBUG', false)      // boolean
 * const tags = env.get('TAGS', ['api'])      // string[]
 * ```
 */

/**
 * Smart environment loader with dynamic access
 * Uses Bun.env (runtime) -> process.env (fallback)
 */
class EnvLoader {
  private cache = new Map<string, unknown>()
  private accessor: () => Record<string, string | undefined>

  constructor() {
    this.accessor = this.createAccessor()
  }

  /**
   * Create dynamic accessor to prevent build-time inlining
   */
  private createAccessor(): () => Record<string, string | undefined> {
    const global = globalThis as unknown as Record<string, Record<string, unknown> | undefined>

    return () => {
      // Try Bun.env first (most reliable in Bun)
      const bun = global['Bun'] as Record<string, unknown> | undefined
      if (bun?.['env']) {
        return bun['env'] as Record<string, string | undefined>
      }

      // Fallback to process.env
      const proc = global['process'] as Record<string, unknown> | undefined
      if (proc?.['env']) {
        return proc['env'] as Record<string, string | undefined>
      }

      return {}
    }
  }

  /**
   * Get environment variable with automatic type casting
   * Type is inferred from defaultValue
   */
  get<T>(key: string, defaultValue?: T): T {
    // Check cache first
    const cacheKey = `${key}:${typeof defaultValue}`
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) as T
    }

    const env = this.accessor()
    const value = env[key]

    if (!value || value === '') {
      this.cache.set(cacheKey, defaultValue as T)
      return defaultValue as T
    }

    // Auto-detect type from defaultValue
    let result: unknown = value

    if (typeof defaultValue === 'number') {
      const parsed = Number(value)
      result = isNaN(parsed) ? defaultValue : parsed
    } else if (typeof defaultValue === 'boolean') {
      result = ['true', '1', 'yes', 'on'].includes(value.toLowerCase())
    } else if (Array.isArray(defaultValue)) {
      result = value.split(',').map(v => v.trim()).filter(Boolean)
    } else if (typeof defaultValue === 'object' && defaultValue !== null) {
      try {
        result = JSON.parse(value)
      } catch {
        result = defaultValue
      }
    }

    this.cache.set(cacheKey, result)
    return result as T
  }

  /**
   * Check if environment variable exists and has a value
   */
  has(key: string): boolean {
    const env = this.accessor()
    const value = env[key]
    return value !== undefined && value !== ''
  }

  /**
   * Get all environment variables
   */
  all(): Record<string, string> {
    const env = this.accessor()
    const result: Record<string, string> = {}

    for (const [key, value] of Object.entries(env)) {
      if (value !== undefined && value !== '') {
        result[key] = value
      }
    }

    return result
  }

  /**
   * Require specific environment variables (throws if missing)
   */
  require(keys: string[]): void {
    const missing = keys.filter(key => !this.has(key))
    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.join(', ')}\n` +
        `Please set them in your .env file or environment.`
      )
    }
  }

  /**
   * Validate environment variable value
   */
  validate(key: string, validValues: string[]): void {
    const value = this.get(key, '')
    if (value && !validValues.includes(value)) {
      throw new Error(
        `Invalid value for ${key}: "${value}"\n` +
        `Valid values are: ${validValues.join(', ')}`
      )
    }
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    this.cache.clear()
  }
}

// Singleton instance
const loader = new EnvLoader()

/**
 * Unified environment variables API
 */
export const env = {
  /**
   * Get environment variable with smart type casting
   * @example env.get('PORT', 3000) -> number
   */
  get: <T>(key: string, defaultValue?: T): T => loader.get(key, defaultValue),

  /**
   * Check if environment variable exists
   */
  has: (key: string): boolean => loader.has(key),

  /**
   * Get all environment variables
   */
  all: (): Record<string, string> => loader.all(),

  /**
   * Require environment variables (throws if missing)
   */
  require: (keys: string[]): void => loader.require(keys),

  /**
   * Validate environment variable value
   */
  validate: (key: string, validValues: string[]): void => loader.validate(key, validValues),

  /**
   * Clear cache (for testing)
   */
  clearCache: (): void => loader.clearCache(),
}

/**
 * Create namespaced environment access
 * @example
 * const db = createNamespace('DATABASE_')
 * db.get('URL') // reads DATABASE_URL
 */
export function createNamespace(prefix: string) {
  return {
    get: <T>(key: string, defaultValue?: T): T =>
      env.get(`${prefix}${key}`, defaultValue),

    has: (key: string): boolean =>
      env.has(`${prefix}${key}`),

    all: (): Record<string, string> => {
      const allEnv = env.all()
      const namespaced: Record<string, string> = {}

      for (const [key, value] of Object.entries(allEnv)) {
        if (key.startsWith(prefix)) {
          namespaced[key.slice(prefix.length)] = value
        }
      }

      return namespaced
    }
  }
}

export default env
