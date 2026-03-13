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
  { key: "en", label: "EN" },
  { key: "ru", label: "RU" },
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

export function ChatWidget() {
  const { token, user } = useAuthContext();
  const [open, setOpen] = useState(false);
  const [room, setRoom] = useState("en");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [unread, setUnread] = useState(0);
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

  // Track unread when panel is closed
  useEffect(() => {
    if (!open && messages.length > 0) {
      const handler = () => setUnread((prev) => prev + 1);
      const socket = socketRef.current;
      if (socket) {
        socket.on("new_message", handler);
        return () => {
          socket.off("new_message", handler);
        };
      }
    }
  }, [open, messages.length]);

  // Clear unread on open
  useEffect(() => {
    if (open) setUnread(0);
  }, [open]);

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
    if (open) scrollToBottom();
  }, [messages, scrollToBottom, open]);

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
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="fixed bottom-6 right-6 z-50 bg-purple-600 hover:bg-purple-700 text-white w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105"
        title={open ? "Close chat" : "Open chat"}
      >
        {open ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        )}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Chat panel */}
      <div
        className={`fixed bottom-20 right-6 z-40 w-80 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl flex flex-col transition-all duration-200 ${
          open
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 translate-y-4 pointer-events-none"
        }`}
        style={{ height: "28rem" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">Chat</span>
            <span
              className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`}
              title={connected ? "Connected" : "Disconnected"}
            />
          </div>
          <div className="flex gap-1 bg-gray-800 rounded p-0.5">
            {ROOMS.map((r) => (
              <button
                key={r.key}
                onClick={() => setRoom(r.key)}
                className={`px-2 py-0.5 rounded text-xs ${
                  room === r.key
                    ? "bg-purple-600 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {messages.length === 0 ? (
            <p className="text-gray-500 text-center text-xs mt-8">
              No messages yet. Say something!
            </p>
          ) : (
            <div className="space-y-1.5">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-1.5 ${msg.user.id === user?.id ? "justify-end" : ""}`}
                >
                  <div
                    className={`max-w-[85%] ${
                      msg.user.id === user?.id
                        ? "bg-purple-900/30 rounded-lg px-2.5 py-1.5"
                        : "bg-gray-800 rounded-lg px-2.5 py-1.5"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] font-medium text-purple-400">
                        {msg.user.username}
                      </span>
                      <span className="text-[10px] text-gray-600">
                        {formatTime(msg.createdAt)}
                      </span>
                    </div>
                    <div className="text-xs break-words">
                      {renderContent(msg.content)}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-3 mb-1 bg-red-900/50 text-red-300 px-2 py-1 rounded text-xs">
            {error}
          </div>
        )}

        {/* Input */}
        <div className="flex gap-1.5 p-2 border-t border-gray-700">
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
            placeholder={`Message... (${MAX_LENGTH - input.length})`}
            className="flex-1 bg-gray-800 text-white px-3 py-1.5 rounded border border-gray-700 focus:border-purple-500 focus:outline-none text-xs"
            maxLength={MAX_LENGTH}
            disabled={!connected}
          />
          <button
            onClick={handleSend}
            disabled={!connected || !input.trim()}
            className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </>
  );
}
