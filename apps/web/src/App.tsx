import { AppProviders } from '@/app/providers/AppProviders';
import { AppRouter } from '@/app/router/AppRouter';

/**
 * Application root: providers wrap the router.
 *
 * The health-check screen that used to live here is now the routed
 * `/system-status` page (`app/pages/SystemStatusPage.tsx`).
 */
export default function App() {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  );
}
