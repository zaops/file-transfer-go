import { create } from 'zustand';

interface WebRTCState {
  isConnected: boolean;
  isConnecting: boolean;
  isWebSocketConnected: boolean;
  isPeerConnected: boolean;
  error: string | null;
  currentRoom: { code: string; role: 'sender' | 'receiver' } | null;
}

interface WebRTCStore extends WebRTCState {
  updateState: (updates: Partial<WebRTCState>) => void;
  setCurrentRoom: (room: { code: string; role: 'sender' | 'receiver' } | null) => void;
  reset: () => void;
}

const initialState: WebRTCState = {
  isConnected: false,
  isConnecting: false,
  isWebSocketConnected: false,
  isPeerConnected: false,
  error: null,
  currentRoom: null,
};

export const useWebRTCStore = create<WebRTCStore>((set) => ({
  ...initialState,
  
  updateState: (updates) => set((state) => ({
    ...state,
    ...updates,
  })),
  
  setCurrentRoom: (room) => set((state) => ({
    ...state,
    currentRoom: room,
  })),
  
  reset: () => set(initialState),
}));
