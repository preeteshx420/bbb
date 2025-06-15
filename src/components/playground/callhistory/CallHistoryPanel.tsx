import React, { useEffect, useState } from 'react';
import { CallSessionItem, CallSession } from './CallSessionItem';

// Expected structure from LiveKit Analytics API (simplified)
// Based on: https://docs.livekit.io/home/cloud/analytics-api/#list-sessions
// And: https://docs.livekit.io/home/cloud/analytics-api/#list-session-details
// And EgressInfo: https://github.com/livekit/protocol/blob/main/protobufs/livekit_egress.proto
interface LivekitEgressInfo {
  egress_id: string;
  room_id: string;
  room_name: string;
  status: string; // e.g., EGRESS_STARTING, EGRESS_ACTIVE, EGRESS_ENDING, EGRESS_COMPLETE, EGRESS_FAILED, EGRESS_ABORTED, EGRESS_LIMIT_REACHED
  started_at?: number; // Unix timestamp (seconds)
  ended_at?: number; // Unix timestamp (seconds)
  error?: string;
  // ... other Egress fields if needed, like file_results, stream_results
}

export interface LivekitSession {
  session_id: string; // from list sessions
  name: string; // roomName, from list sessions it's `roomName`, from details it's `roomName`
  created_at: number; // timestamp (seconds), from list sessions it's `createdAt`
  last_active?: number; // timestamp (seconds)
  start_time?: number; // from session details, it's `startTime` (unix timestamp)
  end_time?: number; // from session details, it's `endTime` (unix timestamp)
  duration?: number; // in seconds, from session details (calculated or directly if available)
  num_participants?: number;
  num_active_participants?: number;
  // `egress` field from list sessions: 0 = never started, 1 = active, 2 = ended
  // This is a simple indicator. For detailed status, one might need to fetch EgressInfo separately
  // or the backend might already join this information.
  // For now, we'll assume the backend might provide a simplified `recording_status` or `egress_info` object.
  egress_info?: LivekitEgressInfo[]; // Assuming backend might provide this array if Egress was used
  // Or a simplified status from the backend if it processes this:
  // recording_status_from_backend?: 'available' | 'processing' | 'none' | 'failed';
}

// Helper to calculate duration in a readable format (e.g., "10m", "1h 5m")
const formatDuration = (startIso: string, endIso: string | undefined): string => {
  if (!endIso) return 'Ongoing';
  const startDate = new Date(startIso);
  const endDate = new Date(endIso);
  let diffMs = endDate.getTime() - startDate.getTime();

  if (diffMs <= 0) return '0m';

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  diffMs -= hours * (1000 * 60 * 60);
  const minutes = Math.floor(diffMs / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

// Helper to derive recording status
// This is a simplified example. Real logic might be more complex.
const deriveRecordingStatus = (session: LivekitSession): CallSession['recordingStatus'] => {
  if (session.egress_info && session.egress_info.length > 0) {
    // Consider the latest egress attempt if multiple
    const latestEgress = session.egress_info[session.egress_info.length - 1];
    switch (latestEgress.status) {
      case 'EGRESS_COMPLETE':
        return 'available';
      case 'EGRESS_STARTING':
      case 'EGRESS_ACTIVE':
      case 'EGRESS_ENDING':
        return 'processing';
      case 'EGRESS_FAILED':
      case 'EGRESS_ABORTED':
      case 'EGRESS_LIMIT_REACHED':
        return 'failed';
      default:
        return 'none';
    }
  }
  return 'none';
};


export const CallHistoryPanel: React.FC = () => {
  const [sessions, setSessions] = useState<CallSession[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchSessions = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/livekit/sessions');
        if (!response.ok) {
          throw new Error(`Failed to fetch sessions: ${response.status} ${response.statusText}`);
        }
        const data: LivekitSession[] = await response.json();

        // Process data into the CallSession format expected by CallSessionItem
        const processedSessions: CallSession[] = data.map((session) => {
          const startTimeIso = session.start_time ? new Date(session.start_time * 1000).toISOString() : new Date(session.created_at * 1000).toISOString();
          const endTimeIso = session.end_time ? new Date(session.end_time * 1000).toISOString() : undefined;

          return {
            id: session.session_id,
            roomName: session.name,
            startTime: startTimeIso,
            endTime: endTimeIso || new Date().toISOString(), // Use current time if no end_time (ongoing)
            duration: formatDuration(startTimeIso, endTimeIso),
            participantCount: session.num_participants || 0,
            recordingStatus: deriveRecordingStatus(session),
          };
        });
        setSessions(processedSessions);
      } catch (e) {
        if (e instanceof Error) {
          setError(e);
        } else {
          setError(new Error('An unknown error occurred'));
        }
        console.error('Error fetching call history:', e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSessions();
  }, []);

  if (isLoading) {
    return (
      <div className="p-6 bg-neutral-900 rounded-lg shadow-xl h-full flex items-center justify-center">
        <p className="text-gray-300 text-lg">Loading call history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-neutral-900 rounded-lg shadow-xl h-full flex flex-col items-center justify-center">
        <p className="text-red-400 text-lg mb-2">Failed to load call history</p>
        <p className="text-red-500 text-sm">{error.message}</p>
        <button
          onClick={() => window.location.reload()} // Simple retry
          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 bg-neutral-900 rounded-lg shadow-xl h-full overflow-y-auto">
      <h2 className="text-2xl font-bold text-white mb-6">Call History</h2>
      {sessions.length === 0 ? (
        <p className="text-gray-400">No call history found.</p>
      ) : (
        <div>
          {sessions.map((session) => (
            <CallSessionItem key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
  );
};
