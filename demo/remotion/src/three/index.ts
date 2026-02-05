/**
 * Three.js components for Remotion
 *
 * This module provides 3D visual effects that integrate with Remotion's
 * declarative video rendering system. All components:
 * - Use useCurrentFrame() for deterministic, frame-accurate animation
 * - Memoize geometries and materials for performance
 * - Support the project's dark theme color palette
 */

export {ParticleBackground} from './ParticleBackground';
export type {ParticleBackgroundProps} from './ParticleBackground';
