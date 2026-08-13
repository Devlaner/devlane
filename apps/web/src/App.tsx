import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { FavoritesProvider } from './contexts/FavoritesContext';
import { InterfaceProvider } from './contexts/InterfaceContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { router } from './routes';

export default function App() {
  return (
    <ThemeProvider>
      <InterfaceProvider>
        <AuthProvider>
          <FavoritesProvider>
            <RouterProvider router={router} />
          </FavoritesProvider>
        </AuthProvider>
      </InterfaceProvider>
    </ThemeProvider>
  );
}
