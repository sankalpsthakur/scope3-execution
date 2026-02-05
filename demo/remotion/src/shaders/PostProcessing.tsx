/**
 * PostProcessing - Vignette, color grading, and subtle blur effects.
 *
 * Collection of post-processing effects to enhance video quality:
 * - Vignette: darkened edges for focus
 * - Color grading: lift/gamma/gain adjustments
 * - Chromatic aberration: subtle RGB split
 *
 * Features:
 * - Composable effects that stack
 * - Frame-synced animations
 * - Performance optimized CSS where possible
 */
import React, {useMemo, useRef, useEffect} from 'react';
import {useCurrentFrame, useVideoConfig, AbsoluteFill, interpolate} from 'remotion';
import {THEME} from '../theme';

// ============================================================================
// VIGNETTE EFFECT
// ============================================================================

interface VignetteProps {
	/** Vignette intensity 0-1 (default: 0.4) */
	intensity?: number;
	/** Edge softness (default: 0.5) */
	softness?: number;
	/** Horizontal radius as percentage (default: 80) */
	radiusX?: number;
	/** Vertical radius as percentage (default: 60) */
	radiusY?: number;
	/** Vignette color (default: black) */
	color?: string;
	/** Fade in duration in frames (default: 0) */
	fadeInFrames?: number;
	/** Optional style overrides */
	style?: React.CSSProperties;
	/** Z-index for layering (default: 50) */
	zIndex?: number;
}

/**
 * Vignette effect - darkened edges to draw focus to center.
 * Classic cinematic effect using radial gradient.
 */
export const Vignette: React.FC<VignetteProps> = ({
	intensity = 0.4,
	softness = 0.5,
	radiusX = 80,
	radiusY = 60,
	color = '#000000',
	fadeInFrames = 0,
	style,
	zIndex = 50,
}) => {
	const frame = useCurrentFrame();

	const fadeOpacity = fadeInFrames > 0
		? interpolate(frame, [0, fadeInFrames], [0, 1], {extrapolateRight: 'clamp'})
		: 1;

	const finalIntensity = intensity * fadeOpacity;

	// Calculate gradient stops based on softness
	const innerStop = Math.max(0, 50 - softness * 30);
	const outerStop = Math.min(100, 70 + softness * 30);

	const gradient = useMemo(() => {
		return `radial-gradient(ellipse ${radiusX}% ${radiusY}% at 50% 40%, transparent ${innerStop}%, ${color} ${outerStop}%)`;
	}, [radiusX, radiusY, innerStop, outerStop, color]);

	return (
		<AbsoluteFill
			style={{
				zIndex,
				pointerEvents: 'none',
				background: gradient,
				opacity: finalIntensity,
				...style,
			}}
		/>
	);
};

// ============================================================================
// COLOR GRADING EFFECT
// ============================================================================

interface ColorGradeProps {
	/** Brightness adjustment -1 to 1 (default: 0) */
	brightness?: number;
	/** Contrast adjustment -1 to 1 (default: 0) */
	contrast?: number;
	/** Saturation adjustment -1 to 1 (default: 0) */
	saturation?: number;
	/** Hue rotation in degrees (default: 0) */
	hueRotate?: number;
	/** Sepia amount 0-1 (default: 0) */
	sepia?: number;
	/** Fade in duration in frames (default: 0) */
	fadeInFrames?: number;
	/** Children to apply filter to */
	children: React.ReactNode;
	/** Optional style overrides */
	style?: React.CSSProperties;
}

/**
 * Color grading wrapper - applies CSS filters to children.
 * Wrap your scene content to apply uniform color grading.
 */
export const ColorGrade: React.FC<ColorGradeProps> = ({
	brightness = 0,
	contrast = 0,
	saturation = 0,
	hueRotate = 0,
	sepia = 0,
	fadeInFrames = 0,
	children,
	style,
}) => {
	const frame = useCurrentFrame();

	const fadeProgress = fadeInFrames > 0
		? interpolate(frame, [0, fadeInFrames], [0, 1], {extrapolateRight: 'clamp'})
		: 1;

	// Interpolate values based on fade
	const currentBrightness = brightness * fadeProgress;
	const currentContrast = contrast * fadeProgress;
	const currentSaturation = saturation * fadeProgress;
	const currentHue = hueRotate * fadeProgress;
	const currentSepia = sepia * fadeProgress;

	// Convert to CSS filter values
	const brightnessValue = 100 + currentBrightness * 50; // -1 to 1 -> 50% to 150%
	const contrastValue = 100 + currentContrast * 50;
	const saturateValue = 100 + currentSaturation * 50;

	const filter = useMemo(() => {
		const filters: string[] = [];

		if (currentBrightness !== 0) filters.push(`brightness(${brightnessValue}%)`);
		if (currentContrast !== 0) filters.push(`contrast(${contrastValue}%)`);
		if (currentSaturation !== 0) filters.push(`saturate(${saturateValue}%)`);
		if (currentHue !== 0) filters.push(`hue-rotate(${currentHue}deg)`);
		if (currentSepia > 0) filters.push(`sepia(${currentSepia * 100}%)`);

		return filters.length > 0 ? filters.join(' ') : 'none';
	}, [brightnessValue, contrastValue, saturateValue, currentHue, currentSepia]);

	return (
		<AbsoluteFill
			style={{
				filter,
				...style,
			}}
		>
			{children}
		</AbsoluteFill>
	);
};

// ============================================================================
// CHROMATIC ABERRATION
// ============================================================================

interface ChromaticAberrationProps {
	/** Aberration offset in pixels (default: 2) */
	offset?: number;
	/** Animate the effect (default: false) */
	animate?: boolean;
	/** Animation frequency in Hz (default: 0.2) */
	animationSpeed?: number;
	/** Fade in duration in frames (default: 0) */
	fadeInFrames?: number;
	/** Children to apply effect to */
	children: React.ReactNode;
	/** Optional style overrides */
	style?: React.CSSProperties;
}

/**
 * Chromatic aberration effect using CSS text-shadow trick.
 * Note: For full image aberration, WebGL would be needed.
 * This version provides a subtle RGB split on edges.
 */
export const ChromaticAberration: React.FC<ChromaticAberrationProps> = ({
	offset = 2,
	animate = false,
	animationSpeed = 0.2,
	fadeInFrames = 0,
	children,
	style,
}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const time = frame / fps;

	const fadeProgress = fadeInFrames > 0
		? interpolate(frame, [0, fadeInFrames], [0, 1], {extrapolateRight: 'clamp'})
		: 1;

	// Animated offset
	const currentOffset = animate
		? offset * (1 + Math.sin(time * animationSpeed * Math.PI * 2) * 0.3)
		: offset;

	const effectiveOffset = currentOffset * fadeProgress;

	return (
		<AbsoluteFill
			style={{
				position: 'relative',
				...style,
			}}
		>
			{/* Red channel offset */}
			<AbsoluteFill
				style={{
					transform: `translateX(${-effectiveOffset}px)`,
					mixBlendMode: 'screen',
					opacity: 0.5,
				}}
			>
				<AbsoluteFill style={{filter: 'url(#red-channel)'}}>
					{children}
				</AbsoluteFill>
			</AbsoluteFill>

			{/* Blue channel offset */}
			<AbsoluteFill
				style={{
					transform: `translateX(${effectiveOffset}px)`,
					mixBlendMode: 'screen',
					opacity: 0.5,
				}}
			>
				<AbsoluteFill style={{filter: 'url(#blue-channel)'}}>
					{children}
				</AbsoluteFill>
			</AbsoluteFill>

			{/* Main content */}
			<AbsoluteFill>{children}</AbsoluteFill>

			{/* SVG filters for color channel separation */}
			<svg style={{position: 'absolute', width: 0, height: 0}}>
				<defs>
					<filter id="red-channel">
						<feColorMatrix
							type="matrix"
							values="1 0 0 0 0
									0 0 0 0 0
									0 0 0 0 0
									0 0 0 1 0"
						/>
					</filter>
					<filter id="blue-channel">
						<feColorMatrix
							type="matrix"
							values="0 0 0 0 0
									0 0 0 0 0
									0 0 1 0 0
									0 0 0 1 0"
						/>
					</filter>
				</defs>
			</svg>
		</AbsoluteFill>
	);
};

// ============================================================================
// SCAN LINES (CRT EFFECT)
// ============================================================================

interface ScanLinesProps {
	/** Line spacing in pixels (default: 4) */
	spacing?: number;
	/** Line opacity 0-1 (default: 0.1) */
	opacity?: number;
	/** Animate scroll (default: false) */
	animate?: boolean;
	/** Animation speed (default: 1) */
	speed?: number;
	/** Fade in duration in frames (default: 0) */
	fadeInFrames?: number;
	/** Optional style overrides */
	style?: React.CSSProperties;
	/** Z-index for layering (default: 90) */
	zIndex?: number;
}

/**
 * Retro scan line effect for CRT/monitor aesthetic.
 */
export const ScanLines: React.FC<ScanLinesProps> = ({
	spacing = 4,
	opacity = 0.1,
	animate = false,
	speed = 1,
	fadeInFrames = 0,
	style,
	zIndex = 90,
}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const time = frame / fps;

	const fadeOpacity = fadeInFrames > 0
		? interpolate(frame, [0, fadeInFrames], [0, 1], {extrapolateRight: 'clamp'})
		: 1;

	// Animated vertical offset
	const offset = animate ? (time * 50 * speed) % spacing : 0;

	return (
		<AbsoluteFill
			style={{
				zIndex,
				pointerEvents: 'none',
				opacity: opacity * fadeOpacity,
				backgroundImage: `repeating-linear-gradient(
					0deg,
					transparent,
					transparent ${spacing - 1}px,
					rgba(0,0,0,0.8) ${spacing - 1}px,
					rgba(0,0,0,0.8) ${spacing}px
				)`,
				backgroundPosition: `0 ${offset}px`,
				...style,
			}}
		/>
	);
};

// ============================================================================
// COMBINED POST-PROCESSING PRESET
// ============================================================================

interface PostProcessingPresetProps {
	/** Preset name */
	preset: 'cinematic-dark' | 'cinematic-light' | 'vintage' | 'cold' | 'warm' | 'none';
	/** Overall intensity 0-1 (default: 1) */
	intensity?: number;
	/** Include film grain (default: true) */
	includeGrain?: boolean;
	/** Include vignette (default: true) */
	includeVignette?: boolean;
	/** Fade in duration in frames (default: 20) */
	fadeInFrames?: number;
	/** Children to wrap */
	children: React.ReactNode;
}

/**
 * Pre-configured post-processing presets.
 * Combines vignette and color grading for common looks.
 */
export const PostProcessingPreset: React.FC<PostProcessingPresetProps> = ({
	preset,
	intensity = 1,
	includeVignette = true,
	fadeInFrames = 20,
	children,
}) => {
	if (preset === 'none') {
		return <>{children}</>;
	}

	// Preset configurations
	const presets = {
		'cinematic-dark': {
			brightness: -0.05 * intensity,
			contrast: 0.1 * intensity,
			saturation: -0.1 * intensity,
			vignette: 0.5 * intensity,
		},
		'cinematic-light': {
			brightness: 0.02 * intensity,
			contrast: 0.05 * intensity,
			saturation: -0.05 * intensity,
			vignette: 0.3 * intensity,
		},
		'vintage': {
			brightness: 0,
			contrast: 0.1 * intensity,
			saturation: -0.2 * intensity,
			sepia: 0.15 * intensity,
			vignette: 0.6 * intensity,
		},
		'cold': {
			brightness: 0,
			contrast: 0.05 * intensity,
			saturation: 0,
			hueRotate: -10 * intensity,
			vignette: 0.35 * intensity,
		},
		'warm': {
			brightness: 0.02 * intensity,
			contrast: 0.05 * intensity,
			saturation: 0.1 * intensity,
			hueRotate: 10 * intensity,
			vignette: 0.35 * intensity,
		},
	};

	const config = presets[preset];

	return (
		<ColorGrade
			brightness={config.brightness}
			contrast={config.contrast}
			saturation={config.saturation}
			hueRotate={'hueRotate' in config ? config.hueRotate : 0}
			sepia={'sepia' in config ? config.sepia : 0}
			fadeInFrames={fadeInFrames}
		>
			{children}
			{includeVignette && (
				<Vignette
					intensity={config.vignette}
					fadeInFrames={fadeInFrames}
				/>
			)}
		</ColorGrade>
	);
};

export default Vignette;
