import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto';

const scrypt = (
  password: string,
  salt: string,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const ALGORITHM = 'scrypt';
const COST = 16384;
const BLOCK_SIZE = 8;
const PARALLELISM = 1;

/**
 * Passwords and tokens are never stored in plain text. Password hashes use
 * `scrypt$N$r$p$salt$hash`; opaque tokens are stored as SHA-256 hashes.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH).toString('hex');
  const derived = await scrypt(password, salt, KEY_LENGTH, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLELISM,
  });
  return [
    ALGORITHM,
    COST,
    BLOCK_SIZE,
    PARALLELISM,
    salt,
    derived.toString('hex'),
  ].join('$');
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6) return false;
  const [algorithm, cost, blockSize, parallelism, salt, hash] = parts;
  if (
    algorithm !== ALGORITHM ||
    !cost ||
    !blockSize ||
    !parallelism ||
    !salt ||
    !hash
  ) {
    return false;
  }
  const expected = Buffer.from(hash, 'hex');
  if (expected.length !== KEY_LENGTH) return false;
  const derived = await scrypt(password, salt, KEY_LENGTH, {
    N: Number(cost),
    r: Number(blockSize),
    p: Number(parallelism),
  });
  return (
    derived.length === expected.length && timingSafeEqual(derived, expected)
  );
}

/**
 * Opaque tokens are high-entropy random values, so a single SHA-256 pass is
 * sufficient and keeps token lookup a unique index hit.
 */
export const hashOpaqueToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

export const generateOpaqueToken = (): string =>
  randomBytes(32).toString('hex');
