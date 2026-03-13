import { Outlet, Navigate } from "react-router-dom";
import { useAuthContext } from "../../context/AuthContext";
import { Header } from "./Header";
import { ChatWidget } from "../ChatWidget";

export function Layout() {
  const { isAuthenticated, isLoading } = useAuthContext();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Header />
      <main className="max-w-6xl mx-auto px-6 py-6">
        <Outlet />
      </main>
      <ChatWidget />
    </div>
  );
}
