import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function ProtectedRoute({ children, engineerOnly = false }) {
  const { session, loading, isEngineer } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-400">
        Memuat...
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (engineerOnly && !isEngineer) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
