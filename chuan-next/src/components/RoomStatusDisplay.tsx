import React from 'react';
import { RoomStatus } from '@/types';

interface RoomStatusDisplayProps {
  roomStatus: RoomStatus | null;
  currentRole: 'sender' | 'receiver';
}

export const RoomStatusDisplay: React.FC<RoomStatusDisplayProps> = ({ roomStatus, currentRole }) => {
  if (!roomStatus || currentRole !== 'sender') {
    return null;
  }

  return (
    <div className="mt-6 glass-card rounded-2xl p-6 animate-fade-in-up">
      <h3 className="text-xl font-semibold text-slate-800 mb-4 text-center">实时状态</h3>
      <div className="grid grid-cols-3 gap-6">
        <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl">
          <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            {(roomStatus?.sender_count || 0) + (roomStatus?.receiver_count || 0)}
          </div>
          <div className="text-sm text-slate-600 mt-1">在线用户</div>
        </div>
        <div className="text-center p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl">
          <div className="text-3xl font-bold text-emerald-600">
            {roomStatus?.sender_count || 0}
          </div>
          <div className="text-sm text-slate-600 mt-1">发送方</div>
        </div>
        <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl">
          <div className="text-3xl font-bold text-purple-600">
            {roomStatus?.receiver_count || 0}
          </div>
          <div className="text-sm text-slate-600 mt-1">接收方</div>
        </div>
      </div>
    </div>
  );
};
