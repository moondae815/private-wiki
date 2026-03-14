import { webcrypto } from 'node:crypto'
import { TextEncoder, TextDecoder } from 'node:util'
Object.defineProperty(globalThis, 'crypto', {
  value: webcrypto,
  writable: false,
  configurable: true,  // required: jsdom may have already defined crypto
})
Object.defineProperty(globalThis, 'TextEncoder', {
  value: TextEncoder,
  writable: false,
  configurable: true,
})
Object.defineProperty(globalThis, 'TextDecoder', {
  value: TextDecoder,
  writable: false,
  configurable: true,
})

import '@testing-library/jest-dom'
