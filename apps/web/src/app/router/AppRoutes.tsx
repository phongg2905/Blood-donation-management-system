import { Route, Routes } from 'react-router-dom';
import { PermissionGuard } from '@/features/auth/guards/PermissionGuard';
import { ProtectedRoute } from '@/features/auth/guards/ProtectedRoute';
import { ForbiddenPage } from '@/features/auth/pages/ForbiddenPage';
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPasswordPage';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { NotFoundPage } from '@/features/auth/pages/NotFoundPage';
import { RegisterPage } from '@/features/auth/pages/RegisterPage';
import { ResetPasswordPage } from '@/features/auth/pages/ResetPasswordPage';
import { AUTH_ROUTES } from '@/features/auth/routing';
import { ProfilePage } from '@/features/profile/pages/ProfilePage';
import { RoleLayout } from '@/layouts/RoleLayout';
import { HomePage } from '../pages/HomePage';
import {
  CampaignListPage,
  CampaignDetailPage,
  CampaignCreatePage,
  CampaignEditPage,
} from '@/features/campaigns/CampaignPages';
import { TimeSlotPage } from '@/features/campaigns/TimeSlotPage';
import { CampaignStaffPage } from '@/features/campaigns/CampaignStaffPage';

/**
 * Route table.
 *
 * Kept separate from the `BrowserRouter` so tests can mount it inside a
 * `MemoryRouter` at any path.
 */
export function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path={AUTH_ROUTES.login} element={<LoginPage />} />
      <Route path={AUTH_ROUTES.register} element={<RegisterPage />} />
      <Route
        path={AUTH_ROUTES.forgotPassword}
        element={<ForgotPasswordPage />}
      />
      <Route path={AUTH_ROUTES.resetPassword} element={<ResetPasswordPage />} />
      <Route path={AUTH_ROUTES.forbidden} element={<ForbiddenPage />} />

      {/*
        Authenticated area.
        Authentication (ProtectedRoute) and authorization (PermissionGuard) are
        deliberately separate layers.
      */}
      <Route element={<ProtectedRoute />}>
        <Route element={<RoleLayout />}>
          <Route path={AUTH_ROUTES.home} element={<HomePage />} />
          <Route
            element={<PermissionGuard requiredPermission="campaign.read" />}
          >
            <Route path="/campaigns" element={<CampaignListPage />} />
            <Route
              path="/campaigns/:campaignId"
              element={<CampaignDetailPage />}
            />
            <Route
              path="/campaigns/new"
              element={
                <PermissionGuard requiredPermission="campaign.create">
                  <CampaignCreatePage />
                </PermissionGuard>
              }
            />
            <Route
              path="/campaigns/:campaignId/edit"
              element={
                <PermissionGuard requiredPermission="campaign.update">
                  <CampaignEditPage />
                </PermissionGuard>
              }
            />
            <Route
              path="/campaigns/:campaignId/timeslots"
              element={
                <PermissionGuard requiredPermission="timeslot.read">
                  <TimeSlotPage />
                </PermissionGuard>
              }
            />
            <Route
              path="/campaigns/:campaignId/staff"
              element={
                <PermissionGuard requiredPermission="campaign_staff.read">
                  <CampaignStaffPage />
                </PermissionGuard>
              }
            />
          </Route>
          <Route
            path="/profile"
            element={
              <PermissionGuard requiredPermission="auth.profile.read">
                <ProfilePage />
              </PermissionGuard>
            }
          />
        </Route>
      </Route>

      {/* Unknown route */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
