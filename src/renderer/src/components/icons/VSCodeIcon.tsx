import vscodeIcon from '@/assets/app-icons/vscode.png';

export function VSCodeIcon({ className }: { className?: string }) {
  return <img src={vscodeIcon} alt='VS Code' className={className} draggable={false} />;
}
