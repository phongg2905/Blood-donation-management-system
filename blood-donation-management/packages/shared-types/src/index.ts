export interface ApiErrorDetail {
  path?: string;
  message: string;
}
export interface ApiSuccess<T> {
  success: true;
  message: string;
  data: T;
}
export interface ApiFailure {
  success: false;
  message: string;
  errors: ApiErrorDetail[];
}
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
export type DatabaseStatus = 'connected' | 'disconnected';
export type HealthResponse = ApiResponse<{ database: DatabaseStatus }> & {
  database: DatabaseStatus;
};
export const ROLE_CODES = [
  'DONOR',
  'SCREENING_STAFF',
  'DOCTOR',
  'RECEPTION_STAFF',
  'BLOOD_COLLECTION_STAFF',
  'COORDINATOR',
  'ADMIN',
] as const;
export type RoleCode = (typeof ROLE_CODES)[number];
