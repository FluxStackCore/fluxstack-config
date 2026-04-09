import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  defineConfig,
  defineReactiveConfig,
  defineNestedConfig,
  validateConfig,
  config,
  env,
  envString,
  envNumber,
  envBoolean,
  envArray,
  envEnum,
  createNamespace,
} from '../src/index'

/**
 * Helper to set env vars for tests
 */
function setEnv(key: string, value: string) {
  process.env[key] = value
}

function clearEnv(key: string) {
  delete process.env[key]
}

describe('@fluxstack/config', () => {
  beforeEach(() => {
    env.clearCache()
  })

  describe('config helpers', () => {
    it('config.string() creates a string field', () => {
      const field = config.string('TEST_STR', 'hello')
      expect(field.type).toBe('string')
      expect(field.env).toBe('TEST_STR')
      expect(field.default).toBe('hello')
      expect(field.required).toBe(false)
    })

    it('config.string() with required=true', () => {
      const field = config.string('TEST_STR', 'hello', true)
      expect(field.required).toBe(true)
    })

    it('config.number() creates a number field', () => {
      const field = config.number('TEST_NUM', 42)
      expect(field.type).toBe('number')
      expect(field.env).toBe('TEST_NUM')
      expect(field.default).toBe(42)
    })

    it('config.boolean() creates a boolean field', () => {
      const field = config.boolean('TEST_BOOL', true)
      expect(field.type).toBe('boolean')
      expect(field.env).toBe('TEST_BOOL')
      expect(field.default).toBe(true)
    })

    it('config.array() creates an array field', () => {
      const field = config.array('TEST_ARR', ['a', 'b'])
      expect(field.type).toBe('array')
      expect(field.env).toBe('TEST_ARR')
      expect(field.default).toEqual(['a', 'b'])
    })

    it('config.enum() creates an enum field', () => {
      const field = config.enum('TEST_ENUM', ['dev', 'prod'] as const, 'dev')
      expect(field.type).toBe('enum')
      expect(field.env).toBe('TEST_ENUM')
      expect(field.values).toEqual(['dev', 'prod'])
      expect(field.default).toBe('dev')
    })
  })

  describe('defineConfig()', () => {
    it('loads config with default values', () => {
      const cfg = defineConfig({
        name: config.string('__TEST_CFG_NAME', 'MyApp'),
        port: config.number('__TEST_CFG_PORT', 3000),
        debug: config.boolean('__TEST_CFG_DEBUG', false),
      })

      expect(cfg.name).toBe('MyApp')
      expect(cfg.port).toBe(3000)
      expect(cfg.debug).toBe(false)
    })

    it('reads values from environment variables', () => {
      setEnv('__TEST_ENV_NAME', 'FromEnv')
      setEnv('__TEST_ENV_PORT', '8080')
      setEnv('__TEST_ENV_DEBUG', 'true')

      const cfg = defineConfig({
        name: config.string('__TEST_ENV_NAME', 'Default'),
        port: config.number('__TEST_ENV_PORT', 3000),
        debug: config.boolean('__TEST_ENV_DEBUG', false),
      })

      expect(cfg.name).toBe('FromEnv')
      expect(cfg.port).toBe(8080)
      expect(cfg.debug).toBe(true)

      clearEnv('__TEST_ENV_NAME')
      clearEnv('__TEST_ENV_PORT')
      clearEnv('__TEST_ENV_DEBUG')
    })

    it('handles enum fields', () => {
      const cfg = defineConfig({
        env: config.enum('__TEST_ENUM_ENV', ['development', 'production', 'test'] as const, 'development'),
      })

      expect(cfg.env).toBe('development')
    })

    it('reads enum from env var', () => {
      setEnv('__TEST_ENUM_ENV2', 'production')

      const cfg = defineConfig({
        env: config.enum('__TEST_ENUM_ENV2', ['development', 'production', 'test'] as const, 'development'),
      })

      expect(cfg.env).toBe('production')

      clearEnv('__TEST_ENUM_ENV2')
    })

    it('handles array fields from env (comma-separated)', () => {
      setEnv('__TEST_ARR', 'a,b,c')

      const cfg = defineConfig({
        items: config.array('__TEST_ARR', ['default']),
      })

      expect(cfg.items).toEqual(['a', 'b', 'c'])

      clearEnv('__TEST_ARR')
    })

    it('throws on required field missing', () => {
      expect(() => {
        defineConfig({
          secret: config.string('__TEST_MISSING_REQUIRED', undefined, true),
        })
      }).toThrow('Configuration validation failed')
    })

    it('throws on invalid enum value from env', () => {
      setEnv('__TEST_BAD_ENUM', 'invalid')

      expect(() => {
        defineConfig({
          mode: config.enum('__TEST_BAD_ENUM', ['a', 'b'] as const, undefined, true),
        })
      }).toThrow("must be one of")

      clearEnv('__TEST_BAD_ENUM')
    })

    it('supports custom validation', () => {
      expect(() => {
        defineConfig({
          port: {
            type: 'number' as const,
            default: 99999,
            required: true,
            validate: (value: unknown) => {
              const n = value as number
              if (n < 1 || n > 65535) return 'Port must be between 1 and 65535'
              return true
            },
          },
        })
      }).toThrow('Port must be between 1 and 65535')
    })

    it('supports custom transform', () => {
      const cfg = defineConfig({
        upper: {
          type: 'string' as const,
          default: 'hello',
          transform: (v: unknown) => String(v).toUpperCase(),
        },
      })

      expect(cfg.upper).toBe('HELLO')
    })
  })

  describe('defineReactiveConfig()', () => {
    it('creates a reactive config with .values', () => {
      const reactive = defineReactiveConfig({
        name: config.string('__TEST_REACTIVE_NAME', 'Initial'),
      })

      expect(reactive.values.name).toBe('Initial')
    })

    it('.get() returns field value', () => {
      const reactive = defineReactiveConfig({
        port: config.number('__TEST_REACTIVE_PORT', 3000),
      })

      expect(reactive.get('port')).toBe(3000)
    })

    it('.has() checks field existence', () => {
      const reactive = defineReactiveConfig({
        name: config.string('__TEST_REACTIVE_HAS', 'exists'),
      })

      expect(reactive.has('name')).toBe(true)
    })

    it('.reload() refreshes from env', () => {
      const reactive = defineReactiveConfig({
        val: config.string('__TEST_REACTIVE_RELOAD', 'before'),
      })

      expect(reactive.values.val).toBe('before')

      setEnv('__TEST_REACTIVE_RELOAD', 'after')
      reactive.reload()

      expect(reactive.values.val).toBe('after')

      clearEnv('__TEST_REACTIVE_RELOAD')
    })

    it('.watch() notifies on reload', () => {
      const reactive = defineReactiveConfig({
        val: config.string('__TEST_REACTIVE_WATCH', 'v1'),
      })

      let watchedValue: string | undefined
      const unwatch = reactive.watch((cfg) => {
        watchedValue = cfg.val as string
      })

      setEnv('__TEST_REACTIVE_WATCH', 'v2')
      reactive.reload()

      expect(watchedValue).toBe('v2')

      // Unwatch works
      unwatch()
      setEnv('__TEST_REACTIVE_WATCH', 'v3')
      reactive.reload()

      expect(watchedValue).toBe('v2') // not updated

      clearEnv('__TEST_REACTIVE_WATCH')
    })
  })

  describe('validateConfig()', () => {
    it('returns valid for correct config', () => {
      const schema = {
        name: config.string('__TEST_VALIDATE', 'ok', true),
      }

      const result = validateConfig(schema, { name: 'hello' } as any)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('returns errors for missing required field', () => {
      const schema = {
        secret: config.string('__TEST_VALIDATE_REQ', undefined, true),
      }

      const result = validateConfig(schema, {} as any)
      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].field).toBe('secret')
    })
  })

  describe('defineNestedConfig()', () => {
    it('groups configs by namespace', () => {
      const nested = defineNestedConfig({
        app: {
          name: config.string('__TEST_NESTED_NAME', 'App'),
        },
        server: {
          port: config.number('__TEST_NESTED_PORT', 3000),
        },
      })

      expect(nested.app.name).toBe('App')
      expect(nested.server.port).toBe(3000)
    })
  })

  describe('env loader', () => {
    it('env.get() reads from process.env', () => {
      setEnv('__TEST_ENV_GET', 'value')
      env.clearCache()

      expect(env.get('__TEST_ENV_GET', '')).toBe('value')

      clearEnv('__TEST_ENV_GET')
    })

    it('env.has() checks existence', () => {
      setEnv('__TEST_ENV_HAS', 'yes')
      expect(env.has('__TEST_ENV_HAS')).toBe(true)
      expect(env.has('__TEST_ENV_NOPE')).toBe(false)

      clearEnv('__TEST_ENV_HAS')
    })

    it('env.get() returns default when var is missing', () => {
      expect(env.get('__TEST_ENV_MISSING', 42)).toBe(42)
    })

    it('env.get() casts number from string', () => {
      setEnv('__TEST_ENV_NUM', '9090')
      env.clearCache()

      expect(env.get('__TEST_ENV_NUM', 0)).toBe(9090)

      clearEnv('__TEST_ENV_NUM')
    })

    it('env.get() casts boolean from string', () => {
      setEnv('__TEST_ENV_BOOL', 'true')
      env.clearCache()

      expect(env.get('__TEST_ENV_BOOL', false)).toBe(true)

      clearEnv('__TEST_ENV_BOOL')
    })

    it('env.get() casts array from comma-separated string', () => {
      setEnv('__TEST_ENV_ARR', 'x,y,z')
      env.clearCache()

      expect(env.get('__TEST_ENV_ARR', [] as string[])).toEqual(['x', 'y', 'z'])

      clearEnv('__TEST_ENV_ARR')
    })
  })

  describe('createNamespace()', () => {
    it('prefixes env var lookups', () => {
      setEnv('MY_PREFIX_HOST', 'localhost')
      env.clearCache()

      const ns = createNamespace('MY_PREFIX_')
      expect(ns.get('HOST', '')).toBe('localhost')
      expect(ns.has('HOST')).toBe(true)

      clearEnv('MY_PREFIX_HOST')
    })
  })

  describe('boolean casting — falsy string values', () => {
    afterEach(() => {
      clearEnv('__TEST_BOOL_FALSE')
      clearEnv('__TEST_BOOL_ZERO')
      clearEnv('__TEST_BOOL_NO')
      clearEnv('__TEST_BOOL_OFF')
      clearEnv('__TEST_BOOL_EMPTY')
    })

    it('castValue("false") should return false, not true', () => {
      setEnv('__TEST_BOOL_FALSE', 'false')

      const cfg = defineConfig({
        flag: config.boolean('__TEST_BOOL_FALSE', false),
      })

      expect(cfg.flag).toBe(false)
    })

    it('castValue("0") should return false', () => {
      setEnv('__TEST_BOOL_ZERO', '0')

      const cfg = defineConfig({
        flag: config.boolean('__TEST_BOOL_ZERO', true),
      })

      expect(cfg.flag).toBe(false)
    })

    it('castValue("no") should return false', () => {
      setEnv('__TEST_BOOL_NO', 'no')

      const cfg = defineConfig({
        flag: config.boolean('__TEST_BOOL_NO', true),
      })

      expect(cfg.flag).toBe(false)
    })

    it('castValue("off") should return false', () => {
      setEnv('__TEST_BOOL_OFF', 'off')

      const cfg = defineConfig({
        flag: config.boolean('__TEST_BOOL_OFF', true),
      })

      expect(cfg.flag).toBe(false)
    })

    it('castValue("FALSE") should return false (case-insensitive)', () => {
      setEnv('__TEST_BOOL_FALSE', 'FALSE')

      const cfg = defineConfig({
        flag: config.boolean('__TEST_BOOL_FALSE', true),
      })

      expect(cfg.flag).toBe(false)
    })
  })

  describe('standalone helpers (envString, etc.)', () => {
    it('envString works like config.string', () => {
      const field = envString('X', 'val')
      expect(field).toEqual(config.string('X', 'val'))
    })

    it('envNumber works like config.number', () => {
      const field = envNumber('X', 10)
      expect(field).toEqual(config.number('X', 10))
    })

    it('envBoolean works like config.boolean', () => {
      const field = envBoolean('X', true)
      expect(field).toEqual(config.boolean('X', true))
    })

    it('envArray works like config.array', () => {
      const field = envArray('X', ['a'])
      expect(field).toEqual(config.array('X', ['a']))
    })

    it('envEnum works like config.enum', () => {
      const field = envEnum('X', ['a', 'b'] as const, 'a')
      expect(field).toEqual(config.enum('X', ['a', 'b'] as const, 'a'))
    })
  })

  describe('API compatibility with FluxStack app patterns', () => {
    it('app.config.ts pattern works', () => {
      const appConfig = defineConfig({
        name: config.string('__COMPAT_APP_NAME', 'fluxstack-app', true),
        version: config.string('__COMPAT_APP_VERSION', '1.0.0', true),
        description: config.string('__COMPAT_APP_DESC', 'A FluxStack application', false),
        env: config.enum('__COMPAT_NODE_ENV', ['development', 'production', 'test'] as const, 'development', false),
        mode: config.enum('__COMPAT_MODE', ['full-stack', 'backend-only', 'frontend-only'] as const, 'full-stack', false),
        trustProxy: config.boolean('__COMPAT_TRUST_PROXY', false),
        sessionSecret: config.string('__COMPAT_SESSION_SECRET', ''),
      })

      expect(appConfig.name).toBe('fluxstack-app')
      expect(appConfig.version).toBe('1.0.0')
      expect(appConfig.env).toBe('development')
      expect(appConfig.mode).toBe('full-stack')
      expect(appConfig.trustProxy).toBe(false)
    })

    it('csrf-protection config pattern works', () => {
      const csrfConfig = defineConfig({
        enabled: config.boolean('__COMPAT_CSRF_ENABLED', true),
        cookieName: config.string('__COMPAT_CSRF_COOKIE', 'XSRF-TOKEN'),
        headerName: config.string('__COMPAT_CSRF_HEADER', 'X-CSRF-Token'),
        tokenLength: config.number('__COMPAT_CSRF_LEN', 32),
        safeMethods: config.array('__COMPAT_CSRF_SAFE', ['GET', 'HEAD', 'OPTIONS']),
        excludePaths: config.array('__COMPAT_CSRF_EXCLUDE', ['/api/health']),
        sameSite: config.enum('__COMPAT_CSRF_SAMESITE', ['strict', 'lax', 'none'] as const, 'strict'),
        secure: config.boolean('__COMPAT_CSRF_SECURE', false),
        path: config.string('__COMPAT_CSRF_PATH', '/'),
      })

      expect(csrfConfig.enabled).toBe(true)
      expect(csrfConfig.cookieName).toBe('XSRF-TOKEN')
      expect(csrfConfig.tokenLength).toBe(32)
      expect(csrfConfig.safeMethods).toEqual(['GET', 'HEAD', 'OPTIONS'])
      expect(csrfConfig.sameSite).toBe('strict')
    })

    it('session.config.ts pattern works', () => {
      const sessionConfig = defineConfig({
        driver: config.enum('__COMPAT_SESSION_DRIVER', ['memory'] as const, 'memory'),
        lifetime: config.number('__COMPAT_SESSION_LIFETIME', 7200),
        cookieName: config.string('__COMPAT_SESSION_COOKIE', 'fluxstack_session'),
        httpOnly: config.boolean('__COMPAT_SESSION_HTTP', true),
        secure: config.boolean('__COMPAT_SESSION_SECURE', false),
        sameSite: config.enum('__COMPAT_SESSION_SAMESITE', ['strict', 'lax', 'none'] as const, 'lax'),
        path: config.string('__COMPAT_SESSION_PATH', '/'),
        domain: config.string('__COMPAT_SESSION_DOMAIN', ''),
      })

      expect(sessionConfig.driver).toBe('memory')
      expect(sessionConfig.lifetime).toBe(7200)
      expect(sessionConfig.cookieName).toBe('fluxstack_session')
      expect(sessionConfig.httpOnly).toBe(true)
      expect(sessionConfig.sameSite).toBe('lax')
    })
  })
})
