/**
 * @fluxstack/config
 *
 * Standalone, zero-dependency, declarative configuration system.
 * Laravel-inspired with full TypeScript type inference.
 *
 * @example
 * ```ts
 * import { defineConfig, config } from '@fluxstack/config'
 *
 * export const appConfig = defineConfig({
 *   name: config.string('APP_NAME', 'MyApp', true),
 *   port: config.number('PORT', 3000),
 *   debug: config.boolean('DEBUG', false),
 *   env: config.enum('NODE_ENV', ['development', 'production', 'test'] as const, 'development'),
 *   origins: config.array('CORS_ORIGINS', ['*']),
 * })
 * ```
 */

// Config schema system
export {
  defineConfig,
  defineReactiveConfig,
  defineNestedConfig,
  validateConfig,
  ReactiveConfig,
  config,
  envString,
  envNumber,
  envBoolean,
  envArray,
  envEnum,
} from './config-schema'

export type {
  ConfigFieldType,
  ConfigField,
  ConfigSchema,
  InferConfig,
  ValidationError,
  ValidationResult,
} from './config-schema'

// Environment variable loader
export { env, createNamespace } from './env'
