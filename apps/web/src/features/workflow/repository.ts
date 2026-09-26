import { createContext, useContext } from 'react';
import { ApiRequestError } from '@/services/api';
import type { WorkflowRepository } from './types';

/**
 * The backend has not published HTTP contracts for registration, check-in,
 * screening, blood bags, certificates or donor history yet. Every method throws
 * a 503-shaped error until real endpoints exist — only the mock implementation
 * responds. This keeps the UI honest: in a non-development build these screens
 * show a "chưa được hỗ trợ" state instead of fabricated results.
 */
const unavailable = (): never => {
  throw new ApiRequestError('ROUTE_NOT_FOUND', '', 503);
};

const apiWorkflowRepository: WorkflowRepository = {
  availability: unavailable,
  register: unavailable,
  myRegistrations: unavailable,
  findRegistrations: unavailable,
  checkIn: unavailable,
  screeningQueue: unavailable,
  screeningFor: unavailable,
  saveMeasurements: unavailable,
  reviewScreening: unavailable,
  eligibleForBag: unavailable,
  bloodBags: unavailable,
  createBloodBag: unavailable,
  certificates: unavailable,
  certificate: unavailable,
  history: unavailable,
};

/** Mock is the default in development; set VITE_USE_MOCK_WORKFLOW=false to disable. */
export const mockWorkflowEnabled =
  import.meta.env.DEV && import.meta.env.VITE_USE_MOCK_WORKFLOW !== 'false';

let instance: WorkflowRepository = apiWorkflowRepository;
if (mockWorkflowEnabled) {
  const { MockWorkflowRepository } = await import('./mock-repository');
  instance = new MockWorkflowRepository({
    latency: Number(import.meta.env.VITE_WORKFLOW_MOCK_LATENCY) || 250,
  });
}

export const WorkflowRepositoryContext =
  createContext<WorkflowRepository | null>(null);

export const useWorkflowRepository = (): WorkflowRepository =>
  useContext(WorkflowRepositoryContext) ?? instance;
