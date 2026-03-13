import { Link, useNavigate } from "react-router-dom";
import { useAuthContext } from "../../context/AuthContext";

export function Header() {
  const { user, logout } = useAuthContext();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="bg-gray-900 text-white px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link
          to="/"
          className="text-xl font-bold text-purple-400 hover:text-purple-300"
        >
          PixelBucks
        </Link>
        <nav className="flex gap-4 text-sm">
          <Link to="/" className="hover:text-purple-300">
            Events
          </Link>
          <Link to="/bets" className="hover:text-purple-300">
            My Bets
          </Link>
          <Link to="/challenges" className="hover:text-purple-300">
            Challenges
          </Link>
          {user?.role === "ADMIN" && (
            <Link to="/admin" className="hover:text-purple-300">
              Admin
            </Link>
          )}
        </nav>
      </div>
      <div className="flex items-center gap-4 text-sm">
        <Link to="/profile" className="hover:text-purple-300">
          {user?.username}
        </Link>
        <span className="bg-purple-600 px-3 py-1 rounded-full font-mono font-bold">
          {user?.balance} PB
        </span>
        <button
          onClick={handleLogout}
          className="text-gray-400 hover:text-white text-sm"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
