const crypto = require('crypto');
const { hashPassword } = require('./auth');

const password = process.argv[2] || process.env.ADMIN_PASSWORD;

if (!password) {
    console.error('Usage: node backend/generate_admin_hash.js "mot_de_passe"');
    process.exit(1);
}

const salt = crypto.randomBytes(16).toString('hex');
const hash = hashPassword(password, salt);
console.log(hash);
