/**
 * GlowEffect - Bloom/glow shader for emphasizing key elements.
 *
 * Creates a bloom/glow effect that can be applied around specific
 * elements or as an overlay for the entire scene.
 *
 * Features:
 * - Configurable glow color and intensity
 * - Pulsing animation option
 * - Multiple glow modes (radial, linear)
 * - Frame-synced for video rendering
 */
import React, {useMemo} from 'react';
import {useCurrentFrame, useVideoConfig, AbsoluteFill, interpolate} from 'remotion';
import {THEME} from '../theme';

// Convert hex to rgba with alpha
const hexToRgba = (hex: string, alpha: number): string => {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	if (!result) return `rgba(34,197,94,${alpha})`; // Default green
	return `rgba(${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)},${alpha})`;
};

type GlowMode = 'radial' | 'linear-top' | 'linear-bottom' | 'corner-tl' | 'corner-tr' | 'corner-bl' | 'corner-br';

interface GlowEffectProps {
	/** Glow color (default: theme green) */
	color?: string;
	/** Base intensity 0-1 (default: 0.3) */
	intensity?: number;
	/** Enable pulsing animation (default: true) */
	pulse?: boolean;
	/** Pulse speed in Hz (default: 0.5) */
	pulseSpeed?: number;
	/** Pulse depth 0-1 (default: 0.3) */
	pulseDepth?: number;
	/** Glow spread mode (default: 'corner-tl') */
	mode?: GlowMode;
	/** Glow radius as percentage (default: 60) */
	radius?: number;
	/** Blur amount in pixels (default: 60) */
	blur?: number;
	/** Fade in duration in frames (default: 20) */
	fadeInFrames?: number;
	/** Optional center position override [x%, y%] */
	position?: [number, number];
	/** Optional style overrides */
	style?: React.CSSProperties;
	/** Z-index for layering (default: 0) */
	zIndex?: number;
}

/**
 * Glow effect overlay for adding bloom/glow to scenes.
 * Uses CSS for broad compatibility with configurable shader-like parameters.
 */
export const GlowEffect: React.FC<GlowEffectProps> = ({
	color = THEME.green,
	intensity = 0.3,
	pulse = true,
	pulseSpeed = 0.5,
	pulseDepth = 0.3,
	mode = 'corner-tl',
	radius = 60,
	blur = 60,
	fadeInFrames = 20,
	position,
	style,
	zIndex = 0,
}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const time = frame / fps;

	// Fade in
	const fadeOpacity = interpolate(frame, [0, fadeInFrames], [0, 1], {
		extrapolateRight: 'clamp',
	});

	// Pulsing animation
	const pulseMultiplier = pulse
		? 1 - pulseDepth + pulseDepth * Math.sin(time * pulseSpeed * Math.PI * 2) * 0.5 + 0.5
		: 1;

	const finalIntensity = intensity * pulseMultiplier * fadeOpacity;

	// Calculate gradient position based on mode
	const gradientPosition = useMemo(() => {
		if (position) {
			return `${position[0]}% ${position[1]}%`;
		}

		switch (mode) {
			case 'radial':
				return '50% 50%';
			case 'linear-top':
				return '50% 0%';
			case 'linear-bottom':
				return '50% 100%';
			case 'corner-tl':
				return '0% 0%';
			case 'corner-tr':
				return '100% 0%';
			case 'corner-bl':
				return '0% 100%';
			case 'corner-br':
				return '100% 100%';
			default:
				return '20% 20%';
		}
	}, [mode, position]);

	// Build gradient
	const gradient = useMemo(() => {
		const glowColor = hexToRgba(color, finalIntensity);
		const transparent = hexToRgba(color, 0);

		if (mode.startsWith('linear')) {
			const direction = mode === 'linear-top' ? '180deg' : '0deg';
			return `linear-gradient(${direction}, ${glowColor} 0%, ${transparent} ${radius}%)`;
		}

		return `radial-gradient(ellipse ${radius}% ${radius}% at ${gradientPosition}, ${glowColor} 0%, ${transparent} 70%)`;
	}, [color, finalIntensity, mode, radius, gradientPosition]);

	return (
		<AbsoluteFill
			style={{
				zIndex,
				pointerEvents: 'none',
				background: gradient,
				filter: `blur(${blur}px)`,
				...style,
			}}
		/>
	);
};

interface MultiGlowProps {
	/** Array of glow configurations */
	glows: Omit<GlowEffectProps, 'zIndex'>[];
	/** Base z-index (default: 0) */
	zIndex?: number;
}

/**
 * Multiple glow effects combined for complex lighting setups.
 */
export const MultiGlow: React.FC<MultiGlowProps> = ({
	glows,
	zIndex = 0,
}) => {
	return (
		<>
			{glows.map((glow, index) => (
				<GlowEffect key={index} {...glow} zIndex={zIndex + index} />
			))}
		</>
	);
};

interface AccentGlowProps {
	/** Preset: 'dark' for dark theme, 'light' for light theme */
	preset?: 'dark' | 'light';
	/** Override intensity (default: preset-based) */
	intensity?: number;
	/** Enable pulsing (default: true) */
	pulse?: boolean;
	/** Z-index (default: 0) */
	zIndex?: number;
}

/**
 * Pre-configured accent glow for quick setup.
 * Dark preset: green glow at top-left.
 * Light preset: subtle warm glow.
 */
export const AccentGlow: React.FC<AccentGlowProps> = ({
	preset = 'dark',
	intensity,
	pulse = true,
	zIndex = 0,
}) => {
	if (preset === 'dark') {
		return (
			<MultiGlow
				zIndex={zIndex}
				glows={[
					{
						color: THEME.green,
						intensity: intensity ?? 0.25,
						mode: 'corner-tl',
						radius: 50,
						blur: 80,
						pulse,
						pulseSpeed: 0.3,
						pulseDepth: 0.2,
					},
					{
						color: THEME.sky,
						intensity: (intensity ?? 0.25) * 0.5,
						mode: 'corner-br',
						radius: 40,
						blur: 100,
						pulse,
						pulseSpeed: 0.4,
						pulseDepth: 0.15,
						fadeInFrames: 40,
					},
				]}
			/>
		);
	}

	// Light preset
	return (
		<MultiGlow
			zIndex={zIndex}
			glows={[
				{
					color: '#E07A5F', // Warm accent
					intensity: intensity ?? 0.1,
					mode: 'corner-tr',
					radius: 60,
					blur: 100,
					pulse,
					pulseSpeed: 0.25,
					pulseDepth: 0.15,
				},
				{
					color: '#1A4D2E', // Primary green
					intensity: (intensity ?? 0.1) * 0.6,
					mode: 'corner-bl',
					radius: 50,
					blur: 120,
					pulse,
					pulseSpeed: 0.35,
					pulseDepth: 0.1,
					fadeInFrames: 30,
				},
			]}
		/>
	);
};

export default GlowEffect;
