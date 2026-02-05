/**
 * EnhancedSceneExample - Demonstrates shader integration for dark theme.
 *
 * This example shows how to layer shader effects to create a polished,
 * cinematic look for Remotion videos with the dark theme.
 */
import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring} from 'remotion';
import {THEME, THEME_EXTENDED} from '../../theme';
import {
	GradientBackground,
	NoiseOverlay,
	ParticleField,
	AccentGlow,
	Vignette,
	PostProcessingPreset,
} from '../index';

interface EnhancedSceneProps {
	title: string;
	subtitle?: string;
}

/**
 * Example scene with all shader effects layered properly.
 * Order matters for visual stacking:
 * 1. GradientBackground (base layer)
 * 2. AccentGlow (ambient lighting)
 * 3. ParticleField (atmospheric depth)
 * 4. PostProcessingPreset wrapping content
 * 5. NoiseOverlay (film grain - on top)
 * 6. Vignette (final touch)
 */
export const EnhancedSceneExample: React.FC<EnhancedSceneProps> = ({
	title,
	subtitle,
}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();

	// Animated entrance
	const titleProgress = spring({
		fps,
		frame,
		config: {damping: 200, mass: 0.8, stiffness: 120},
		durationInFrames: 30,
	});

	const titleOpacity = interpolate(titleProgress, [0, 1], [0, 1]);
	const titleY = interpolate(titleProgress, [0, 1], [30, 0]);

	const subtitleProgress = spring({
		fps,
		frame: frame - 10,
		config: {damping: 200, mass: 0.8, stiffness: 120},
		durationInFrames: 30,
	});

	const subtitleOpacity = interpolate(subtitleProgress, [0, 1], [0, 1]);

	return (
		<AbsoluteFill>
			{/* Layer 1: Animated gradient background */}
			<GradientBackground
				bgColor={THEME.bg}
				subtleColor={THEME.bgSubtle}
				accentColor={THEME.green}
				glowIntensity={0.5}
				speed={0.8}
			/>

			{/* Layer 2: Ambient accent glow */}
			<AccentGlow preset="dark" intensity={0.25} pulse />

			{/* Layer 3: Floating particles for depth */}
			<ParticleField
				count={60}
				color={THEME.green}
				minSize={2}
				maxSize={5}
				minOpacity={0.1}
				maxOpacity={0.35}
				speed={1.2}
				fadeInFrames={45}
			/>

			{/* Layer 4: Scene content with color grading */}
			<PostProcessingPreset
				preset="cinematic-dark"
				intensity={0.8}
				includeVignette={false}
				fadeInFrames={20}
			>
				<AbsoluteFill
					style={{
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						justifyContent: 'center',
						fontFamily: THEME_EXTENDED.fonts.heading,
					}}
				>
					{/* Title with animated entrance */}
					<div
						style={{
							fontSize: 72,
							fontWeight: 900,
							letterSpacing: -2,
							color: THEME.text,
							opacity: titleOpacity,
							transform: `translateY(${titleY}px)`,
							textShadow: `0 0 60px ${THEME.greenGlow}`,
						}}
					>
						{title}
					</div>

					{/* Subtitle */}
					{subtitle && (
						<div
							style={{
								marginTop: 24,
								fontSize: 24,
								fontWeight: 500,
								color: THEME.textTertiary,
								opacity: subtitleOpacity,
							}}
						>
							{subtitle}
						</div>
					)}

					{/* Glowing accent bar */}
					<div
						style={{
							marginTop: 48,
							width: 120,
							height: 4,
							borderRadius: 2,
							background: `linear-gradient(90deg, transparent 0%, ${THEME.green} 50%, transparent 100%)`,
							opacity: titleOpacity,
							boxShadow: `0 0 20px ${THEME.greenGlow}`,
						}}
					/>
				</AbsoluteFill>
			</PostProcessingPreset>

			{/* Layer 5: Film grain overlay */}
			<NoiseOverlay
				intensity={0.06}
				blendMode="overlay"
				fadeInFrames={30}
			/>

			{/* Layer 6: Vignette for focus */}
			<Vignette
				intensity={0.45}
				radiusX={75}
				radiusY={55}
				fadeInFrames={20}
			/>
		</AbsoluteFill>
	);
};

/**
 * Minimal shader setup for performance-critical scenes.
 * Uses only essential effects for a clean look.
 */
export const MinimalEnhancedScene: React.FC<EnhancedSceneProps> = ({
	title,
	subtitle,
}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();

	const progress = spring({
		fps,
		frame,
		config: {damping: 200},
		durationInFrames: 24,
	});

	return (
		<AbsoluteFill style={{backgroundColor: THEME.bg}}>
			{/* Simple glow without WebGL */}
			<AccentGlow preset="dark" intensity={0.2} pulse={false} />

			{/* Content */}
			<AbsoluteFill
				style={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					fontFamily: THEME_EXTENDED.fonts.heading,
				}}
			>
				<div
					style={{
						fontSize: 64,
						fontWeight: 800,
						color: THEME.text,
						opacity: interpolate(progress, [0, 1], [0, 1]),
						transform: `scale(${interpolate(progress, [0, 1], [0.95, 1])})`,
					}}
				>
					{title}
				</div>
			</AbsoluteFill>

			{/* Light vignette */}
			<Vignette intensity={0.3} />
		</AbsoluteFill>
	);
};

export default EnhancedSceneExample;
