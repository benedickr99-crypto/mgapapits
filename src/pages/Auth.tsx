import { Navigate } from "react-router-dom";

// Redirect /auth to /login
export default function Auth() {
  return <Navigate to="/login" replace />;
}
