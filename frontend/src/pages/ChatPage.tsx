import { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useAuthContext } from "../context/AuthContext";

interface ChatMessage {
  id: string;
  content: string;
  room: string;
  createdAt: string;
  user: { id: string; username: string };
}

const ROOMS = [
  { key: "en", label: "English" },
  { key: "ru", label: "Russian" },
];

const MAX_LENGTH = 120;

const IMAGE_URL_RE = /https?:\/\/\S+\.(?:jpg|jpeg|png|gif|webp)(?:\?\S*)?/gi;
const URL_RE = /https?:\/\/\S+/g;

function renderContent(content: string) {
  const imageUrls = content.match(IMAGE_URL_RE) || [];
  const parts: React.ReactNode[] = [];

  if (imageUrls.length > 0) {
    let remaining = content;
    let keyIdx = 0;
    for (const url of imageUrls) {
      const idx = remaining.indexOf(url);
      if (idx > 0) {
        parts.push(renderTextWithLinks(remaining.slice(0, idx), keyIdx));
        keyIdx++;
      }
      parts.push(
        <img
          key={`img-${keyIdx}`}
          src={url}
          alt=""
          className="inline-block w-8 h-8 object-cover rounded align-middle mx-0.5"
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />,
      );
      keyIdx++;
      remaining = remaining.slice(idx + url.length);
    }
    if (remaining) {
      parts.push(renderTextWithLinks(remaining, keyIdx));
    }
    return <>{parts}</>;
  }

  return renderTextWithLinks(content, 0);
}

function renderTextWithLinks(text: string, baseKey: number) {
  const urls = text.match(URL_RE);
  if (!urls) return <span key={`t-${baseKey}`}>{text}</span>;

  const parts: React.ReactNode[] = [];
  let remaining = text;
  let keyIdx = 0;
  for (const url of urls) {
    const idx = remaining.indexOf(url);
    if (idx > 0) {
      parts.push(
        <span key={`s-${baseKey}-${keyIdx}`}>{remaining.slice(0, idx)}</span>,
      );
      keyIdx++;
    }
    parts.push(
      <a
        key={`a-${baseKey}-${keyIdx}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-purple-400 hover:text-purple-300 underline"
      >
        {url.length > 40 ? url.slice(0, 37) + "..." : url}
      </a>,
    );
    keyIdx++;
    remaining = remaining.slice(idx + url.length);
  }
  if (remaining) {
    parts.push(<span key={`s-${baseKey}-${keyIdx}`}>{remaining}</span>);
  }
  return <>{parts}</>;
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ChatPage() {
  const { token, user } = useAuthContext();
  const [room, setRoom] = useState("en");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!token) return;

    const socket = io("/", {
      auth: { token },
      transports: ["websocket"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit(
        "join_room",
        { room },
        (res: { history?: ChatMessage[]; error?: string }) => {
          if (res.history) {
            setMessages(res.history);
          }
          if (res.error) {
            setError(res.error);
          }
        },
      );
    });

    socket.on("disconnect", () => setConnected(false));

    socket.on("new_message", (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on("error", (data: { message: string }) => {
      setError(data.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  // Re-join when room changes
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket?.connected) return;

    setMessages([]);
    socket.emit(
      "join_room",
      { room },
      (res: { history?: ChatMessage[]; error?: string }) => {
        if (res.history) {
          setMessages(res.history);
        }
      },
    );
  }, [room]);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = () => {
    const content = input.trim();
    if (!content || !socketRef.current) return;

    setError("");
    socketRef.current.emit(
      "send_message",
      { content },
      (res: { ok?: boolean; error?: string }) => {
        if (res.error) {
          setError(res.error);
        }
      },
    );
    setInput("");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-bold">Chat</h1>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-gray-900 rounded-lg p-1">
            {ROOMS.map((r) => (
              <button
                key={r.key}
                onClick={() => setRoom(r.key)}
                className={`px-3 py-1 rounded text-sm ${
                  room === r.key
                    ? "bg-purple-600 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <span
            className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`}
            title={connected ? "Connected" : "Disconnected"}
          />
        </div>
      </div>

      <div className="flex-1 bg-gray-900 rounded-lg p-4 overflow-y-auto mb-3">
        {messages.length === 0 ? (
          <p className="text-gray-500 text-center mt-8">
            No messages yet. Say something!
          </p>
        ) : (
          <div className="space-y-2">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 ${msg.user.id === user?.id ? "justify-end" : ""}`}
              >
                <div
                  className={`max-w-[75%] ${
                    msg.user.id === user?.id
                      ? "bg-purple-900/30 rounded-lg px-3 py-2"
                      : "bg-gray-800 rounded-lg px-3 py-2"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium text-purple-400">
                      {msg.user.username}
                    </span>
                    <span className="text-xs text-gray-600">
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>
                  <div className="text-sm break-words">
                    {renderContent(msg.content)}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-900/50 text-red-300 px-3 py-2 rounded text-sm mb-2">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, MAX_LENGTH))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={`Type a message... (${MAX_LENGTH - input.length} chars left)`}
          className="flex-1 bg-gray-800 text-white px-4 py-2 rounded border border-gray-700 focus:border-purple-500 focus:outline-none text-sm"
          maxLength={MAX_LENGTH}
          disabled={!connected}
        />
        <button
          onClick={handleSend}
          disabled={!connected || !input.trim()}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
