import path from 'path';
import dotenv from 'dotenv';

// The single .env file lives in the project root (flowdesk/.env)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const env = process.env;

export const config = {
  nodeEnv: env.NODE_ENV ?? 'development',
  port: Number(env.PORT) || 4000,
  databaseUrl: env.DATABASE_URL ?? '',
  jwtSecret: env.JWT_SECRET ?? '',
  jwtExpiresIn: env.JWT_EXPIRES_IN || '1d',
  jwtRememberExpiresIn: env.JWT_REMEMBER_EXPIRES_IN || '30d',
  clientUrl: (env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, ''),
  emailApiKey: env.EMAIL_API_KEY ?? '',
  emailFrom: env.EMAIL_FROM || 'FlowDesk <onboarding@resend.dev>',
  anthropicApiKey: env.ANTHROPIC_API_KEY ?? '',
  anthropicModel: env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
};

export const isProduction = config.nodeEnv === 'production';
export const isTest = config.nodeEnv === 'test';

/** Fails fast with a friendly message when required variables are missing. */
export function assertConfig(): void {
  const problems: string[] = [];
  if (!config.databaseUrl) problems.push('DATABASE_URL is not set.');
  if (!config.jwtSecret) problems.push('JWT_SECRET is not set.');
  else if (config.jwtSecret.length < 16) problems.push('JWT_SECRET must be at least 16 characters.');
  if (problems.length) {
    throw new Error(
      `\nFlowDesk cannot start:\n - ${problems.join('\n - ')}\n` +
        'Copy .env.example to .env in the project root and fill in the values.\n',
    );
  }
}
