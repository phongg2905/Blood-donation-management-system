import { useContext } from 'react';
import { AuthContext } from '../context/auth-context';
import type { AuthContextValue } from '../context/auth-context';

/**
 * Access the current session.
 *
 * Throw when used outside `<AuthProvider>` so a missing provider is a loud
 * development error rather than a silently anonymous app.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth phải được dùng bên trong <AuthProvider>.');
  }
  return context;
}
