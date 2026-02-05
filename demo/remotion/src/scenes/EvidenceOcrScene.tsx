import React, {useMemo} from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {AppFrame} from '../ui/AppFrame';
import {Cursor} from '../ui/Cursor';
import {FocusRing} from '../ui/FocusRing';
import {Toast} from '../ui/Toast';
import {THEME, THEME_EXTENDED, OPACITY, SPRING_CONFIGS, LAYOUT, ANIMATION_DURATIONS} from '../theme';

interface PanelProps {
	x: number;
	y: number;
	w: number;
	h: number;
	title: string;
	children: React.ReactNode;
}

/**
 * Reusable panel component with title header.
 * Used for content sections within scenes.
 */
const Panel: React.FC<PanelProps> = React.memo(({x, y, w, h, title, children}) => {
	const containerStyles = useMemo(() => ({
		position: 'absolute' as const,
		left: x,
		top: y,
		width: w,
		height: h,
		borderRadius: THEME_EXTENDED.radius.lg,
		border: `1px solid ${THEME.border}`,
		backgroundColor: THEME.panel,
		padding: THEME_EXTENDED.space.md,
		boxSizing: 'border-box' as const,
	}), [x, y, w, h]);

	const titleStyles = useMemo(() => ({
		color: THEME.muted,
		...THEME_EXTENDED.textStyles.label,
	}), []);

	return (
		<div style={containerStyles}>
			<div style={titleStyles}>{title}</div>
			<div style={{marginTop: 12}}>{children}</div>
		</div>
	);
});

type ButtonTone = 'primary' | 'secondary';

interface ButtonLikeProps {
	label: string;
	tone?: ButtonTone;
}

/**
 * Button-like visual element (not interactive, for demo purposes).
 */
const ButtonLike: React.FC<ButtonLikeProps> = React.memo(({label, tone = 'secondary'}) => {
	const styles = useMemo(() => ({
		padding: '10px 14px',
		borderRadius: THEME_EXTENDED.radius.md,
		border: tone === 'primary' ? 'none' : `1px solid ${THEME.border}`,
		background: tone === 'primary' ? THEME_EXTENDED.gradient.buttonPrimary : `rgba(255,255,255,${OPACITY.subtle})`,
		color: tone === 'primary' ? '#000000' : THEME.textSecondary,
		...THEME_EXTENDED.textStyles.buttonSmall,
		display: 'inline-flex' as const,
		alignItems: 'center' as const,
		justifyContent: 'center' as const,
		boxShadow: tone === 'primary' ? THEME_EXTENDED.glow.greenSubtle : undefined,
	}), [tone]);

	return <div style={styles}>{label}</div>;
});

interface OcrBoundingBox {
	x: number;
	y: number;
	width: number;
	height: number;
}

interface OcrBoxProps {
	box: OcrBoundingBox;
	opacity: number;
}

/**
 * OCR bounding box visualization.
 * Uses sky/info color with consistent opacity scale.
 */
const OcrBox: React.FC<OcrBoxProps> = React.memo(({box, opacity}) => {
	const styles = useMemo(() => ({
		position: 'absolute' as const,
		left: box.x,
		top: box.y,
		width: box.width,
		height: box.height,
		borderRadius: THEME_EXTENDED.radius.sm,
		border: `2px solid ${THEME.sky}`,
		backgroundColor: THEME.skyMuted,
		opacity,
	}), [box, opacity]);

	return <div style={styles} />;
});

/** OCR bounding boxes detected in the document */
const OCR_BOXES: OcrBoundingBox[] = [
	{x: 64, y: 120, width: 430, height: 64},
	{x: 64, y: 210, width: 480, height: 82},
	{x: 64, y: 320, width: 520, height: 78},
];

/** Scene timing constants */
const TIMING = {
	ocrFrame: 42,
	selectFrame: 86,
	saveFrame: 118,
} as const;

/** Panel dimensions */
const PANEL = {
	controlsWidth: 520,
	previewWidth: 600,
	height: 670,
	gap: 40,
} as const;

/**
 * Evidence OCR scene demonstrating document processing workflow.
 * Shows: Render document -> OCR extraction -> Block selection -> Save provenance
 */
export const EvidenceOcrScene: React.FC = () => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();

	const appear = spring({fps, frame, config: SPRING_CONFIGS.default, durationInFrames: ANIMATION_DURATIONS.normal});
	const opacity = interpolate(frame, [0, 10], [0, 1], {extrapolateRight: 'clamp'});
	const translateY = interpolate(appear, [0, 1], [10, 0]);

	const left = LAYOUT.contentLeft;
	const top = 150;

	// OCR boxes fade in after OCR action
	const boxOpacity = interpolate(
		frame,
		[TIMING.ocrFrame, TIMING.ocrFrame + 10],
		[0, 1],
		{extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}
	);

	const previewContainerStyles = useMemo(() => ({
		position: 'relative' as const,
		width: '100%',
		height: 602,
		borderRadius: THEME_EXTENDED.radius.md,
		border: `1px solid ${THEME.border}`,
		background: THEME_EXTENDED.gradient.cardHighlight,
		overflow: 'hidden' as const,
	}), []);

	return (
		<AppFrame active="Evidence" title="Evidence">
			<AbsoluteFill style={{opacity, transform: `translateY(${translateY}px)`}}>
				{/* Scene description */}
				<div
					style={{
						position: 'absolute',
						left,
						top: 104,
						color: THEME.textSecondary,
						...THEME_EXTENDED.textStyles.bodyStrong,
					}}
				>
					Render &rarr; OCR &rarr; select blocks &rarr; save provenance.
				</div>

				{/* Controls panel */}
				<Panel x={left} y={top} w={PANEL.controlsWidth} h={PANEL.height} title="Controls">
					<div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
						<div style={{color: THEME.textTertiary, ...THEME_EXTENDED.textStyles.caption, fontWeight: THEME_EXTENDED.fontWeight.extrabold}}>
							Document: Sika Sustainability Report 2023
						</div>
						<div style={{color: THEME.muted, ...THEME_EXTENDED.textStyles.mono}}>Page number: 45</div>
						<div style={{display: 'flex', gap: 10}}>
							<ButtonLike label="Render" tone="primary" />
							<ButtonLike label="OCR" />
						</div>

						<div style={{height: 1, backgroundColor: THEME.border, margin: '10px 0'}} />

						<div style={{color: THEME.muted, ...THEME_EXTENDED.textStyles.label}}>Field provenance</div>
						<div style={{color: THEME.textTertiary, ...THEME_EXTENDED.textStyles.mono}}>
							entity_type: <span style={{fontFamily: THEME_EXTENDED.fonts.mono}}>measure_supplier</span>
						</div>
						<div style={{color: THEME.textTertiary, ...THEME_EXTENDED.textStyles.mono}}>
							field_key: <span style={{fontFamily: THEME_EXTENDED.fonts.mono}}>tco2e</span>
						</div>

						<div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
							<div style={{color: THEME.muted, ...THEME_EXTENDED.textStyles.mono}}>Selected blocks: 2</div>
							<ButtonLike label="Save" tone="primary" />
						</div>
					</div>
				</Panel>

				{/* Document preview panel */}
				<Panel
					x={left + PANEL.controlsWidth + PANEL.gap}
					y={top}
					w={PANEL.previewWidth}
					h={PANEL.height}
					title="Rendered page"
				>
					<div style={previewContainerStyles}>
						<div style={{position: 'absolute', left: 28, top: 26, color: THEME.textTertiary, fontWeight: THEME_EXTENDED.fontWeight.black}}>
							[PDF page preview]
						</div>

						{/* OCR bounding boxes */}
						{OCR_BOXES.map((box, index) => (
							<OcrBox key={index} box={box} opacity={boxOpacity} />
						))}
					</div>
				</Panel>

				{/* OCR action interaction */}
				<Cursor
					x={left + 186}
					y={top + 140}
					enterFrame={TIMING.ocrFrame - 10}
					exitFrame={TIMING.selectFrame + 6}
				/>
				<FocusRing
					x={left + 150}
					y={top + 112}
					w={220}
					h={58}
					startFrame={TIMING.ocrFrame}
					durationInFrames={20}
					color={THEME.sky}
				/>
				<Toast
					text="OCR complete (blocks + bboxes stored)"
					tone="success"
					startFrame={TIMING.ocrFrame + 10}
					durationInFrames={56}
				/>

				{/* Block selection interaction */}
				<Cursor
					x={left + 700}
					y={top + 326}
					enterFrame={TIMING.selectFrame - 10}
					exitFrame={TIMING.saveFrame + 10}
				/>
				<FocusRing
					x={left + PANEL.controlsWidth + PANEL.gap + 54}
					y={top + 198}
					w={520}
					h={100}
					startFrame={TIMING.selectFrame}
					durationInFrames={22}
					color={THEME.green}
				/>
				<Toast
					text="Selected 2 blocks for provenance"
					tone="info"
					startFrame={TIMING.selectFrame + 10}
					durationInFrames={50}
				/>

				{/* Save action interaction */}
				<Cursor
					x={left + 480}
					y={top + 540}
					enterFrame={TIMING.saveFrame - 10}
					exitFrame={TIMING.saveFrame + 30}
				/>
				<FocusRing
					x={left + 360}
					y={top + 512}
					w={160}
					h={58}
					startFrame={TIMING.saveFrame}
					durationInFrames={20}
					color={THEME.green}
				/>
				<Toast
					text="Saved provenance (parsed numeric + unit_norm)"
					tone="success"
					startFrame={TIMING.saveFrame + 10}
					durationInFrames={56}
				/>
			</AbsoluteFill>
		</AppFrame>
	);
};

