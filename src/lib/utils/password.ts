/**
 * Generate a secure random password.
 *
 * Used by admin user-create and user-edit flows to produce SIP passwords
 * that meet FusionPBX's strength requirements (one of each: uppercase,
 * lowercase, digit, special character).
 *
 * Excludes ambiguous characters (I, l, 1, O, 0) so admins can read out
 * loud without confusion when supporting end users.
 */
export function generateSecurePassword(length: number = 16): string {
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowercase = 'abcdefghjkmnpqrstuvwxyz';
  const numbers = '23456789';
  const special = '!@#$%&*';

  // Guarantee at least one character of each class.
  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  const allChars = uppercase + lowercase + numbers + special;
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle so the leading characters aren't predictable.
  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}
