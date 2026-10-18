import cors from 'cors';
import express from 'express';
import fs from 'fs';
import helmet from 'helmet';
import path from 'path';
import { config, isProduction } from './config';
import { errorHandler, notFoundHandler } from './middleware/error';
import { api } from './routes';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(
    cors({
      origin: [config.clientUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true,
    }),
  );
  // Avatars arrive as small data URLs, so allow a slightly larger body than the default.
  app.use(express.json({ limit: '600kb' }));

  app.use('/api', api);
  app.use('/api', notFoundHandler);

  // In production the API can also serve the built React app (client/dist).
  const clientDist = path.resolve(__dirname, '../../client/dist');
  if (isProduction && fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
