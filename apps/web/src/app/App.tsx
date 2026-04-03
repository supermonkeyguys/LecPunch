import { AppProviders } from './providers/AppProviders';
import { AppRouter } from './router/AppRouter';

export const App = () => {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  );
};
