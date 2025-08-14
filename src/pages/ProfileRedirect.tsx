import { useEffect } from "react";
import { Navigate } from "react-router-dom";

export default function ProfileRedirect() {
  useEffect(() => {
    // Replace current history entry to prevent back button issues
    window.history.replaceState(null, "", "/settings#profile");
  }, []);

  return <Navigate to="/settings#profile" replace />;
}