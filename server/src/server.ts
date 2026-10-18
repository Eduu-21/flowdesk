import { assertConfig, config } from './config';
import { pool } from './db/pool';
import { createApp } from './app';
import { generateReminders } from './services/notifications';

async function main() {
  assertConfig();

  try {
    await pool.query('SELECT 1');
  } catch (err) {
    console.error(
      `\nCould not connect to PostgreSQL: ${(err as Error).message}\n` +
        'Check DATABASE_URL in your .env file and make sure PostgreSQL is running.\n' +
        'Then run: npm run db:setup\n',
    );
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`FlowDesk API listening on http://localhost:${config.port}`);
    if (!config.emailApiKey) console.log('Email: development mode (messages are printed here, not sent).');
    console.log(
      config.anthropicApiKey
        ? 'Flow Assistant: using the Claude API.'
        : 'Flow Assistant: using built-in database answers.',
    );
  });

  // Appointment reminders: check every five minutes.
  const timer = setInterval(() => {
    generateReminders().catch((err) => console.error('Reminder job failed:', err.message));
  }, 5 * 60 * 1000);
  timer.unref();

  const shutdown = () => {
    clearInterval(timer);
    server.close(() => pool.end().finally(() => process.exit(0)));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main();
