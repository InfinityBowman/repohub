import type { ProjectType } from '@/types';
import nodejsIcon from '@/assets/app-icons/nodejs.svg';
import pythonIcon from '@/assets/app-icons/python.svg';
import rustIcon from '@/assets/app-icons/rust.svg';
import goIcon from '@/assets/app-icons/go.svg';
import javaIcon from '@/assets/app-icons/java.svg';
import swiftIcon from '@/assets/app-icons/swift.svg';

const iconMap: Partial<Record<ProjectType, string>> = {
  node: nodejsIcon,
  python: pythonIcon,
  rust: rustIcon,
  go: goIcon,
  java: javaIcon,
  swift: swiftIcon,
};

const labelMap: Record<ProjectType, string> = {
  node: 'Node.js',
  python: 'Python',
  rust: 'Rust',
  go: 'Go',
  java: 'Java',
  swift: 'Swift',
  monorepo: 'Monorepo',
  unknown: 'Other',
};

export function LanguageIcon({ type, className }: { type: ProjectType; className?: string }) {
  const src = iconMap[type];
  if (!src) return null;
  return <img src={src} alt={labelMap[type]} className={className} draggable={false} />;
}
