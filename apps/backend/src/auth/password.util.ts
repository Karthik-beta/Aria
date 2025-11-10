import { randomBytes } from 'crypto';

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%^&*()-_=+[]{}<>?';
const ALL = `${UPPER}${LOWER}${DIGITS}${SYMBOLS}`;

/**
 * Generate a temporary password with mixed character classes.
 * Ensures at least one character from each class for basic complexity.
 */
export function generateTemporaryPassword(length = 16): string {
  if (length < 8) {
    throw new Error('Temporary passwords must be at least 8 characters long.');
  }

  const required = [
    UPPER[Math.floor(Math.random() * UPPER.length)],
    LOWER[Math.floor(Math.random() * LOWER.length)],
    DIGITS[Math.floor(Math.random() * DIGITS.length)],
    SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
  ];

  const remainingLength = length - required.length;
  const bytes = randomBytes(remainingLength);

  const chars = new Array<string>(length);
  for (let i = 0; i < remainingLength; i += 1) {
    const idx = bytes[i] % ALL.length;
    chars[i] = ALL[idx];
  }

  // Fill remaining slots with required characters to guarantee complexity
  for (let i = 0; i < required.length; i += 1) {
    chars[remainingLength + i] = required[i];
  }

  // Shuffle characters for unpredictability
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}
