import type { NextApiRequest, NextApiResponse } from 'next';
import { AccessToken } from 'livekit-server-sdk';

// Define a type for the expected session data from LiveKit Analytics API
// This is based on the documentation: https://docs.livekit.io/home/cloud/analytics-api/#list-sessions
// And an individual session's egress info might be relevant if joined by backend
interface LivekitEgressInfo {
  egress_id: string;
  room_id: string;
  room_name: string;
  status: string;
  started_at?: number;
  ended_at?: number;
  error?: string;
  // file_results, stream_results etc. could be here
}

interface LivekitParticipantInfo {
  identity: string;
  name: string;
  joined_at: number; // Unix timestamp
  left_at?: number; // Unix timestamp
  duration?: number; // seconds
  // other fields like versions, region etc.
}

interface LivekitSessionData {
  session_id: string;
  name: string; // roomName
  created_at: number; // Unix timestamp (seconds)
  updated_at?: number; // Unix timestamp (seconds) for last activity
  start_time?: number; // Unix timestamp (seconds) - from session details
  end_time?: number; // Unix timestamp (seconds) - from session details
  duration?: number; // In seconds
  num_participants?: number;
  num_active_participants?: number;
  max_participants?: number;
  // `egress` field from list sessions (0 = never started, 1 = active, 2 = ended)
  // For detailed status, egress_info might be populated by the backend (if it does a join)
  // or this API route could be extended to fetch it.
  egress_info?: LivekitEgressInfo[];
  participants?: LivekitParticipantInfo[];
  // ... and other fields from the LiveKit Analytics API response
}

// The API might return an array of sessions or a single session object if an ID is queried
// For /api/project/{projectId}/sessions, it's { sessions: LivekitSessionData[] }
type SessionsApiResponse = {
  sessions: LivekitSessionData[];
  next_page_token?: string; // if pagination is used
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SessionsApiResponse | { error: string; details?: string }>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const projectId = process.env.LIVEKIT_PROJECT_ID;

  if (!apiKey || !apiSecret || !projectId) {
    console.error('[API/LIVEKIT/SESSIONS] Missing LiveKit environment variables (API_KEY, API_SECRET, or PROJECT_ID).');
    return res.status(500).json({ error: 'Server configuration error: Missing LiveKit credentials.' });
  }

  try {
    const at = new AccessToken(apiKey, apiSecret, {
      identity: 'playground-api-service', // Identity for this server-side token
      name: 'Playground Analytics Service', // Optional name for the token holder
      // ttl: '5m', // Short-lived token for this specific operation
    });
    at.addGrant({ roomList: true }); // Grant to list rooms/sessions
    const token = await at.toJwt();

    const livekitApiBase = process.env.LIVEKIT_BASE_URL || 'https://cloud-api.livekit.io';

    // Construct URL with query parameters from the incoming request if any
    // e.g., limit, page, start, end for pagination and filtering
    const incomingQuery = req.query;
    const queryParams = new URLSearchParams();
    if (incomingQuery.limit) queryParams.append('limit', incomingQuery.limit as string);
    if (incomingQuery.page) queryParams.append('page', incomingQuery.page as string);
    if (incomingQuery.start_date) queryParams.append('start_date', incomingQuery.start_date as string);
    if (incomingQuery.end_date) queryParams.append('end_date', incomingQuery.end_date as string);
    if (incomingQuery.room_name) queryParams.append('room_name', incomingQuery.room_name as string);


    const sessionsUrl = `${livekitApiBase}/api/project/${projectId}/sessions${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

    console.log(`[API/LIVEKIT/SESSIONS] Fetching sessions from: ${sessionsUrl}`);

    const livekitResponse = await fetch(sessionsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store', // Ensure fresh data is fetched
    });

    if (!livekitResponse.ok) {
      const errorBody = await livekitResponse.text();
      console.error(`[API/LIVEKIT/SESSIONS] LiveKit API error: ${livekitResponse.status} - ${livekitResponse.statusText}. Body: ${errorBody}`);
      return res.status(livekitResponse.status || 502).json({
        error: 'Failed to fetch sessions from LiveKit.',
        details: `LiveKit API responded with status ${livekitResponse.status}. Check server logs for more details.`
      });
    }

    const sessionsData: SessionsApiResponse = await livekitResponse.json();
    return res.status(200).json(sessionsData);

  } catch (error) {
    console.error('[API/LIVEKIT/SESSIONS] Internal error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return res.status(500).json({ error: 'Internal server error.', details: errorMessage });
  }
}
