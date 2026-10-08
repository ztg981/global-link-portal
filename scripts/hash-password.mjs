// Prints scrypt hashes for ADMIN_PASSWORD_HASH (comma-separate several).
//   node scripts/hash-password.mjs "first password" "second password"
import { hashPassword } from '../api/_lib/auth.js';
const pws = process.argv.slice(2);
if (!pws.length) { console.error('usage: node scripts/hash-password.mjs <password> [more...]'); process.exit(1); }
console.log((await Promise.all(pws.map(hashPassword))).join(','));
