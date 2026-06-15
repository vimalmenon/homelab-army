import K8sScene from '@/components/K8sScene';

/**
 * Design Philosophy: Cyberpunk Neon Minimalism
 * - Full-screen 3D visualization as primary interface
 * - Minimal UI chrome with glassmorphic overlays
 * - Neon accents (cyan, magenta, green) on dark background
 * - Interactive 3D components with smooth animations
 */
export default function Home() {
  return (
    <div className="w-full h-screen">
      <K8sScene />
    </div>
  );
}
