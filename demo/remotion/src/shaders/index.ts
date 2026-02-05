/**
 * Shader Effects Library for Remotion Videos
 *
 * A collection of WebGL and CSS-based visual effects optimized
 * for Remotion video rendering with frame-synced animations.
 *
 * Dark Theme (scope3-execution) Components:
 * - GradientBackground: Animated dark gradient with green accent glow
 * - NoiseOverlay: Film grain texture for cinematic quality
 * - ParticleField: Floating particles for depth and atmosphere
 * - GlowEffect: Bloom/glow for emphasis on key elements
 * - PostProcessing: Vignette, color grading, scan lines
 *
 * Usage:
 * ```tsx
 * import {
 *   GradientBackground,
 *   NoiseOverlay,
 *   ParticleField,
 *   GlowEffect,
 *   Vignette,
 *   PostProcessingPreset,
 * } from './shaders';
 *
 * const MyScene = () => (
 *   <AbsoluteFill>
 *     <GradientBackground />
 *     <GlowEffect mode="corner-tl" color={THEME.green} />
 *     <ParticleField count={50} color={THEME.green} />
 *
 *     <PostProcessingPreset preset="cinematic-dark">
 *       {Your scene content here}
 *     </PostProcessingPreset>
 *
 *     <NoiseOverlay intensity={0.06} />
 *     <Vignette intensity={0.4} />
 *   </AbsoluteFill>
 * );
 * ```
 */

// Gradient backgrounds
export {
	GradientBackground,
	GradientBackgroundCSS,
} from './GradientBackground';

// Noise/grain effects
export {
	NoiseOverlay,
	NoiseOverlayCSS,
} from './NoiseOverlay';

// Particle systems
export {
	ParticleField,
	ParticleFieldCSS,
} from './ParticleField';

// Glow/bloom effects
export {
	GlowEffect,
	MultiGlow,
	AccentGlow,
} from './GlowEffect';

// Post-processing effects
export {
	Vignette,
	ColorGrade,
	ChromaticAberration,
	ScanLines,
	PostProcessingPreset,
} from './PostProcessing';

// Re-export types
export type {default as GradientBackgroundType} from './GradientBackground';
export type {default as NoiseOverlayType} from './NoiseOverlay';
export type {default as ParticleFieldType} from './ParticleField';
export type {default as GlowEffectType} from './GlowEffect';
export type {default as VignetteType} from './PostProcessing';
