import React, {useMemo} from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {AppFrame} from '../ui/AppFrame';
import {Chip} from '../ui/Chip';
import {Cursor} from '../ui/Cursor';
import {FocusRing} from '../ui/FocusRing';
import {Toast} from '../ui/Toast';
import {THEME, THEME_EXTENDED, SPRING_CONFIGS, LAYOUT, ANIMATION_DURATIONS} from '../theme';

/** Integration card connection status */
type ConnectionStatus = 'not_connected' | 'connected';

interface IntegrationCardProps {
	x: number;
	y: number;
	w: number;
	h: number;
	title: string;
	subtitle: string;
	status: ConnectionStatus;
}

/**
 * Integration provider card showing connection status and actions.
 * Memoized to prevent re-renders when other cards change status.
 * Features glass morphism, layered shadows, and premium button styling.
 */
const IntegrationCard: React.FC<IntegrationCardProps> = React.memo(({
	x,
	y,
	w,
	h,
	title,
	subtitle,
	status,
}) => {
	const isConnected = status === 'connected';

	const containerStyles = useMemo(() => ({
		position: 'absolute' as const,
		left: x,
		top: y,
		width: w,
		height: h,
		borderRadius: THEME_EXTENDED.radius.xl,
		border: `1px solid ${THEME.border}`,
		background: THEME_EXTENDED.gradient.cardSurface,
		backdropFilter: 'blur(8px)',
		padding: THEME_EXTENDED.space.lg,
		boxSizing: 'border-box' as const,
		display: 'flex' as const,
		flexDirection: 'column' as const,
		justifyContent: 'space-between' as const,
		boxShadow: [
			THEME_EXTENDED.shadow.md,
			`inset 0 1px 0 rgba(255,255,255,0.08)`,
		].join(', '),
	}), [x, y, w, h]);

	const titleStyles = useMemo(() => ({
		...THEME_EXTENDED.textStyles.h5,
		color: THEME.text,
	}), []);

	const subtitleStyles = useMemo(() => ({
		...THEME_EXTENDED.textStyles.caption,
		color: THEME.muted,
		marginTop: THEME_EXTENDED.space.sm,
	}), []);

	const buttonStyles = useMemo(() => ({
		padding: '10px 16px',
		borderRadius: THEME_EXTENDED.radius.md,
		border: isConnected ? `1px solid ${THEME.border}` : 'none',
		background: isConnected
			? THEME_EXTENDED.gradient.buttonSecondary
			: THEME_EXTENDED.gradient.buttonPrimary,
		color: isConnected ? THEME.textSecondary : '#000000',
		...THEME_EXTENDED.textStyles.buttonSmall,
		boxShadow: isConnected
			? `inset 0 1px 0 rgba(255,255,255,0.06)`
			: [
				THEME_EXTENDED.shadow.sm,
				THEME_EXTENDED.glow.greenSubtle,
			].join(', '),
	}), [isConnected]);

	return (
		<div style={containerStyles}>
			<div>
				<div style={titleStyles}>{title}</div>
				<div style={subtitleStyles}>{subtitle}</div>
			</div>

			<div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
				<Chip
					label={isConnected ? 'connected' : 'not connected'}
					tone={isConnected ? 'success' : 'neutral'}
				/>
				<div style={buttonStyles}>
					{isConnected ? 'Demo sync' : 'Connect'}
				</div>
			</div>
		</div>
	);
});

/** Scene timing constants */
const TIMING = {
	focusConnectFrame: 28,
	focusSyncFrame: 74,
} as const;

/** Card dimensions and spacing */
const CARD = {
	width: 520,
	height: 210,
	gap: 40,
	rowGap: 40,
} as const;

/** Integration providers data */
const INTEGRATIONS = [
	{id: 'coupa', title: 'Coupa', subtitle: 'Invoices, spend categories, suppliers (P2P).', dynamic: true},
	{id: 'ariba', title: 'SAP Ariba', subtitle: 'Buying & invoicing via Business Network.', dynamic: false},
	{id: 'concur', title: 'SAP Concur', subtitle: 'Travel & Expense (Cat 6).', dynamic: false},
	{id: 'project44', title: 'project44', subtitle: 'Shipment activity + tonne-km (Cat 4/9).', dynamic: false},
] as const;

/**
 * Integrations scene showing connection workflow.
 * Demonstrates connecting a data source and running a sync.
 */
export const IntegrationsScene: React.FC = () => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();

	const fadeIn = interpolate(frame, [0, 10], [0, 1], {extrapolateRight: 'clamp'});
	const pop = spring({fps, frame, config: SPRING_CONFIGS.default, durationInFrames: ANIMATION_DURATIONS.normal});

	const left = LAYOUT.contentLeft;
	const top = 140;

	const isConnected = frame >= TIMING.focusSyncFrame;
	const showSyncFocus = frame >= TIMING.focusSyncFrame;

	// Calculate card positions
	const cardPositions = useMemo(() => [
		{x: left, y: top},
		{x: left + CARD.width + CARD.gap, y: top},
		{x: left, y: top + CARD.height + CARD.rowGap},
		{x: left + CARD.width + CARD.gap, y: top + CARD.height + CARD.rowGap},
	], [left, top]);

	return (
		<AppFrame active="Integrations" title="Integrations">
			<AbsoluteFill style={{opacity: fadeIn, transform: `scale(${interpolate(pop, [0, 1], [0.99, 1])})`}}>
				{/* Scene description */}
				<div
					style={{
						position: 'absolute',
						left,
						top: 104,
						...THEME_EXTENDED.textStyles.bodyStrong,
						color: THEME.textSecondary,
					}}
				>
					Connect a popular tool and run a deterministic demo sync into Measure.
				</div>

				{/* Integration cards */}
				{INTEGRATIONS.map((integration, index) => (
					<IntegrationCard
						key={integration.id}
						x={cardPositions[index].x}
						y={cardPositions[index].y}
						w={CARD.width}
						h={CARD.height}
						title={integration.title}
						subtitle={integration.subtitle}
						status={integration.dynamic && isConnected ? 'connected' : 'not_connected'}
					/>
				))}

				{/* Connect action cursor and focus */}
				<Cursor
					x={left + 485}
					y={top + 184}
					enterFrame={TIMING.focusConnectFrame - 6}
					exitFrame={TIMING.focusSyncFrame + 20}
				/>
				<FocusRing
					x={left - 6}
					y={top - 6}
					w={CARD.width + 12}
					h={CARD.height + 12}
					startFrame={TIMING.focusConnectFrame}
					durationInFrames={18}
				/>

				{/* Sync action cursor and focus */}
				{showSyncFocus && (
					<>
						<Cursor
							x={left + 500}
							y={top + 184}
							enterFrame={TIMING.focusSyncFrame - 6}
							exitFrame={TIMING.focusSyncFrame + 36}
						/>
						<FocusRing
							x={left - 6}
							y={top - 6}
							w={CARD.width + 12}
							h={CARD.height + 12}
							startFrame={TIMING.focusSyncFrame}
							durationInFrames={20}
							color={THEME.sky}
						/>
					</>
				)}

				{/* Toast notifications */}
				<Toast
					text="Connected: Coupa"
					tone="success"
					startFrame={TIMING.focusConnectFrame + 8}
					durationInFrames={36}
				/>
				<Toast
					text="Demo sync complete: 5 purchases, 2 activities"
					tone="info"
					startFrame={TIMING.focusSyncFrame + 10}
					durationInFrames={52}
				/>
			</AbsoluteFill>
		</AppFrame>
	);
};

