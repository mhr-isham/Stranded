import { createContext, useContext, useEffect } from 'react';
import type { DiscoveryArtifact } from '../../game/schoolRewards';

export const LessonArtifactContext = createContext<((artifact?: DiscoveryArtifact) => void) | null>(null);
/** The lesson host archives this work only on explicit lesson completion. */
export function useLessonArtifact(artifact?: DiscoveryArtifact) {
  const register = useContext(LessonArtifactContext);
  useEffect(() => { register?.(artifact); }, [register, artifact]);
}
