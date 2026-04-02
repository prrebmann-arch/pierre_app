/**
 * AES-256-GCM encryption/decryption for sensitive data (Stripe keys, etc.)
 * File prefixed with _ so Vercel does NOT deploy it as a route.
 *
 * Requires env var: STRIPE_ENCRYPTION_KEY (64 hex chars = 32 bytes)
 * Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

const crypto = require('crypto');

const ALGO = 'aes-256-gcm';

function getKey() {
  const hex = process.env.STRIPE_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('STRIPE_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)');
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypt a plaintext string.
 * Returns: "iv_hex:auth_tag_hex:ciphertext_hex"
 */
function encrypt(text) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${tag}:${encrypted}`;
}

/**
 * Decrypt a ciphertext produced by encrypt().
 * Input format: "iv_hex:auth_tag_hex:ciphertext_hex"
 */
function decrypt(data) {
  if (!data || !data.includes(':')) {
    // Plaintext fallback — log warning for monitoring
    if (data) console.warn('[crypto] decrypt called on non-encrypted data — migration needed');
    return data;
  }
  const key = getKey();
  const [ivHex, tagHex, encrypted] = data.split(':');
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Check if a value is already encrypted (contains the iv:tag:cipher format).
 */
function isEncrypted(data) {
  if (!data || typeof data !== 'string') return false;
  const parts = data.split(':');
  return parts.length === 3 && parts[0].length === 24 && parts[1].length === 32;
}

module.exports = { encrypt, decrypt, isEncrypted };
