import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './AppRoutes';

/** Application router. Tests mount `AppRoutes` in a `MemoryRouter` instead. */
export function AppRouter() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
