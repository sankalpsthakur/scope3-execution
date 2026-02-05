import React, {useMemo} from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {THEME, THEME_EXTENDED, TOAST_TONES, SPRING_CONFIGS, type ToastTone} from '../theme';

// Re-export ToastTone for consumers
export type {ToastTone};

export interface ToastProps {
	text: string;
	startFrame: number;
	durationInFrames: number;
	/**
	 * Semantic tone for the toast.
	 * - 'success' - positive/completed actions (green)
	 * - 'warning' - caution/attention needed (amber)
	 * - 'error' - failed/destructive actions (red)
	 * - 'info' - informational/neutral (sky blue)
	 */
	tone?: ToastTone;
}

/**
 * Get toast configuration from unified TOAST_TONES.
 * Extends with background tint, glow, and icon.
 */
const getToastConfig = (tone: ToastTone) => {
	const color = TOAST_TONES[tone] ?? TOAST_TONES.info;

	// Map colors to config
	const configs: Record<string, { bgTint: string; glow: string; icon: string }> = {
		[THEME.green]: {
			bgTint: 'rgba(34,197,94,0.08)',
			glow: THEME_EXTENDED.glow.greenSubtle,
			icon: '\u2713', // Checkmark
		},
		[THEME.amber]: {
			bgTint: 'rgba(245,158,11,0.08)',
			glow: THEME_EXTENDED.glow.amber,
			icon: '\u26A0', // Warning
		},
		[THEME.red]: {
			bgTint: 'rgba(239,68,68,0.08)',
			glow: THEME_EXTENDED.glow.red,
			icon: '\u2717', // X mark
		},
		[THEME.sky]: {
			bgTint: 'rgba(14,165,233,0.08)',
			glow: THEME_EXTENDED.glow.skySubtle,
			icon: '\u2139', // Info symbol
		},
	};

	const extra = configs[color] ?? configs[THEME.sky];
	return { color, ...extra };
};

/**
 * Animated toast notification component with premium glass morphism effect.
 * Uses unified TOAST_TONES from theme for cross-repo consistency.
 * Features tone-specific icons, layered shadows, and smooth spring animations.
 */
export const Toast: React.FC<ToastProps> = React.memo(({
	text,
	startFrame,
	durationInFrames,
	tone = 'info',
}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();

	const localFrame = frame - startFrame;
	const isVisible = localFrame >= 0 && localFrame <= durationInFrames;
	const clampedFrame = Math.max(0, Math.min(durationInFrames, localFrame));

	// Enter animation with snappy spring
	const enterProgress = spring({
		fps,
		frame: clampedFrame,
		config: SPRING_CONFIGS.snappy,
		durationInFrames: 14,
	});

	// Exit animation (starts near the end of duration)
	const exitStartFrame = Math.max(0, durationInFrames - 16);
	const exitProgress = spring({
		fps,
		frame: clampedFrame - exitStartFrame,
		config: SPRING_CONFIGS.default,
		durationInFrames: 16,
	});

	const enterOpacity = interpolate(enterProgress, [0, 1], [0, 1], {extrapolateRight: 'clamp'});
	const exitOpacity = interpolate(exitProgress, [0, 1], [1, 0], {extrapolateRight: 'clamp'});
	const opacity = enterOpacity * exitOpacity;

	const translateY = interpolate(enterProgress, [0, 1], [20, 0], {extrapolateRight: 'clamp'});
	const scale = interpolate(enterProgress, [0, 1], [0.95, 1], {extrapolateRight: 'clamp'});

	const config = getToastConfig(tone);

	// Container with glass morphism effect
	const containerStyles = useMemo(() => ({
		position: 'absolute' as const,
		right: THEME_EXTENDED.space.xl,
		bottom: THEME_EXTENDED.space.xl,
		padding: '14px 18px',
		borderRadius: THEME_EXTENDED.radius.lg,
		border: `1px solid ${THEME.borderMedium}`,
		background: `linear-gradient(135deg, rgba(24,24,26,0.95) 0%, rgba(18,18,20,0.98) 100%)`,
		backdropFilter: 'blur(16px)',
		color: THEME.text,
		fontSize: THEME_EXTENDED.fontSize.base,
		fontWeight: THEME_EXTENDED.fontWeight.semibold,
		display: 'flex' as const,
		alignItems: 'center' as const,
		gap: 12,
		boxShadow: [
			THEME_EXTENDED.shadow.xl,
			config.glow,
			`inset 0 1px 0 rgba(255,255,255,0.06)`,
		].join(', '),
	}), [config.glow]);

	// Icon container with tinted background
	const iconContainerStyles = useMemo(() => ({
		width: 24,
		height: 24,
		borderRadius: THEME_EXTENDED.radius.sm,
		backgroundColor: config.bgTint,
		border: `1px solid ${config.color}20`,
		display: 'flex' as const,
		alignItems: 'center' as const,
		justifyContent: 'center' as const,
		fontSize: THEME_EXTENDED.fontSize.sm,
		fontWeight: THEME_EXTENDED.fontWeight.bold,
		color: config.color,
		flexShrink: 0,
	}), [config]);

	if (!isVisible) return null;

	return (
		<div
			style={{
				...containerStyles,
				opacity,
				transform: `translateY(${translateY}px) scale(${scale})`,
			}}
		>
			{/* Icon */}
			<span style={iconContainerStyles}>{config.icon}</span>
			{/* Text */}
			<span style={{letterSpacing: -0.2}}>{text}</span>
			{/* Progress indicator line - thicker and more visible */}
			<div
				style={{
					position: 'absolute',
					bottom: 0,
					left: 0,
					right: 0,
					height: 3,
					backgroundColor: 'rgba(255,255,255,0.06)',
					borderBottomLeftRadius: THEME_EXTENDED.radius.lg,
					borderBottomRightRadius: THEME_EXTENDED.radius.lg,
					overflow: 'hidden',
				}}
			>
				<div
					style={{
						height: '100%',
						backgroundColor: config.color,
						opacity: 0.6,
						transform: `scaleX(${1 - (clampedFrame / durationInFrames)})`,
						transformOrigin: 'left',
						boxShadow: `0 0 8px ${config.color}60`,
					}}
				/>
			</div>
		</div>
	);
});
