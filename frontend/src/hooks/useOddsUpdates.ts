import { useEffect } from "react";
import { useEventsSocket } from "../context/SocketContext";

interface OddsUpdate {
  eventId: string;
  oddsA: number;
  oddsB: number;
}

interface StatusChange {
  eventId: string;
  status: string;
}

/**
 * Listens for real-time odds and status updates via Socket.IO.
 * Calls the provided callbacks when events are received.
 */
export function useOddsUpdates(
  onOddsUpdate?: (data: OddsUpdate) => void,
  onStatusChange?: (data: StatusChange) => void,
) {
  const socket = useEventsSocket();

  useEffect(() => {
    if (!socket) return;

    if (onOddsUpdate) {
      socket.on("odds_updated", onOddsUpdate);
    }
    if (onStatusChange) {
      socket.on("status_changed", onStatusChange);
    }

    return () => {
      if (onOddsUpdate) socket.off("odds_updated", onOddsUpdate);
      if (onStatusChange) socket.off("status_changed", onStatusChange);
    };
  }, [socket, onOddsUpdate, onStatusChange]);
}
