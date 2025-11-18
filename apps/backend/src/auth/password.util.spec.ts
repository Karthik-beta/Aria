import { generateTemporaryPassword } from './password.util';

const UPPERCASE = /[A-Z]/;
const LOWERCASE = /[a-z]/;
const DIGIT = /\d/;
const SYMBOL = /[^A-Za-z0-9]/;

describe('generateTemporaryPassword', () => {
  it('throws when requested length is below minimum', () => {
    expect(() => generateTemporaryPassword(6)).toThrow(
      'Temporary passwords must be at least 8 characters long.',
    );
  });

  it('returns a password with the requested length', () => {
    const length = 24;
    const password = generateTemporaryPassword(length);
    expect(password).toHaveLength(length);
  });

  it('includes characters from all required classes', () => {
    const password = generateTemporaryPassword(20);
    expect(password).toMatch(UPPERCASE);
    expect(password).toMatch(LOWERCASE);
    expect(password).toMatch(DIGIT);
    expect(password).toMatch(SYMBOL);
  });

  it('produces non-deterministic results for successive calls', () => {
    const samples = Array.from({ length: 10 }, () =>
      generateTemporaryPassword(16),
    );
    const uniqueValues = new Set(samples);
    expect(uniqueValues.size).toBeGreaterThan(1);
  });
});
