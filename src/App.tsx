import { useEffect, useRef, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router";
import { Loader } from "./components/Loader";
import { Shell } from "./components/Shell";
import { useSession } from "./context/SessionContext";
import { LoginPage } from "./pages/LoginPage";
import { ProductsPage } from "./pages/ProductsPage";
import { ServerPage } from "./pages/ServerPage";
import { SummaryPage } from "./pages/SummaryPage";
import { TrustPage } from "./pages/TrustPage";

/** Pages that need a chosen server. */
function RequireServer({ children }: { children: ReactNode }) {
  const { serverUrl, restoring } = useSession();
  if (restoring) return <Loader label="Restoring your session…" />;
  return serverUrl ? children : <Navigate to="/" replace />;
}

/** Pages that need a logged in user. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { serverUrl, token, restoring } = useSession();
  if (restoring) return <Loader label="Restoring your session…" />;
  if (!serverUrl) return <Navigate to="/" replace />;
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { restoring, token } = useSession();

  // if the app was started with a stored session, skip straight to the product selection
  const startedWithSession = useRef(restoring);
  useEffect(() => {
    if (restoring || !startedWithSession.current) return;
    startedWithSession.current = false;
    if (token && location.pathname === "/") navigate("/products", { replace: true });
  }, [restoring, token, location.pathname, navigate]);

  return (
    <Shell>
      {/* the explicit location lets the page keep rendering while it animates out */}
      <Routes location={location}>
        <Route path="/" element={<ServerPage />} />
        <Route
          path="/trust"
          element={
            <RequireServer>
              <TrustPage />
            </RequireServer>
          }
        />
        <Route
          path="/login"
          element={
            <RequireServer>
              <LoginPage />
            </RequireServer>
          }
        />
        <Route
          path="/products"
          element={
            <RequireAuth>
              <ProductsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/summary"
          element={
            <RequireAuth>
              <SummaryPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
