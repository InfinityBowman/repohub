import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useConfig } from '@/hooks/useConfig'

export function AppLayout() {
  const { config } = useConfig()

  useEffect(() => {
    if (config?.theme === 'palenight') {
      document.documentElement.classList.add('palenight')
    } else {
      document.documentElement.classList.remove('palenight')
    }
  }, [config?.theme])

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="drag-region h-12 flex-shrink-0" />
        <div className="flex-1 overflow-auto px-6 pb-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
