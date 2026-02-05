import React, {useMemo} from 'react';
import {AbsoluteFill, Sequence, useVideoConfig} from 'remotion';
import {loadFont} from '@remotion/google-fonts/Inter';

import type {HighlightReelProps} from '../root';
import {THEME_EXTENDED} from '../theme';
import {IntroScene} from './IntroScene';
import {IntegrationsScene} from './IntegrationsScene';
import {MeasureToEvidenceScene} from './MeasureToEvidenceScene';
import {EvidenceOcrScene} from './EvidenceOcrScene';
import {QualityLocksScene} from './QualityLocksScene';

/**
 * Load Inter font with all required weights for video typography.
 * Weights used across the project:
 * - 400: Body text
 * - 500: Medium emphasis
 * - 600: Semibold (chips, labels)
 * - 700: Bold (titles, buttons)
 * - 800: Extrabold (headings)
 * - 900: Black (display text)
 */
const {fontFamily} = loadFont('normal', {
	weights: ['400', '500', '600', '700', '800', '900'],
});

/**
 * Scene timing configuration in seconds.
 * Centralized for easy adjustment of video pacing.
 */
const SCENE_TIMING_SECONDS = {
	intro: 3,
	integrations: 4,
	measure: 4,
	evidence: 5,
	qualityLocks: 6,
} as const;

type SceneName = keyof typeof SCENE_TIMING_SECONDS;

/**
 * Hook to calculate scene frame timings based on fps.
 * Returns both individual durations and cumulative start frames.
 */
function useSceneTimings() {
	const {fps} = useVideoConfig();

	return useMemo(() => {
		const durations: Record<SceneName, number> = {
			intro: SCENE_TIMING_SECONDS.intro * fps,
			integrations: SCENE_TIMING_SECONDS.integrations * fps,
			measure: SCENE_TIMING_SECONDS.measure * fps,
			evidence: SCENE_TIMING_SECONDS.evidence * fps,
			qualityLocks: SCENE_TIMING_SECONDS.qualityLocks * fps,
		};

		// Calculate cumulative start frames
		const startFrames: Record<SceneName, number> = {
			intro: 0,
			integrations: durations.intro,
			measure: durations.intro + durations.integrations,
			evidence: durations.intro + durations.integrations + durations.measure,
			qualityLocks: durations.intro + durations.integrations + durations.measure + durations.evidence,
		};

		return {durations, startFrames};
	}, [fps]);
}

/**
 * Main highlight reel composition.
 * Orchestrates all scenes with proper timing and transitions.
 */
export const HighlightReel: React.FC<HighlightReelProps> = ({title, subtitle}) => {
	const {durations, startFrames} = useSceneTimings();

	// Text rendering optimizations for video quality
	const rootStyles = useMemo(() => ({
		fontFamily,
		...THEME_EXTENDED.textRendering,
	}), []);

	return (
		<AbsoluteFill style={rootStyles}>
			<Sequence
				name="Intro"
				from={startFrames.intro}
				durationInFrames={durations.intro}
			>
				<IntroScene title={title} subtitle={subtitle} />
			</Sequence>

			<Sequence
				name="Integrations"
				from={startFrames.integrations}
				durationInFrames={durations.integrations}
			>
				<IntegrationsScene />
			</Sequence>

			<Sequence
				name="MeasureToEvidence"
				from={startFrames.measure}
				durationInFrames={durations.measure}
			>
				<MeasureToEvidenceScene />
			</Sequence>

			<Sequence
				name="EvidenceOcr"
				from={startFrames.evidence}
				durationInFrames={durations.evidence}
			>
				<EvidenceOcrScene />
			</Sequence>

			<Sequence
				name="QualityLocks"
				from={startFrames.qualityLocks}
				durationInFrames={durations.qualityLocks}
			>
				<QualityLocksScene />
			</Sequence>
		</AbsoluteFill>
	);
};

