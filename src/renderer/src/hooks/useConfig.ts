import { useState, useEffect, useCallback } from 'react'
import type { AppConfig } from '@/types'

const CONFIG_CHANGED_EVENT = 'repohub:config-changed'

export function useConfig() {
  const [config, setConfig] = useState<AppConfig | null>(null)

  useEffect(() => {
    window.electron.config.get().then(setConfig)

    const handleConfigChanged = () => {
      window.electron.config.get().then(setConfig)
    }
    window.addEventListener(CONFIG_CHANGED_EVENT, handleConfigChanged)
    return () => window.removeEventListener(CONFIG_CHANGED_EVENT, handleConfigChanged)
  }, [])

  const update = useCallback(async (updates: Partial<AppConfig>) => {
    const updated = await window.electron.config.update(updates)
    setConfig(updated)
    window.dispatchEvent(new Event(CONFIG_CHANGED_EVENT))
    return updated
  }, [])

  const setCommandOverride = useCallback(
    async (repoId: string, command: string) => {
      await window.electron.config.setCommandOverride(repoId, command)
      const updated = await window.electron.config.get()
      setConfig(updated)
    },
    [],
  )

  const removeCommandOverride = useCallback(async (repoId: string) => {
    await window.electron.config.removeCommandOverride(repoId)
    const updated = await window.electron.config.get()
    setConfig(updated)
  }, [])

  return {
    config,
    update,
    setCommandOverride,
    removeCommandOverride,
  }
}
