// Jest setup file: runs before test files are evaluated.
// Ensures crypto env vars exist so src/utils/fieldCrypto.js can initialize.

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

// Deterministic test keys (32 bytes each) in hex.
// Override by exporting env vars in CI/dev if desired.
process.env.DATA_ENCRYPTION_ACTIVE_KID = process.env.DATA_ENCRYPTION_ACTIVE_KID || 'v1';
process.env.DATA_ENCRYPTION_KEY_V1 = process.env.DATA_ENCRYPTION_KEY_V1 || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.DATA_ENCRYPTION_HMAC_KEY_V1 = process.env.DATA_ENCRYPTION_HMAC_KEY_V1 || 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
