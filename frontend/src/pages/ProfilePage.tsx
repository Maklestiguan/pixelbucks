import { useAuthContext } from "../context/AuthContext";

export function ProfilePage() {
  const { user } = useAuthContext();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Profile</h1>
      {user && (
        <div className="bg-gray-900 p-6 rounded-lg max-w-md">
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Username</span>
              <span>{user.username}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Balance</span>
              <span className="text-purple-400 font-mono">
                {user.balance} PB
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Role</span>
              <span>{user.role}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Stats visibility</span>
              <span>{user.statsPublic ? "Public" : "Private"}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
