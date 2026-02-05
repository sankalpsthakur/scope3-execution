/**
 * Shared animation utilities for Remotion projects
 * Ported from scope3-strategy with TypeScript support and extended functionality
 *
 * Apple/Stripe-quality spring configs:
 * - Lower damping (10-30) creates natural, organic motion with subtle overshoot
 * - Higher stiffness (150-300) makes animations feel responsive
 * - Mass affects "weight" - lower = snappier, higher = more deliberate
 */
import {interpolate, spring, Easing, measureSpring} from 'remotion';

// ============================================================================
// Spring Configuration Presets (Apple/Stripe-quality)
// ============================================================================

export const SPRING_CONFIGS = {
	/** Snappy spring for buttons, chips, small UI (iOS tap feel) */
	snappy: {mass: 1, damping: 15, stiffness: 300},
	/** Default smooth spring - most UI animations (slight overshoot) */
	default: {mass: 1, damping: 20, stiffness: 170},
	/** Gentle spring for large elements (cards, panels, modals) */
	gentle: {mass: 1, damping: 26, stiffness: 120},
	/** Bouncy spring for playful/celebratory elements */
	bouncy: {mass: 0.8, damping: 12, stiffness: 200},
	/** Precise spring for cursor/pointer (no overshoot needed) */
	precise: {mass: 1, damping: 30, stiffness: 200},
	/** Slide spring - smooth lateral movement */
	slide: {mass: 1, damping: 22, stiffness: 140},
	/** Soft spring for background/ambient animations */
	soft: {mass: 1.2, damping: 28, stiffness: 80},
	/** Legacy critically-damped (for backwards compatibility only) */
	legacy: {damping: 200},
} as const;

export type SpringConfigName = keyof typeof SPRING_CONFIGS;

// ============================================================================
// Timing Constants
// ============================================================================

export const TIMING = {
	/** Quick micro-interaction (button press, toggle) */
	microSec: 0.15,
	/** Fast transition (chip, small element) */
	fastSec: 0.25,
	/** Standard appear duration */
	appearSec: 0.4,
	/** Standard fade duration */
	fadeSec: 0.5,
	/** Standard slide duration */
	slideSec: 0.6,
	/** Slow/dramatic transition */
	slowSec: 0.8,
	/** Scene transition duration */
	sceneSec: 1.0,
} as const;

// ============================================================================
// Easing Curves (Apple-quality bezier curves)
// ============================================================================

export const EASING = {
	/** iOS standard ease-out (quick start, gentle end) */
	appleEaseOut: Easing.bezier(0.25, 0.1, 0.25, 1),
	/** iOS standard ease-in-out */
	appleEaseInOut: Easing.bezier(0.42, 0, 0.58, 1),
	/** Smooth deceleration (great for fades) */
	smoothOut: Easing.bezier(0.16, 1, 0.3, 1),
	/** Emphasized ease-out with overshoot feel */
	emphatic: Easing.bezier(0.34, 1.56, 0.64, 1),
	/** Gentle ease for subtle animations */
	gentle: Easing.bezier(0.4, 0, 0.2, 1),
} as const;

// ============================================================================
// Stagger Configuration
// ============================================================================

export const STAGGER = {
	/** Tight stagger for related items (2 frames / ~67ms at 30fps) */
	tight: 2,
	/** Default stagger for list items (3 frames / 100ms) */
	default: 3,
	/** Comfortable stagger for cards (4 frames / ~133ms) */
	comfortable: 4,
	/** Loose stagger for dramatic reveals (6 frames / 200ms) */
	loose: 6,
} as const;

// ============================================================================
// Core Animation Functions
// ============================================================================

/**
 * Fade in animation with Apple-quality easing
 * @param frame - Current frame number
 * @param fps - Frames per second
 * @param durationSec - Duration in seconds (default: 0.5)
 * @returns Opacity value from 0 to 1 with smooth easing
 */
export const fadeIn = (frame: number, fps: number, durationSec: number = TIMING.fadeSec): number => {
	const d = Math.max(1, Math.round(durationSec * fps));
	return interpolate(frame, [0, d], [0, 1], {
		extrapolateRight: 'clamp',
		easing: EASING.smoothOut,
	});
};

/**
 * Fade out animation with Apple-quality easing
 * @param frame - Current frame number
 * @param fps - Frames per second
 * @param durationSec - Duration in seconds (default: 0.5)
 * @returns Opacity value from 1 to 0 with smooth easing
 */
export const fadeOut = (frame: number, fps: number, durationSec: number = TIMING.fadeSec): number => {
	const d = Math.max(1, Math.round(durationSec * fps));
	return interpolate(frame, [0, d], [1, 0], {
		extrapolateRight: 'clamp',
		easing: EASING.appleEaseInOut,
	});
};

/**
 * Slide up animation using spring physics with natural motion
 * @param frame - Current frame number
 * @param fps - Frames per second
 * @param distance - Distance to slide in pixels (default: 20)
 * @returns Y offset in pixels (starts at distance, ends at 0 with overshoot)
 */
export const slideUp = (frame: number, fps: number, distance: number = 20): number => {
	const v = spring({
		frame,
		fps,
		config: SPRING_CONFIGS.slide,
	});
	return distance * (1 - v);
};

/**
 * Slide down animation using spring physics
 * @param frame - Current frame number
 * @param fps - Frames per second
 * @param distance - Distance to slide in pixels (default: 20)
 * @returns Y offset in pixels (starts at 0, ends at distance)
 */
export const slideDown = (frame: number, fps: number, distance: number = 20): number => {
	const v = spring({
		frame,
		fps,
		config: SPRING_CONFIGS.slide,
	});
	return distance * v;
};

// ============================================================================
// Combined Animation Helpers (common patterns)
// ============================================================================

/**
 * Combined appear animation (fade + slide up) with Apple-quality motion
 * @param frame - Current frame number
 * @param fps - Frames per second
 * @param options - Animation options
 * @returns Object with opacity and y transform values
 */
export const appear = (
	frame: number,
	fps: number,
	options: {
		fadeDurationSec?: number;
		slideDistance?: number;
		delay?: number;
	} = {}
): {opacity: number; y: number} => {
	const fadeDuration = options.fadeDurationSec ?? TIMING.appearSec;
	const slideDistance = options.slideDistance ?? 16;
	const delay = options.delay ?? 0;

	const localFrame = Math.max(0, frame - delay);
	const opacity = fadeIn(localFrame, fps, fadeDuration);
	const y = slideUp(localFrame, fps, slideDistance);

	return {opacity, y};
};

/**
 * Pop-in animation with overshoot (scale 0.85 -> 1.02 -> 1)
 * Perfect for buttons, chips, badges appearing
 * @param frame - Current frame number
 * @param fps - Frames per second
 * @param delay - Delay in frames before animation starts
 * @returns Scale value with natural overshoot
 */
export const popIn = (frame: number, fps: number, delay: number = 0): number => {
	const localFrame = Math.max(0, frame - delay);
	const progress = spring({
		fps,
		frame: localFrame,
		config: SPRING_CONFIGS.bouncy,
	});
	// Start at 0.85, overshoot to ~1.02, settle at 1
	return interpolate(progress, [0, 1], [0.85, 1], {extrapolateRight: 'clamp'});
};

/**
 * Spring-based appear animation with configurable spring
 * @param frame - Current frame number
 * @param fps - Frames per second
 * @param config - Spring config name (default: 'default')
 * @returns Spring progress value 0-1 with natural overshoot
 */
export const springAppear = (
	frame: number,
	fps: number,
	config: SpringConfigName = 'default'
): number => {
	return spring({
		fps,
		frame,
		config: SPRING_CONFIGS[config],
	});
};

/**
 * Delayed spring animation for staggered effects
 * @param frame - Current frame number
 * @param fps - Frames per second
 * @param delay - Delay in frames before animation starts
 * @param config - Spring config name
 * @returns Spring progress value 0-1
 */
export const delayedSpring = (
	frame: number,
	fps: number,
	delay: number,
	config: SpringConfigName = 'default'
): number => {
	return spring({
		fps,
		frame: Math.max(0, frame - delay),
		config: SPRING_CONFIGS[config],
	});
};

/**
 * Staggered appear for list items with configurable timing
 * @param frame - Current frame number
 * @param fps - Frames per second
 * @param index - Item index in the list
 * @param staggerFrames - Frames between each item (default: 3)
 * @param options - Additional animation options
 * @returns Object with opacity, y, and scale values
 */
export const staggeredAppear = (
	frame: number,
	fps: number,
	index: number,
	staggerFrames: number = STAGGER.default,
	options: {slideDistance?: number} = {}
): {opacity: number; y: number; scale: number} => {
	const delay = index * staggerFrames;
	const localFrame = Math.max(0, frame - delay);
	const slideDistance = options.slideDistance ?? 12;

	const progress = spring({
		fps,
		frame: localFrame,
		config: SPRING_CONFIGS.default,
	});

	return {
		opacity: interpolate(progress, [0, 0.5], [0, 1], {extrapolateRight: 'clamp'}),
		y: slideDistance * (1 - progress),
		scale: interpolate(progress, [0, 1], [0.96, 1], {extrapolateRight: 'clamp'}),
	};
};

// ============================================================================
// Scale Animations
// ============================================================================

/**
 * Scale in animation with spring overshoot
 * @param frame - Current frame number
 * @param fps - Frames per second
 * @param startScale - Starting scale (default: 0.9)
 * @param endScale - Ending scale (default: 1)
 * @param config - Spring config name
 * @returns Scale value with natural overshoot
 */
export const scaleIn = (
	frame: number,
	fps: number,
	startScale = 0.9,
	endScale = 1,
	config: SpringConfigName = 'snappy'
): number => {
	const progress = spring({fps, frame, config: SPRING_CONFIGS[config]});
	return startScale + (endScale - startScale) * progress;
};

/**
 * Breathe/pulse animation for emphasis (subtle scale oscillation)
 * Great for drawing attention to an element
 * @param frame - Current frame number
 * @param fps - Frames per second
 * @param intensity - Pulse intensity (default: 0.02 = 2% scale change)
 * @param periodSec - Pulse period in seconds (default: 2)
 * @returns Scale value oscillating around 1
 */
export const breathe = (
	frame: number,
	fps: number,
	intensity: number = 0.02,
	periodSec: number = 2
): number => {
	const period = periodSec * fps;
	const phase = (frame % period) / period;
	// Smooth sine wave oscillation
	return 1 + intensity * Math.sin(phase * Math.PI * 2);
};

/**
 * Focus ring pulse animation (scale and opacity)
 * @param frame - Current frame number
 * @param fps - Frames per second
 * @param startFrame - Frame when pulse starts
 * @param durationInFrames - How long the pulse effect lasts
 * @returns Object with scale, opacity, and glowIntensity
 */
export const focusPulse = (
	frame: number,
	fps: number,
	startFrame: number,
	durationInFrames: number
): {scale: number; opacity: number; glowIntensity: number} => {
	const localFrame = frame - startFrame;
	if (localFrame < 0) return {scale: 0.95, opacity: 0, glowIntensity: 0};

	const enterProgress = spring({
		fps,
		frame: localFrame,
		config: SPRING_CONFIGS.snappy,
	});

	// Calculate exit progress (starts fading near the end)
	const exitStartFrame = Math.max(0, durationInFrames - Math.round(fps * 0.3));
	const exitProgress = localFrame > exitStartFrame
		? interpolate(localFrame, [exitStartFrame, durationInFrames], [0, 1], {
			extrapolateRight: 'clamp',
			easing: EASING.appleEaseInOut,
		})
		: 0;

	// Subtle pulse during hold
	const holdFrame = localFrame - Math.round(fps * 0.2);
	const pulsePhase = holdFrame > 0 ? Math.sin((holdFrame / fps) * Math.PI * 2) * 0.01 : 0;

	return {
		scale: interpolate(enterProgress, [0, 1], [0.95, 1]) + pulsePhase,
		opacity: enterProgress * (1 - exitProgress * 0.15), // Fade to 0.85 on exit
		glowIntensity: enterProgress * (1 - exitProgress * 0.5),
	};
};

// ============================================================================
// Toast/Notification Animations
// ============================================================================

/**
 * Toast enter animation with bounce
 * @param frame - Current frame number
 * @param fps - Frames per second
 * @param startFrame - Frame when toast appears
 * @returns Object with opacity, y, and scale values
 */
export const toastEnter = (
	frame: number,
	fps: number,
	startFrame: number
): {opacity: number; y: number; scale: number} => {
	const localFrame = Math.max(0, frame - startFrame);

	const progress = spring({
		fps,
		frame: localFrame,
		config: SPRING_CONFIGS.bouncy,
	});

	return {
		opacity: interpolate(progress, [0, 0.3], [0, 1], {extrapolateRight: 'clamp'}),
		y: interpolate(progress, [0, 1], [16, 0]),
		scale: interpolate(progress, [0, 1], [0.92, 1]),
	};
};

/**
 * Toast exit animation with smooth slide
 * @param frame - Current frame number
 * @param fps - Frames per second
 * @param exitStartFrame - Frame when exit begins
 * @param durationFrames - Exit duration in frames
 * @returns Object with opacity, y, and scale values
 */
export const toastExit = (
	frame: number,
	fps: number,
	exitStartFrame: number,
	durationFrames: number = 12
): {opacity: number; y: number; scale: number} => {
	const localFrame = frame - exitStartFrame;
	if (localFrame < 0) return {opacity: 1, y: 0, scale: 1};

	const progress = interpolate(localFrame, [0, durationFrames], [0, 1], {
		extrapolateRight: 'clamp',
		easing: EASING.appleEaseInOut,
	});

	return {
		opacity: 1 - progress,
		y: progress * -8, // Slide up slightly on exit
		scale: 1 - progress * 0.05,
	};
};

// ============================================================================
// Scene Transition Helpers
// ============================================================================

/**
 * Cross-fade transition between scenes
 * @param frame - Current frame number
 * @param fps - Frames per second
 * @param transitionFrame - Frame where transition occurs
 * @param durationSec - Transition duration in seconds
 * @returns Object with outgoing and incoming opacity
 */
export const crossFade = (
	frame: number,
	fps: number,
	transitionFrame: number,
	durationSec: number = 0.4
): {outOpacity: number; inOpacity: number} => {
	const durationFrames = Math.round(durationSec * fps);
	const halfDuration = durationFrames / 2;

	const outOpacity = interpolate(
		frame,
		[transitionFrame - halfDuration, transitionFrame],
		[1, 0],
		{extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASING.appleEaseInOut}
	);

	const inOpacity = interpolate(
		frame,
		[transitionFrame, transitionFrame + halfDuration],
		[0, 1],
		{extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASING.appleEaseInOut}
	);

	return {outOpacity, inOpacity};
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert seconds to frames
 * @param seconds - Duration in seconds
 * @param fps - Frames per second
 * @returns Number of frames (minimum 1)
 */
export const secToFrames = (seconds: number, fps: number): number => {
	return Math.max(1, Math.round(seconds * fps));
};

/**
 * Clamp a value between min and max
 * @param value - Value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Clamped value
 */
export const clamp = (value: number, min: number, max: number): number => {
	return Math.max(min, Math.min(max, value));
};

/**
 * Calculate spring duration using measureSpring for precise timing
 * @param fps - Frames per second
 * @param config - Spring config name
 * @returns Duration in frames until spring settles (within 0.5%)
 */
export const getSpringDuration = (fps: number, config: SpringConfigName = 'default'): number => {
	return measureSpring({fps, config: SPRING_CONFIGS[config], threshold: 0.005});
};

/**
 * Stagger helper for list animations
 * @param frame - Current frame
 * @param index - Item index
 * @param staggerFrames - Frames between items (default: 3)
 * @returns Adjusted frame for the item
 */
export const stagger = (frame: number, index: number, staggerFrames: number = STAGGER.default): number => {
	return Math.max(0, frame - index * staggerFrames);
};
