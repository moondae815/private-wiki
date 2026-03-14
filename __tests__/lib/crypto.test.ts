import { encrypt, decrypt, CryptoError } from '@/lib/crypto'

describe('encrypt / decrypt round-trip', () => {
  it('decrypts to the original plaintext', async () => {
    const plaintext = '# 비밀 노트\n\n내용입니다.'
    const password = 'hunter2'
    const blob = await encrypt(plaintext, password)
    const result = await decrypt(blob, password)
    expect(result).toBe(plaintext)
  })

  it('produces a PRIVATE: blob', async () => {
    const blob = await encrypt('hello', 'pw')
    expect(blob.startsWith('PRIVATE:')).toBe(true)
  })

  it('produces different blobs for the same input (random salt+IV)', async () => {
    const blob1 = await encrypt('hello', 'pw')
    const blob2 = await encrypt('hello', 'pw')
    expect(blob1).not.toBe(blob2)
  })
})

describe('decrypt errors', () => {
  it('throws CryptoError with wrong_password on wrong password', async () => {
    const blob = await encrypt('secret', 'correct')
    await expect(decrypt(blob, 'wrong')).rejects.toMatchObject({
      code: 'wrong_password',
    })
  })

  it('throws CryptoError with corrupt_format on malformed blob', async () => {
    await expect(decrypt('PRIVATE:onlyone', 'pw')).rejects.toMatchObject({
      code: 'corrupt_format',
    })
  })

  it('throws CryptoError with corrupt_format on invalid base64', async () => {
    await expect(decrypt('PRIVATE:!!!:!!!:!!!', 'pw')).rejects.toMatchObject({
      code: 'corrupt_format',
    })
  })
})

describe('CryptoError', () => {
  it('is an instance of Error', () => {
    const err = new CryptoError('wrong_password', 'bad')
    expect(err).toBeInstanceOf(Error)
    expect(err.code).toBe('wrong_password')
    expect(err.message).toBe('bad')
  })
})
