import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function RequireGuide({
  children,
}: {
  children: JSX.Element;
}) {
  const { user, loading, isGuide } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-500 font-medium">
        Loading guide panel...
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!isGuide) {
    return <Navigate to="/" replace />;
  }

  return children;
}
