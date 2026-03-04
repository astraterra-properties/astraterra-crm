/**
 * AES-256-GCM field-level encryption utility
 * Used to encrypt sensitive data (phone numbers, emails, financial amounts) before storing in DB.
 *
 * Format of encrypted value:  iv_hex:authTag_hex:ciphertext_hex
 * Unencrypted values pass through transparently (backward-compat with existing plain data).
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const ENCRYPTED_PREFIX = 'enc:';

function getKey() {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex || keyHex.length < 64) {
    throw new Error('ENCRYPTION_KEY must be a 32-byte hex string (64 hex chars) in .env');
  }
  return Buffer.from(keyHex.substring(0, 64), 'hex');
}

/**
 * Encrypt a string value. Returns null/undefined unchanged.
 * Already-encrypted values (starting with 'enc:') are returned as-is.
 */
function encrypt(plaintext) {
  if (plaintext === null || plaintext === undefined) return plaintext;
  const text = String(plaintext);
  if (text.startsWith(ENCRYPTED_PREFIX)) return text; // already encrypted

  try {
    const key = getKey();
    const iv = crypto.randomBytes(12); // 96-bit IV for GCM
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return `${ENCRYPTED_PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (err) {
    console.error('[encryption] encrypt error:', err.message);
    return plaintext; // fail open — don't lose data
  }
}

/**
 * Decrypt a value encrypted with encrypt(). Returns plain values unchanged.
 */
function decrypt(value) {
  if (value === null || value === undefined) return value;
  const text = String(value);
  if (!text.startsWith(ENCRYPTED_PREFIX)) return text; // plain text — legacy data

  try {
    const payload = text.slice(ENCRYPTED_PREFIX.length);
    const parts = payload.split(':');
    if (parts.length !== 3) return value; // malformed — return raw

    const [ivHex, tagHex, ciphertext] = parts;
    const key = getKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(tagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('[encryption] decrypt error:', err.message);
    return value; // fail open — return raw rather than crash
  }
}

/**
 * Decrypt all specified fields on an object (or array of objects).
 * Usage: decryptFields(row, ['phone', 'email'])
 */
function decryptFields(data, fields) {
  if (!data) return data;
  if (Array.isArray(data)) return data.map(item => decryptFields(item, fields));
  const result = { ...data };
  for (const field of fields) {
    if (result[field] !== undefined) {
      result[field] = decrypt(result[field]);
    }
  }
  return result;
}

module.exports = { encrypt, decrypt, decryptFields };
