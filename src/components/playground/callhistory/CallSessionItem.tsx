import React from 'react';

export interface CallSession {
  id: string;
  roomName: string;
  startTime: string;
  endTime: string;
  duration: string;
  participantCount: number;
  recordingStatus: 'available' | 'processing' | 'none' | 'failed';
}

interface CallSessionItemProps {
  session: CallSession;
}

// Helper function to format date/time
const formatDateTime = (isoString: string) => {
  const date = new Date(isoString);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
};

// Placeholder for recording status icon
const RecordingStatusIcon: React.FC<{ status: CallSession['recordingStatus'] }> = ({ status }) => {
  switch (status) {
    case 'available':
      return <span title="Recording Available" className="text-green-500">●</span>; // Green circle
    case 'processing':
      return <span title="Recording Processing" className="text-yellow-500">◌</span>; // Yellow circle
    case 'none':
      return <span title="No Recording" className="text-gray-400">○</span>; // Gray circle
    case 'failed':
      return <span title="Recording Failed" className="text-red-500">✕</span>; // Red X
    default:
      return null;
  }
};

export const CallSessionItem: React.FC<CallSessionItemProps> = ({ session }) => {
  return (
    <div className="bg-neutral-800 p-4 rounded-lg shadow-md mb-4 hover:bg-neutral-700 transition-colors duration-150">
      <div className="flex justify-between items-start">
        <h3 className="text-lg font-semibold text-white mb-2">{session.roomName}</h3>
        <RecordingStatusIcon status={session.recordingStatus} />
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-gray-300">
        <p>
          <span className="font-medium text-gray-100">Start:</span> {formatDateTime(session.startTime)}
        </p>
        <p>
          <span className="font-medium text-gray-100">Participants:</span> {session.participantCount}
        </p>
        <p>
          <span className="font-medium text-gray-100">End:</span> {formatDateTime(session.endTime)}
        </p>
        <p>
          <span className="font-medium text-gray-100">Duration:</span> {session.duration}
        </p>
      </div>
    </div>
  );
};
