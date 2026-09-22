import { Navigate, Route, Routes } from 'react-router-dom';
import { PageLoader } from '@/components/common/PageLoader';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { PermissionGuard } from '@/features/auth/guards/PermissionGuard';
import { ProtectedRoute } from '@/features/auth/guards/ProtectedRoute';
import { ForbiddenPage } from '@/features/auth/pages/ForbiddenPage';
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPasswordPage';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { NotFoundPage } from '@/features/auth/pages/NotFoundPage';
import { RegisterPage } from '@/features/auth/pages/RegisterPage';
import { ResetPasswordPage } from '@/features/auth/pages/ResetPasswordPage';
import { AUTH_ROUTES, resolveLandingPath } from '@/features/auth/routing';
import { ProfilePage } from '@/features/profile/pages/ProfilePage';
import { RoleLayout } from '@/layouts/RoleLayout';
import { SystemStatusPage } from '../pages/SystemStatusPage';

/** `/` sends signed-in users to their landing page, everyone else to login. */
function HomeRedirect() {
  const { status, currentUser } = useAuth();
  if (status === 'loading') return <PageLoader />;
  return (
    <Navigate
      to={
        status === 'authenticated'
          ? resolveLandingPath(currentUser)
          : AUTH_ROUTES.login
      }
      replace
    />
  );
}

/**
 * Route table.
 *
 * Kept separate from the `BrowserRouter` so tests can mount it inside a
 * `MemoryRouter` at any path.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path={AUTH_ROUTES.systemStatus} element={<SystemStatusPage />} />

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
