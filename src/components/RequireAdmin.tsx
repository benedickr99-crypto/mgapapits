import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function RequireAdmin({
  children,
}: {
  children: JSX.Element;
}) {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-500">
        Loading admin panel...
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}