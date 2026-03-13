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
