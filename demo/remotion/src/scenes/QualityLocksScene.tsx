import React, {useMemo} from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {AppFrame} from '../ui/AppFrame';
import {Chip} from '../ui/Chip';
import {Cursor} from '../ui/Cursor';
import {FocusRing} from '../ui/FocusRing';
import {Toast} from '../ui/Toast';
import {THEME, THEME_EXTENDED, OPACITY, SPRING_CONFIGS, LAYOUT, ANIMATION_DURATIONS} from '../theme';

interface CardProps {
	title: string;
	children: React.ReactNode;
	x: number;
	y: number;
	w: number;
	h: number;
}

/**
 * Card container with title header.
 * Memoized for performance in scenes with multiple cards.
 */
const Card: React.FC<CardProps> = React.memo(({title, children, x, y, w, h}) => {
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

/** Grid column configuration for fix queue table */
const FIX_QUEUE_COLUMNS = '1.2fr 0.7fr 1.4fr 0.9fr';

/**
 * Fix queue table header.
 */
const FixQueueHeader: React.FC = React.memo(() => {
	const headerStyles = useMemo(() => ({
		display: 'grid' as const,
		gridTemplateColumns: FIX_QUEUE_COLUMNS,
		gap: 12,
		color: THEME.muted,
		...THEME_EXTENDED.textStyles.label,
	}), []);

	return (
		<div style={headerStyles}>
			<div>Rule</div>
			<div>Severity</div>
			<div>Message</div>
			<div style={{textAlign: 'right'}}>Actions</div>
		</div>
	);
});

interface FixQueueItemProps {
	rule: string;
	severity: 'high' | 'medium' | 'low';
	message: string;
}

/**
 * Fix queue item row showing a quality issue.
 */
const FixQueueItem: React.FC<FixQueueItemProps> = React.memo(({rule, severity, message}) => {
	const rowStyles = useMemo(() => ({
		display: 'grid' as const,
		gridTemplateColumns: FIX_QUEUE_COLUMNS,
		gap: 12,
		alignItems: 'center' as const,
		padding: '12px 0',
		borderTop: `1px solid ${THEME.borderSubtle}`,
	}), []);

	const buttonBaseStyles = useMemo(() => ({
		padding: '8px 12px',
		borderRadius: THEME_EXTENDED.radius.md,
		border: `1px solid ${THEME.border}`,
		...THEME_EXTENDED.textStyles.buttonSmall,
	}), []);

	// Map severity to semantic chip tones
	const severityTone = severity === 'high' ? 'error' : severity === 'medium' ? 'warning' : 'success';

	return (
		<div style={rowStyles}>
			<div style={{fontFamily: THEME_EXTENDED.fonts.mono, ...THEME_EXTENDED.textStyles.mono, color: THEME.textSecondary}}>
				{rule}
			</div>
			<div>
				<Chip label={severity} tone={severityTone} />
			</div>
			<div style={{color: THEME.textTertiary, ...THEME_EXTENDED.textStyles.caption}}>
				{message}
			</div>
			<div style={{display: 'flex', justifyContent: 'flex-end', gap: 10}}>
				<div style={{...buttonBaseStyles, backgroundColor: `rgba(255,255,255,${OPACITY.subtle})`}}>
					Evidence
				</div>
				<div style={{...buttonBaseStyles, background: THEME_EXTENDED.gradient.buttonPrimary, color: '#000', fontWeight: THEME_EXTENDED.fontWeight.black}}>
					Resolve
				</div>
			</div>
		</div>
	);
});

interface LocksPanelProps {
	isLocked: boolean;
}

/**
 * Reporting period locks panel content.
 */
const LocksPanel: React.FC<LocksPanelProps> = React.memo(({isLocked}) => {
	const buttonStyles = useMemo(() => ({
		padding: '10px 14px',
		borderRadius: THEME_EXTENDED.radius.md,
		backgroundColor: `rgba(255,255,255,${OPACITY.subtle})`,
		border: `1px solid ${THEME.border}`,
		...THEME_EXTENDED.textStyles.buttonSmall,
	}), []);

	const codeBlockStyles = useMemo(() => ({
		marginTop: THEME_EXTENDED.space.lg,
		padding: 14,
		borderRadius: THEME_EXTENDED.radius.md,
		border: `1px solid ${THEME.border}`,
		backgroundColor: 'rgba(0,0,0,0.25)',
		fontFamily: THEME_EXTENDED.fonts.mono,
		color: THEME.textSecondary,
		...THEME_EXTENDED.textStyles.mono,
	}), []);

	return (
		<>
			<div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
				<div>
					<div style={{...THEME_EXTENDED.textStyles.h5, fontWeight: THEME_EXTENDED.fontWeight.black}}>Period: last_12_months</div>
					<div style={{...THEME_EXTENDED.textStyles.mono, color: THEME.muted, marginTop: 6}}>
						Once locked, write endpoints return <span style={{color: THEME.textSecondary}}>423 Locked</span>.
					</div>
				</div>
				<div style={buttonStyles}>Lock period</div>
			</div>

			<div style={{marginTop: THEME_EXTENDED.space.lg, display: 'flex', gap: 12, alignItems: 'center'}}>
				<Chip label={isLocked ? 'locked' : 'open'} tone={isLocked ? 'error' : 'success'} />
				<div style={{...THEME_EXTENDED.textStyles.mono, color: THEME.muted}}>
					Enforced for: `measure/seed`, `pipeline/*`, `docs/upload`, `demo-sync`
				</div>
			</div>

			<div style={codeBlockStyles}>
				POST /api/pipeline/docs/upload -&gt; 423 Locked
			</div>
		</>
	);
});

/** Scene timing constants */
const TIMING = {
	evidenceClickFrame: 34,
	showLocksFrame: 78,
	lockFrame: 96,
	lockedWriteFrame: 132,
} as const;

/** Card dimensions */
const CARD = {
	width: 1160,
	fixQueueHeight: 330,
	locksHeight: 280,
	gap: 30,
} as const;

/**
 * Quality and Locks scene demonstrating quality checks and period locking.
 * Shows: Fix queue for anomalies -> Navigate to evidence -> Lock period -> Blocked mutation
 */
export const QualityLocksScene: React.FC = () => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();

	const appear = spring({fps, frame, config: SPRING_CONFIGS.default, durationInFrames: ANIMATION_DURATIONS.normal});
	const opacity = interpolate(frame, [0, 10], [0, 1], {extrapolateRight: 'clamp'});
	const translateY = interpolate(appear, [0, 1], [10, 0]);

	const left = LAYOUT.contentLeft;
	const top = 150;

	const showLocks = frame >= TIMING.showLocksFrame;
	const isLocked = frame >= TIMING.lockFrame + 10;

	return (
		<AppFrame active="Quality" title="Quality + Locks">
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
					Anomalies route you to evidence - then lock the reporting period.
				</div>

				{/* Fix queue card */}
				<Card title="Fix queue" x={left} y={top} w={CARD.width} h={CARD.fixQueueHeight}>
					<div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
						<FixQueueHeader />
						<FixQueueItem
							rule="provenance.missing.upstream_impact_pct"
							severity="high"
							message="High-impact benchmark field is missing evidence provenance."
						/>
					</div>
				</Card>

				{/* Evidence button interaction */}
				<Cursor
					x={left + 1040}
					y={top + 214}
					enterFrame={TIMING.evidenceClickFrame - 8}
					exitFrame={TIMING.evidenceClickFrame + 20}
				/>
				<FocusRing
					x={left + 940}
					y={top + 186}
					w={110}
					h={58}
					startFrame={TIMING.evidenceClickFrame}
					durationInFrames={18}
					color={THEME.sky}
				/>
				<Toast
					text="Opens Evidence with entity + field prefilled"
					tone="info"
					startFrame={TIMING.evidenceClickFrame + 10}
					durationInFrames={56}
				/>

				{/* Reporting period locks card (appears after fix queue interaction) */}
				{showLocks && (
					<Card
						title="Reporting period locks"
						x={left}
						y={top + CARD.fixQueueHeight + CARD.gap}
						w={CARD.width}
						h={CARD.locksHeight}
					>
						<LocksPanel isLocked={isLocked} />
					</Card>
				)}

				{/* Lock period interaction */}
				{showLocks && (
					<>
						<Cursor
							x={left + 1100}
							y={top + 410}
							enterFrame={TIMING.lockFrame - 8}
							exitFrame={TIMING.lockFrame + 24}
						/>
						<FocusRing
							x={left + 1000}
							y={top + 382}
							w={150}
							h={60}
							startFrame={TIMING.lockFrame}
							durationInFrames={18}
							color={THEME.red}
						/>
						<Toast
							text="Period locked"
							tone="success"
							startFrame={TIMING.lockFrame + 10}
							durationInFrames={46}
						/>

						{/* Blocked mutation interaction */}
						<Cursor
							x={left + 560}
							y={top + 608}
							enterFrame={TIMING.lockedWriteFrame - 8}
							exitFrame={TIMING.lockedWriteFrame + 20}
						/>
						<FocusRing
							x={left + 30}
							y={top + 560}
							w={1100}
							h={64}
							startFrame={TIMING.lockedWriteFrame}
							durationInFrames={18}
							color={THEME.red}
						/>
						<Toast
							text="Blocked mutation (423 Locked)"
							tone="error"
							startFrame={TIMING.lockedWriteFrame + 10}
							durationInFrames={56}
						/>
					</>
				)}
			</AbsoluteFill>
		</AppFrame>
	);
};

