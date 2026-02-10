import ghosttyIcon from '@/assets/app-icons/ghostty.png'

export function GhosttyIcon({ className }: { className?: string }) {
  return <img src={ghosttyIcon} alt="Ghostty" className={className} draggable={false} />
}
