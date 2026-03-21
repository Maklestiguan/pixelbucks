import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ToastProvider } from "./components/Toast";
import { Layout } from "./components/layout/Layout";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { EventsPage } from "./pages/EventsPage";
import { MyBetsPage } from "./pages/MyBetsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { ChallengesPage } from "./pages/ChallengesPage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { FeedbackPage } from "./pages/FeedbackPage";
import { FaqPage } from "./pages/FaqPage";
import { AdminPage } from "./pages/AdminPage";
import { EventDetailPage } from "./pages/EventDetailPage";

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <SocketProvider>
          <ToastProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route element={<Layout />}>
                <Route path="/" element={<EventsPage />} />
                <Route path="/events/:id" element={<EventDetailPage />} />
                <Route path="/bets" element={<MyBetsPage />} />
                <Route path="/challenges" element={<ChallengesPage />} />
                <Route path="/leaderboard" element={<LeaderboardPage />} />
                <Route path="/feedback" element={<FeedbackPage />} />
                <Route path="/faq" element={<FaqPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/admin" element={<AdminPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ToastProvider>
          </SocketProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
