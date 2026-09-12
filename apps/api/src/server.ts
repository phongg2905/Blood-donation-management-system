import { app } from './app';
import { appConfig } from './config/app.config';
import { database } from './config/database';

const server = app.listen(appConfig.port, () => {
  console.info(
    `Blood Donation API: http://localhost:${appConfig.port}/api/health`,
  );
});
server.on('error', (error) => {
  console.error('API failed to start', error);
  process.exit(1);
});
let shuttingDown = false;
const shutdown = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  const timeout = setTimeout(() => process.exit(1), 10_000);
  timeout.unref();
  server.close(() => {
    void database
      .$disconnect()
      .then(() => {
        clearTimeout(timeout);
        process.exit(0);
      })
      .catch((error: unknown) => {
        console.error(error);
        process.exit(1);
      });
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
