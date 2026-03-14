// src/lib/crypto.ts
// CLIENT-ONLY: never import this from src/app/api/ or src/lib/files.ts

export class CryptoError extends Error {
  constructor(
    public code: 'wrong_password' | 'corrupt_format',
    message: string
  ) {
    super(message)
    this.name = 'CryptoError'
  }
}

const PBKDF2_ITERATIONS = 100_000
const KEY_LENGTH = 256

function b64ToBytes(b64: string): Uint8Array {
  try {
    return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  } catch {
    throw new CryptoError('corrupt_format', 'Invalid base64')
  }
}

function bytesToB64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

async function deriveKey(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encrypt(
  plaintext: string,
  password: string
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(32))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt)
  const enc = new TextEncoder()
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  )
  return `PRIVATE:${bytesToB64(salt)}:${bytesToB64(iv)}:${bytesToB64(new Uint8Array(ciphertext))}`
}

export async function decrypt(
  encrypted: string,
  password: string
): Promise<string> {
  const parts = encrypted.split(':')
  // Format: PRIVATE:<salt>:<iv>:<ciphertext> — 4 parts
  if (parts.length !== 4 || parts[0] !== 'PRIVATE') {
    throw new CryptoError('corrupt_format', 'Invalid PRIVATE blob format')
  }
  const [, saltB64, ivB64, ciphertextB64] = parts
  const salt = b64ToBytes(saltB64)
  const iv = b64ToBytes(ivB64)
  const ciphertext = b64ToBytes(ciphertextB64)

  const key = await deriveKey(password, salt)
  let plainBytes: ArrayBuffer
  try {
    plainBytes = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    )
  } catch {
    throw new CryptoError('wrong_password', 'Decryption failed')
  }
  return new TextDecoder().decode(plainBytes)
}
