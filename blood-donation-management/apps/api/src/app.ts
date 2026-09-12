import express from 'express';
import cors from 'cors';
import { appConfig } from './config/app.config';
import { apiRoutes } from './routes';
import { errorHandler, notFound } from './middlewares/error.middleware';

export const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: appConfig.corsOrigin }));
app.use(express.json({ limit: '1mb' }));
app.use(appConfig.apiPrefix, apiRoutes);
app.use(notFound);
app.use(errorHandler);
