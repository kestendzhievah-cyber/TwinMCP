/**
 * Migration script: Encrypt existing plaintext sensitive fields in the database.
 * Targets: OAuthToken.accessToken, OAuthToken.refreshToken, EnvironmentVariable.value
 *
 * Usage: npx tsx scripts/encrypt-sensitive-fields.ts
 *
 * Requires FIELD_ENCRYPTION_KEY or ENCRYPTION_KEY env var to be set.
 * Safe to run multiple times — already-encrypted values are skipped.
 */

import { PrismaClient } from '@prisma/client'
import { encryptField, isEncryptedField } from '../lib/utils/field-encryption'

async function main() {
  const prisma = new PrismaClient()

  try {
    console.log('Starting sensitive field encryption migration...\n')

    // 1. Encrypt OAuthToken accessTokens
    const oauthTokens = await prisma.oAuthToken.findMany({
      select: { id: true, accessToken: true, refreshToken: true },
    })
    let oauthCount = 0
    for (const token of oauthTokens) {
      const updates: Record<string, string> = {}
      if (token.accessToken && !isEncryptedField(token.accessToken)) {
        updates.accessToken = encryptField(token.accessToken)
      }
      if (token.refreshToken && !isEncryptedField(token.refreshToken)) {
        updates.refreshToken = encryptField(token.refreshToken)
      }
      if (Object.keys(updates).length > 0) {
        await prisma.oAuthToken.update({ where: { id: token.id }, data: updates })
        oauthCount++
      }
    }
    console.log(`  OAuthToken: ${oauthCount}/${oauthTokens.length} records encrypted`)

    // 2. Encrypt EnvironmentVariable values
    const envVars = await prisma.environmentVariable.findMany({
      select: { id: true, value: true },
    })
    let envCount = 0
    for (const envVar of envVars) {
      if (envVar.value && !isEncryptedField(envVar.value)) {
        await prisma.environmentVariable.update({
          where: { id: envVar.id },
          data: { value: encryptField(envVar.value) },
        })
        envCount++
      }
    }
    console.log(`  EnvironmentVariable: ${envCount}/${envVars.length} records encrypted`)

    console.log('\nEncryption migration complete.')
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
