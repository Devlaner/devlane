import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useInterfaceVersion } from '../contexts/InterfaceContext';
import { mapPathToV2 } from '../lib/interfaceRedirect';

/**
 * When the user's stored interface preference is 'v2', bounces v1 URLs to
 * their v2 equivalent (see lib/interfaceRedirect.ts for the path mapping and
 * why this is one-directional). Mounted once, high in the route tree, so it
 * runs on every navigation — including the target of RootRedirect's own
 * <Navigate>, which still resolves to a v1 path and gets remapped here.
 */
export function InterfaceGate() {
  const { interfaceVersion } = useInterfaceVersion();
  const location = useLocation();

  if (interfaceVersion === 'v2') {
    const target = mapPathToV2(location.pathname, location.search);
    if (target) {
      // Preserve router state: ProtectedRoute and friends attach `{ from:
      // location }` to their own <Navigate to="/login">, and losing it here
      // would drop the post-login return path for any route that redirects
      // to a v1 static this gate then remaps to v2.
      return <Navigate to={target} state={location.state} replace />;
    }
  }

  return <Outlet />;
}
