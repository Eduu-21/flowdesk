// Runs before every test file. Values from the real .env (DATABASE_URL) are loaded
// by src/config.ts; we only add safe defaults here.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ||= 'test-secret-that-is-long-enough-1234567890';
process.env.EMAIL_API_KEY = '';
process.env.ANTHROPIC_API_KEY = '';
