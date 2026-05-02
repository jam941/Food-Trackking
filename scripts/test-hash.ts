// Test cross-implementation compatibility
import { hashPassword as hashNode, verifyPassword as verifyNode } from 'better-auth/crypto'

// Also directly test the noble/hashes path
import { scryptAsync } from '@noble/hashes/scrypt.js'
import { bytesToHex } from '@noble/hashes/utils'

async function hashWithNoble(password: string): Promise<string> {
  const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)))
  const key = await scryptAsync(password.normalize('NFKC'), salt, { N: 16384, r: 16, p: 1, dkLen: 64, maxmem: 128 * 16384 * 16 * 2 })
  return `${salt}:${bytesToHex(key)}`
}

const password = 'Ab98tULafs32s'

// Hash with noble/hashes (as Vite might use), verify with node:crypto (as tsx uses)
const nobleHash = await hashWithNoble(password)
const nodeVerifiesNoble = await verifyNode({ hash: nobleHash, password })
console.log('Noble hash, node verifies:', nodeVerifiesNoble)

// Hash with node:crypto (as tsx/seed uses), verify with noble
const nodeHash = await hashNode(password)
// Noble verify
const [salt, key] = nodeHash.split(':')
const targetKey = await scryptAsync(password.normalize('NFKC'), salt!, { N: 16384, r: 16, p: 1, dkLen: 64, maxmem: 128 * 16384 * 16 * 2 })
const nobleVerifiesNode = bytesToHex(targetKey) === key
console.log('Node hash, noble verifies:', nobleVerifiesNode)
