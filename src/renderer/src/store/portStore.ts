import { create } from 'zustand'
import type { PortInfo } from '@/types'

interface PortState {
  ports: PortInfo[]
  monitoring: boolean

  setPorts: (ports: PortInfo[]) => void
  setMonitoring: (monitoring: boolean) => void
}

export const usePortStore = create<PortState>((set) => ({
  ports: [],
  monitoring: false,

  setPorts: (ports) => set({ ports }),
  setMonitoring: (monitoring) => set({ monitoring }),
}))
