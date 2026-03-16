import { useState, useEffect } from "react";
import { submitFeedback, getMyFeedback } from "../api/feedback.api";
import type { FeedbackEntry } from "../api/feedback.api";

export function FeedbackPage() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [myFeedback, setMyFeedback] = useState<FeedbackEntry[]>([]);
  const [listLoading, setListLoading] = useState(true);

  useEffect(() => {
    getMyFeedback()
      .then(setMyFeedback)
      .finally(() => setListLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const entry = await submitFeedback(text.trim());
      setMyFeedback((prev) => [entry, ...prev]);
      setText("");
      setSuccess("Feedback submitted! Thank you.");
      setTimeout(() => setSuccess(""), 4000);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || "Failed to submit feedback");
      setTimeout(() => setError(""), 5000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">Feedback</h1>

      <div className="bg-gray-900 p-6 rounded-lg mb-6">
        <p className="text-gray-400 text-sm mb-4">
          Share your thoughts, report bugs, or suggest features. Max 500
          characters, 3 submissions per week.
        </p>
        <form onSubmit={handleSubmit}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 500))}
            placeholder="Your feedback..."
            rows={4}
            className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none resize-none text-sm"
          />
          <div className="flex items-center justify-between mt-2">
            <span
              className={`text-xs ${text.length >= 480 ? "text-yellow-400" : "text-gray-500"}`}
            >
              {text.length}/500
            </span>
            <button
              type="submit"
              disabled={loading || !text.trim()}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-1.5 rounded text-sm font-medium disabled:opacity-50"
            >
              {loading ? "Sending..." : "Submit"}
            </button>
          </div>
          {success && (
            <p className="text-green-400 text-xs mt-2">{success}</p>
          )}
          {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
        </form>
      </div>

      <h2 className="text-lg font-semibold mb-3">My Feedback</h2>
      {listLoading ? (
        <p className="text-gray-400">Loading...</p>
      ) : myFeedback.length === 0 ? (
        <p className="text-gray-400">No feedback submitted yet.</p>
      ) : (
        <div className="space-y-3">
          {myFeedback.map((entry) => (
            <div
              key={entry.id}
              className="bg-gray-900 rounded-lg p-4 border border-gray-800"
            >
              <p className="text-sm text-white whitespace-pre-wrap">
                {entry.text}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                {new Date(entry.createdAt).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
