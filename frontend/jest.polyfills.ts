/**
 * Polyfills mínimos para Jest + jsdom.
 * jest-environment-jsdom não expõe TextEncoder/TextDecoder.
 */
import { TextEncoder, TextDecoder } from 'util';

Object.assign(globalThis, { TextEncoder, TextDecoder });
