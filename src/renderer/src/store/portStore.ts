import { create } from 'zustand';
import type { PortInfo } from '@/types';

interface PortState {
  ports: PortInfo[];
  error: string | null;
  /** Maps port number → timestamp when first seen this session */
  firstSeen: Record<number, number>;

  setPorts: (ports: PortInfo[]) => void;
  setError: (error: string | null) => void;
}

export const usePortStore = create<PortState>((set, get) => ({
  ports: [],
  error: null,
  firstSeen: {},

  setPorts: ports => {
    const now = Date.now();
    const prev = get().firstSeen;
    const next = { ...prev };

    // Record firstSeen for new ports, prune gone ones
    const activePorts = new Set(ports.map(p => p.port));
    for (const p of ports) {
      if (!(p.port in next)) next[p.port] = now;
    }
    for (const port of Object.keys(next)) {
      if (!activePorts.has(Number(port))) delete next[Number(port)];
    }

    set({ ports, firstSeen: next });
  },
  setError: error => set({ error }),
}));
