import React, {useMemo} from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {THEME_EXTENDED, SPRING_CONFIGS} from '../theme';

export interface CursorProps {
	x: number;
	y: number;
	enterFrame?: number;
	exitFrame?: number;
	/** Frame when click animation should trigger */
	clickFrame?: number;
}

/**
 * Animated cursor pointer for demonstrating UI interactions.
 * Features smooth enter/exit transitions and optional click ripple effect.
 */
export const Cursor: React.FC<CursorProps> = React.memo(({
	x,
	y,
	enterFrame = 0,
	exitFrame,
	clickFrame,
}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();

	const localFrame = frame - enterFrame;

	// Entrance animation with precise spring (minimal overshoot for cursor)
	const appear = spring({
		fps,
		frame: localFrame,
		config: SPRING_CONFIGS.precise,
		durationInFrames: 14,
	});

	// Click animation (if clickFrame is provided) - snappy for responsive feel
	const clickLocalFrame = clickFrame != null ? frame - clickFrame : -100;
	const clickProgress = spring({
		fps,
		frame: clickLocalFrame,
		config: SPRING_CONFIGS.snappy,
		durationInFrames: 20,
	});

	// Use interpolate with clamp for cleaner bounds handling
	const baseOpacity = interpolate(appear, [0, 1], [0, 1], {extrapolateRight: 'clamp'});
	const opacity = exitFrame != null && frame >= exitFrame ? 0 : baseOpacity;

	// Scale with subtle click press effect
	const baseScale = interpolate(appear, [0, 1], [0.9, 1], {extrapolateRight: 'clamp'});
	const clickScale = clickFrame != null && clickLocalFrame >= 0 && clickLocalFrame < 8
		? interpolate(clickLocalFrame, [0, 4, 8], [1, 0.92, 1])
		: 1;
	const scale = baseScale * clickScale;

	// Click ripple opacity and scale
	const rippleOpacity = interpolate(clickProgress, [0, 0.3, 1], [0.6, 0.3, 0], {extrapolateRight: 'clamp'});
	const rippleScale = interpolate(clickProgress, [0, 1], [0.5, 2.5], {extrapolateRight: 'clamp'});

	// Memoize static cursor styles
	const cursorStyles = useMemo(() => ({
		position: 'absolute' as const,
		width: 24,
		height: 24,
		borderRadius: 4,
		backgroundColor: '#FFFFFF',
		boxShadow: [
			'0 2px 4px rgba(0,0,0,0.2)',
			'0 8px 24px rgba(0,0,0,0.4)',
			'inset 0 -1px 0 rgba(0,0,0,0.1)',
		].join(', '),
		clipPath: 'polygon(0 0, 0 100%, 32% 78%, 58% 100%, 76% 92%, 54% 70%, 100% 70%)',
		transformOrigin: 'left top' as const,
	}), []);

	// Ripple effect styles
	const rippleStyles = useMemo(() => ({
		position: 'absolute' as const,
		width: 20,
		height: 20,
		borderRadius: THEME_EXTENDED.radius.pill,
		backgroundColor: 'rgba(255,255,255,0.5)',
		pointerEvents: 'none' as const,
	}), []);

	// Don't render before enter frame
	if (localFrame < 0) return null;

	return (
		<>
			{/* Click ripple effect */}
			{clickFrame != null && clickLocalFrame >= 0 && clickProgress < 1 && (
				<div
					style={{
						...rippleStyles,
						left: x - 10,
						top: y - 10,
						transform: `scale(${rippleScale})`,
						opacity: rippleOpacity * opacity,
					}}
				/>
			)}

			{/* Main cursor */}
			<div
				style={{
					...cursorStyles,
					left: x,
					top: y,
					transform: `translate(-2px, -2px) scale(${scale})`,
					opacity,
				}}
			/>
		</>
	);
});

