import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { io, Socket } from "socket.io-client";
import { useAuthContext } from "./AuthContext";

interface SocketContextType {
  eventsSocket: Socket | null;
}

const SocketContext = createContext<SocketContextType>({ eventsSocket: null });

export function SocketProvider({ children }: { children: ReactNode }) {
  const { token, updateBalance } = useAuthContext();
  const eventsSocketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token) {
      eventsSocketRef.current?.disconnect();
      eventsSocketRef.current = null;
      return;
    }

    const socket = io("/events", {
      auth: { token },
      transports: ["websocket"],
    });

    socket.on("balance_updated", (data: { balance: number }) => {
      updateBalance(data.balance);
    });

    eventsSocketRef.current = socket;

    return () => {
      socket.disconnect();
      eventsSocketRef.current = null;
    };
  }, [token, updateBalance]);

  return (
    <SocketContext.Provider value={{ eventsSocket: eventsSocketRef.current }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useEventsSocket() {
  return useContext(SocketContext).eventsSocket;
}
