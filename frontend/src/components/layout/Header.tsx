import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthContext } from "../../context/AuthContext";

export function Header() {
  const { user, logout } = useAuthContext();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const closeMenu = () => setMenuOpen(false);

  const navLinks = (
    <>
      <Link to="/" className="hover:text-purple-300" onClick={closeMenu}>
        Events
      </Link>
      <Link to="/challenges" className="hover:text-purple-300" onClick={closeMenu}>
        Challenges
      </Link>
      <Link to="/leaderboard" className="hover:text-purple-300" onClick={closeMenu}>
        Leaderboard
      </Link>
      <Link to="/bets" className="hover:text-purple-300" onClick={closeMenu}>
        My Bets
      </Link>
      <Link to="/feedback" className="hover:text-purple-300" onClick={closeMenu}>
        Feedback
      </Link>
      <Link to="/faq" className="hover:text-purple-300" onClick={closeMenu}>
        FAQ
      </Link>
      {user?.role === "ADMIN" && (
        <Link to="/admin" className="hover:text-purple-300" onClick={closeMenu}>
          Admin
        </Link>
      )}
    </>
  );

  return (
    <header className="bg-gray-900 text-white px-4 py-3 sm:px-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link
            to="/"
            className="text-xl font-bold text-purple-400 hover:text-purple-300"
          >
            PixelBucks
          </Link>
          <a
            href="https://github.com/maklestiguan/pixelbucks"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-white"
            title="GitHub"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
          </a>
          <nav className="hidden md:flex gap-4 text-sm">{navLinks}</nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link to="/profile" className="hidden sm:inline hover:text-purple-300">
            {user?.username}
          </Link>
          <span className="bg-purple-600 px-3 py-1 rounded-full font-mono font-bold text-xs sm:text-sm">
            {user?.balance} PB
          </span>
          <button
            onClick={handleLogout}
            className="hidden sm:inline text-gray-400 hover:text-white text-sm"
          >
            Logout
          </button>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-1 text-gray-400 hover:text-white"
            aria-label="Toggle menu"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {menuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden mt-3 pt-3 border-t border-gray-800">
          <nav className="flex flex-col gap-3 text-sm">{navLinks}</nav>
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-800 text-sm">
            <Link to="/profile" className="hover:text-purple-300" onClick={closeMenu}>
              {user?.username}
            </Link>
            <button
              onClick={() => {
                closeMenu();
                handleLogout();
              }}
              className="text-gray-400 hover:text-white"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
