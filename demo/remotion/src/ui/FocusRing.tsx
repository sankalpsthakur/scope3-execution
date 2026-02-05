import React, {useMemo} from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {THEME, THEME_EXTENDED, SPRING_CONFIGS, OPACITY} from '../theme';

export interface FocusRingProps {
	x: number;
	y: number;
	w: number;
	h: number;
	startFrame: number;
	durationInFrames: number;
	color?: string;
	/** Enable pulsing glow animation */
	pulse?: boolean;
}

/**
 * Get glow configuration for a given color.
 * Returns layered shadows for a premium focus effect.
 * Uses consistent opacity scale: strong (0.16), light (0.08), subtle (0.04)
 */
const getGlowConfig = (color: string) => {
	// Color mappings with consistent opacity layering
	const configs: Record<string, { rgb: string; glow: string }> = {
		[THEME.green]: { rgb: '34,197,94', glow: THEME_EXTENDED.glow.green },
		[THEME.sky]: { rgb: '14,165,233', glow: THEME_EXTENDED.glow.sky },
		[THEME.red]: { rgb: '239,68,68', glow: THEME_EXTENDED.glow.red },
		[THEME.amber]: { rgb: '245,158,11', glow: THEME_EXTENDED.glow.amber },
	};

	const config = configs[color] ?? configs[THEME.green];

	return {
		inner: `rgba(${config.rgb},0.20)`, // Enhanced inner ring
		mid: `rgba(${config.rgb},0.12)`, // Enhanced mid spread
		outer: `rgba(${config.rgb},0.06)`, // Enhanced outer spread
		glow: config.glow,
	};
};

/**
 * Animated focus ring that highlights UI elements.
 * Features layered glow effects and optional pulse animation for premium feel.
 */
export const FocusRing: React.FC<FocusRingProps> = React.memo(({
	x,
	y,
	w,
	h,
	startFrame,
	durationInFrames,
	color = THEME.green,
	pulse = true,
}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();

	const localFrame = frame - startFrame;

	// Main entrance animation with bouncy spring for natural overshoot
	const enterProgress = spring({
		fps,
		frame: localFrame,
		config: SPRING_CONFIGS.bouncy,
		durationInFrames: Math.min(durationInFrames, 18),
	});

	// Exit animation with default spring for smooth settle
	const exitStartFrame = Math.max(0, durationInFrames - 12);
	const exitProgress = spring({
		fps,
		frame: localFrame - exitStartFrame,
		config: SPRING_CONFIGS.default,
		durationInFrames: 12,
	});

	// Subtle pulse animation for glow intensity
	const pulsePhase = pulse ? Math.sin((localFrame / fps) * Math.PI * 2.5) * 0.15 + 0.85 : 1;

	const enterOpacity = interpolate(enterProgress, [0, 1], [0, 1], {extrapolateRight: 'clamp'});
	const exitOpacity = interpolate(exitProgress, [0, 1], [1, 0], {extrapolateRight: 'clamp'});
	const opacity = enterOpacity * exitOpacity;

	const scale = interpolate(enterProgress, [0, 1], [0.96, 1], {extrapolateRight: 'clamp'});

	// Get color-specific glow configuration
	const glowConfig = useMemo(() => getGlowConfig(color), [color]);

	// Build layered box shadow for premium depth
	const boxShadow = useMemo(() => {
		return [
			// Inner glow ring
			`0 0 0 4px ${glowConfig.inner}`,
			// Mid glow spread
			`0 0 0 8px ${glowConfig.mid}`,
			// Outer subtle spread
			`0 0 0 14px ${glowConfig.outer}`,
			// Ambient glow
			glowConfig.glow,
			// Drop shadow for depth
			THEME_EXTENDED.shadow.xl,
		].join(', ');
	}, [glowConfig]);

	// Early return if not visible yet
	if (localFrame < 0) return null;

	return (
		<>
			{/* Main focus ring */}
			<div
				style={{
					position: 'absolute',
					left: x,
					top: y,
					width: w,
					height: h,
					transform: `scale(${scale})`,
					transformOrigin: 'center',
					borderRadius: THEME_EXTENDED.radius.lg,
					border: `2px solid ${color}`,
					boxShadow,
					opacity: opacity * pulsePhase,
					pointerEvents: 'none',
				}}
			/>
			{/* Inner highlight line for depth */}
			<div
				style={{
					position: 'absolute',
					left: x + 1,
					top: y + 1,
					width: w - 2,
					height: h - 2,
					transform: `scale(${scale})`,
					transformOrigin: 'center',
					borderRadius: THEME_EXTENDED.radius.lg - 1,
					border: `1px solid rgba(255,255,255,${OPACITY.light})`,
					opacity: opacity * 0.6,
					pointerEvents: 'none',
				}}
			/>
		</>
	);
});

