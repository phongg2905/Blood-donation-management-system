import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { appConfig } from './config/app.config';
import { apiRoutes } from './routes';
import { authenticate } from './middlewares/auth.middleware';
import { errorHandler, notFound } from './middlewares/error.middleware';

export const app = express();
app.disable('x-powered-by');
// credentials: true is required for the bd_refresh_token cookie to be sent
// cross-origin; origin must stay a specific value (never '*') when it is.
app.use(cors({ origin: appConfig.corsOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(authenticate);
app.use(appConfig.apiPrefix, apiRoutes);
app.use(notFound);
app.use(errorHandler);
