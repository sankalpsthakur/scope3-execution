import React, {useMemo} from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {THEME, THEME_EXTENDED, OPACITY, SPRING_CONFIGS, ANIMATION_DURATIONS} from '../theme';
import {GradientBackground} from '../shaders/GradientBackground';

export interface IntroSceneProps {
	title: string;
	subtitle: string;
}

interface HighlightProps {
	word: string;
	delay: number;
}

/**
 * Animated text highlight with expanding background and glow effect.
 * Uses spring animation for smooth reveal with premium glow.
 */
const Highlight: React.FC<HighlightProps> = React.memo(({word, delay}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();

	// Use bouncy spring for playful highlight reveal
	const progress = spring({
		fps,
		frame,
		config: SPRING_CONFIGS.bouncy,
		delay,
		durationInFrames: 20,
	});

	const scaleX = interpolate(progress, [0, 1], [0, 1], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});

	// Glow intensity follows progress
	const glowOpacity = interpolate(progress, [0, 0.5, 1], [0, 0.4, 0.25], {
		extrapolateRight: 'clamp',
	});

	return (
		<span style={{position: 'relative', display: 'inline-block'}}>
			{/* Outer glow layer */}
			<span
				style={{
					position: 'absolute',
					left: -8,
					right: -8,
					top: '50%',
					height: '1.4em',
					transform: `translateY(-50%) scaleX(${scaleX})`,
					transformOrigin: 'left center',
					background: `radial-gradient(ellipse 100% 100% at 50% 50%, ${THEME.greenGlow} 0%, transparent 70%)`,
					opacity: glowOpacity,
					filter: 'blur(8px)',
					zIndex: 0,
				}}
			/>
			{/* Main highlight background */}
			<span
				style={{
					position: 'absolute',
					left: -4,
					right: -4,
					top: '50%',
					height: '1.12em',
					transform: `translateY(-50%) scaleX(${scaleX})`,
					transformOrigin: 'left center',
					background: `linear-gradient(90deg, ${THEME.greenMuted} 0%, rgba(34,197,94,${OPACITY.light}) 100%)`,
					borderRadius: '0.2em',
					border: `1px solid rgba(34,197,94,${OPACITY.muted})`,
					zIndex: 0,
				}}
			/>
			{/* Text with subtle gradient */}
			<span
				style={{
					position: 'relative',
					zIndex: 1,
					background: `linear-gradient(135deg, ${THEME.green} 0%, #4ADE80 100%)`,
					WebkitBackgroundClip: 'text',
					WebkitTextFillColor: 'transparent',
					backgroundClip: 'text',
				}}
			>
				{word}
			</span>
		</span>
	);
});

interface InfoCardProps {
	label: string;
	title: string;
	description: string;
	delay?: number;
}

/**
 * Info card with glass morphism effect and staggered animation.
 * Features gradient border, subtle inner highlight, and premium entrance animation.
 */
const InfoCard: React.FC<InfoCardProps> = React.memo(({label, title, description, delay = 0}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();

	// Staggered entrance animation with default spring for balanced overshoot
	const appear = spring({
		fps,
		frame: frame - delay,
		config: SPRING_CONFIGS.default,
		durationInFrames: 24,
	});

	const opacity = interpolate(appear, [0, 0.4], [0, 1], {extrapolateRight: 'clamp'});
	const translateY = interpolate(appear, [0, 1], [32, 0], {extrapolateRight: 'clamp'});
	const scale = interpolate(appear, [0, 1], [0.92, 1], {extrapolateRight: 'clamp'});
	// Subtle rotation for organic entrance
	const rotate = interpolate(appear, [0, 1], [-1.2, 0], {extrapolateRight: 'clamp'});

	const cardStyles = useMemo(() => ({
		padding: THEME_EXTENDED.space.lg,
		borderRadius: THEME_EXTENDED.radius.xl,
		border: `1px solid ${THEME.borderMedium}`,
		// Glass morphism background with subtle gradient
		background: THEME_EXTENDED.gradient.cardSurface,
		backdropFilter: 'blur(12px)',
		width: 420,
		// Layered shadow for premium depth
		boxShadow: [
			THEME_EXTENDED.shadow.lg,
			`inset 0 1px 0 rgba(255,255,255,${OPACITY.light})`,
			`inset 0 -1px 0 rgba(0,0,0,${OPACITY.medium})`,
		].join(', '),
	}), []);

	const labelStyles = useMemo(() => ({
		display: 'inline-flex' as const,
		alignItems: 'center' as const,
		gap: 6,
		...THEME_EXTENDED.textStyles.labelSmall,
		color: THEME.green,
	}), []);

	const labelDotStyles = useMemo(() => ({
		width: 6,
		height: 6,
		borderRadius: THEME_EXTENDED.radius.pill,
		backgroundColor: THEME.green,
		boxShadow: `0 0 6px ${THEME.greenGlow}`,
	}), []);

	const titleStyles = useMemo(() => ({
		marginTop: THEME_EXTENDED.space.md,
		...THEME_EXTENDED.textStyles.h4,
		color: THEME.text,
	}), []);

	const descStyles = useMemo(() => ({
		marginTop: THEME_EXTENDED.space.sm,
		...THEME_EXTENDED.textStyles.body,
		color: THEME.textTertiary,
	}), []);

	return (
		<div
			style={{
				...cardStyles,
				opacity,
				transform: `translateY(${translateY}px) scale(${scale}) rotate(${rotate}deg)`,
			}}
		>
			<div style={labelStyles}>
				<span style={labelDotStyles} />
				{label}
			</div>
			<div style={titleStyles}>{title}</div>
			<div style={descStyles}>{description}</div>
		</div>
	);
});

/**
 * Introduction scene with animated title, info cards, and premium vignette background.
 * First scene in the highlight reel establishing the product value props.
 */
export const IntroScene: React.FC<IntroSceneProps> = ({title, subtitle}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();

	// Main container entrance with gentle spring for smooth reveal
	const springProgress = spring({
		fps,
		frame,
		config: SPRING_CONFIGS.gentle,
		durationInFrames: ANIMATION_DURATIONS.slow,
	});
	const opacity = interpolate(frame, [0, 14], [0, 1], {extrapolateRight: 'clamp'});
	const translateY = interpolate(springProgress, [0, 1], [24, 0]);

	// Memoize container styles
	const containerStyles = useMemo(() => ({
		backgroundColor: THEME.bg,
		color: THEME.text,
		fontFamily: THEME_EXTENDED.fonts.heading,
		padding: THEME_EXTENDED.space['4xl'],
		boxSizing: 'border-box' as const,
	}), []);

	const badgeStyles = useMemo(() => ({
		display: 'inline-flex' as const,
		alignItems: 'center' as const,
		gap: 10,
		padding: '10px 18px',
		borderRadius: THEME_EXTENDED.radius.pill,
		border: `1px solid ${THEME.borderMedium}`,
		background: THEME_EXTENDED.gradient.glassLight,
		color: THEME.textSecondary,
		...THEME_EXTENDED.textStyles.button,
		boxShadow: [
			THEME_EXTENDED.shadow.sm,
			`inset 0 1px 0 rgba(255,255,255,${OPACITY.subtle})`,
		].join(', '),
	}), []);

	const titleStyles = useMemo(() => ({
		marginTop: THEME_EXTENDED.space.lg,
		...THEME_EXTENDED.textStyles.displayLarge,
		color: THEME.text,
	}), []);

	const subtitleStyles = useMemo(() => ({
		marginTop: THEME_EXTENDED.space.lg,
		...THEME_EXTENDED.textStyles.bodyLarge,
		color: THEME.textTertiary,
		maxWidth: 1000,
	}), []);

	// Determine if title needs highlight animation
	const shouldHighlight = !title.includes('Evidence');

	return (
		<AbsoluteFill style={containerStyles}>
			{/* Background: shader-based gradient with safe CSS fallback (no @remotion/three in render pipeline) */}
			<GradientBackground
				accentColor={THEME.green}
				glowIntensity={0.55}
				speed={0.9}
				zIndex={0}
			/>

			{/* Background vignette for depth */}
			<div
				style={{
					position: 'absolute',
					inset: 0,
					background: THEME_EXTENDED.gradient.bgVignette,
					pointerEvents: 'none',
					zIndex: 1,
				}}
			/>

			{/* Subtle top-left accent glow */}
			<div
				style={{
					position: 'absolute',
					left: -200,
					top: -200,
					width: 600,
					height: 600,
					background: `radial-gradient(circle, ${THEME.greenGlow} 0%, transparent 60%)`,
					opacity: 0.3,
					pointerEvents: 'none',
					filter: 'blur(60px)',
					zIndex: 1,
				}}
			/>

			<div style={{opacity, transform: `translateY(${translateY}px)`, position: 'relative', zIndex: 2}}>
				{/* Demo badge */}
				<div style={badgeStyles}>
					<span
						style={{
							width: 8,
							height: 8,
							borderRadius: THEME_EXTENDED.radius.pill,
							backgroundColor: THEME.green,
							boxShadow: `0 0 8px ${THEME.greenGlow}`,
						}}
					/>
					Vendor outreach demo
				</div>

				{/* Title with optional highlight */}
				<div style={titleStyles}>
					{shouldHighlight ? (
						<>
							Scope3: <Highlight word="Evidence-First" delay={12} /> MRV
						</>
					) : (
						title
					)}
				</div>

				{/* Subtitle */}
				<div style={subtitleStyles}>{subtitle}</div>

				{/* Info cards with staggered animation - increased stagger for dramatic effect */}
				<div style={{marginTop: THEME_EXTENDED.space['3xl'], display: 'flex', gap: THEME_EXTENDED.space.xl}}>
					<InfoCard
						label="GUARDRAIL"
						title="LLM orchestrates only"
						description="Never invent numbers. Every KPI links to evidence."
						delay={22}
					/>
					<InfoCard
						label="OUTCOME"
						title="Audit-ready workflows"
						description="Provenance + anomalies + period locks."
						delay={32}
					/>
				</div>
			</div>
		</AbsoluteFill>
	);
};
