import { useState, useEffect } from "react";
import { getActiveChallenges } from "../api/challenges.api";
import type { UserChallengeView } from "../types";

function formatBalance(cents: number) {
  return (cents / 100).toFixed(2);
}

function timeUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  return `${hours}h ${mins}m`;
}

function ChallengeCard({ challenge }: { challenge: UserChallengeView }) {
  const progress = Math.min(challenge.progress, challenge.criteria.count);
  const percent = (progress / challenge.criteria.count) * 100;
  const isCompleted = challenge.status === "COMPLETED";
  const isExpired = challenge.status === "EXPIRED";

  return (
    <div
      className={`bg-gray-900 rounded-lg p-4 border ${
        isCompleted
          ? "border-green-800/50"
          : isExpired
            ? "border-gray-800 opacity-60"
            : "border-gray-800"
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-2 py-0.5 rounded font-medium ${
                challenge.type === "DAILY"
                  ? "bg-blue-900/50 text-blue-300"
                  : "bg-purple-900/50 text-purple-300"
              }`}
            >
              {challenge.type}
            </span>
            <h3 className="font-medium text-white">{challenge.title}</h3>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            {challenge.description}
          </p>
        </div>
        <div className="text-right shrink-0 ml-4">
          <div className="text-sm font-mono text-yellow-400">
            +{formatBalance(challenge.reward)} PB
          </div>
          {!isCompleted && !isExpired && (
            <div className="text-xs text-gray-500 mt-0.5">
              {timeUntil(challenge.expiresAt)}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-400">
            {progress} / {challenge.criteria.count}
          </span>
          {isCompleted && (
            <span className="text-green-400 font-medium">Completed</span>
          )}
          {isExpired && (
            <span className="text-gray-500 font-medium">Expired</span>
          )}
        </div>
        <div className="w-full bg-gray-800 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              isCompleted
                ? "bg-green-500"
                : isExpired
                  ? "bg-gray-600"
                  : "bg-purple-500"
            }`}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function ChallengesPage() {
  const [challenges, setChallenges] = useState<UserChallengeView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getActiveChallenges()
      .then(setChallenges)
      .finally(() => setLoading(false));
  }, []);

  const daily = challenges.filter((c) => c.type === "DAILY");
  const weekly = challenges.filter((c) => c.type === "WEEKLY");

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">Challenges</h1>

      {loading ? (
        <p className="text-gray-400">Loading challenges...</p>
      ) : challenges.length === 0 ? (
        <p className="text-gray-400">
          No active challenges right now. Check back soon!
        </p>
      ) : (
        <div className="space-y-6">
          {daily.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-blue-300 mb-3">
                Daily Challenges
              </h2>
              <div className="space-y-3">
                {daily.map((c) => (
                  <ChallengeCard key={c.id} challenge={c} />
                ))}
              </div>
            </div>
          )}
          {weekly.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-purple-300 mb-3">
                Weekly Challenges
              </h2>
              <div className="space-y-3">
                {weekly.map((c) => (
                  <ChallengeCard key={c.id} challenge={c} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
