import React, {useMemo} from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {AppFrame} from '../ui/AppFrame';
import {Chip, ChipTone} from '../ui/Chip';
import {Cursor} from '../ui/Cursor';
import {FocusRing} from '../ui/FocusRing';
import {Toast} from '../ui/Toast';
import {THEME, THEME_EXTENDED, OPACITY, SPRING_CONFIGS, LAYOUT, ANIMATION_DURATIONS} from '../theme';

/** Table column configuration for consistent grid layout */
const TABLE_COLUMNS = '1.4fr 0.8fr 0.8fr 0.9fr 0.7fr 0.9fr 0.6fr';

/** Column headers for the measure table */
const COLUMN_HEADERS = ['Supplier', 'tCO2e', 'Spend', 'Intensity', 'Quality', 'Uncertainty', 'Evidence'] as const;

/**
 * Table header row with column labels.
 * Memoized as it never changes during animation.
 */
const TableHeader: React.FC = React.memo(() => {
	const headerStyles = useMemo(() => ({
		display: 'grid' as const,
		gridTemplateColumns: TABLE_COLUMNS,
		gap: 10,
		padding: '12px 14px',
		borderBottom: `1px solid ${THEME.border}`,
		color: THEME.muted,
		...THEME_EXTENDED.textStyles.label,
	}), []);

	return (
		<div style={headerStyles}>
			{COLUMN_HEADERS.map((header, index) => (
				<div key={header} style={index === COLUMN_HEADERS.length - 1 ? {textAlign: 'right'} : undefined}>
					{header}
				</div>
			))}
		</div>
	);
});

interface SupplierRowData {
	name: string;
	tco2e: string;
	spend: string;
	intensity: string;
	quality: ChipTone;
	qualityLabel: string;
	uncertainty: ChipTone;
	uncertaintyLabel: string;
}

interface TableRowProps {
	data: SupplierRowData;
	isFocused?: boolean;
}

/**
 * Data row in the measure table.
 * Memoized to prevent re-renders when focus changes on other rows.
 * Features subtle focus state with accent border and refined typography.
 */
const TableRow: React.FC<TableRowProps> = React.memo(({data, isFocused = false}) => {
	const rowStyles = useMemo(() => ({
		display: 'grid' as const,
		gridTemplateColumns: TABLE_COLUMNS,
		gap: 10,
		padding: '16px 16px',
		alignItems: 'center' as const,
		borderBottom: `1px solid ${THEME.borderSubtle}`,
		backgroundColor: isFocused ? 'rgba(34,197,94,0.04)' : 'transparent',
		// Subtle left border accent for focused row
		borderLeft: isFocused ? `3px solid ${THEME.green}` : '3px solid transparent',
	}), [isFocused]);

	const nameStyles = useMemo(() => ({
		...THEME_EXTENDED.textStyles.body,
		fontWeight: THEME_EXTENDED.fontWeight.black,
		color: THEME.text,
	}), []);

	const monoStyles = useMemo(() => ({
		...THEME_EXTENDED.textStyles.mono,
		color: THEME.textSecondary,
	}), []);

	const mutedMonoStyles = useMemo(() => ({
		...THEME_EXTENDED.textStyles.mono,
		color: THEME.muted,
	}), []);

	const buttonStyles = useMemo(() => ({
		padding: '8px 14px',
		borderRadius: THEME_EXTENDED.radius.md,
		border: 'none',
		background: THEME_EXTENDED.gradient.buttonPrimary,
		color: '#000000',
		...THEME_EXTENDED.textStyles.buttonSmall,
		boxShadow: [
			THEME_EXTENDED.shadow.xs,
			THEME_EXTENDED.glow.greenSubtle,
		].join(', '),
	}), []);

	return (
		<div style={rowStyles}>
			<div style={nameStyles}>{data.name}</div>
			<div style={monoStyles}>{data.tco2e}</div>
			<div style={mutedMonoStyles}>{data.spend}</div>
			<div style={mutedMonoStyles}>{data.intensity}</div>
			<div><Chip label={data.qualityLabel} tone={data.quality} /></div>
			<div><Chip label={data.uncertaintyLabel} tone={data.uncertainty} /></div>
			<div style={{display: 'flex', justifyContent: 'flex-end'}}>
				<div style={buttonStyles}>Add</div>
			</div>
		</div>
	);
});

/** Sample supplier data for the table - using semantic chip tones */
const SUPPLIER_DATA: SupplierRowData[] = [
	{
		name: 'PPG Industries',
		tco2e: '134k',
		spend: '$260M',
		intensity: '5.2e-4',
		quality: 'info', // medium quality
		qualityLabel: 'medium',
		uncertainty: 'warning', // high uncertainty
		uncertaintyLabel: 'high',
	},
	{
		name: 'BASF SE',
		tco2e: '89k',
		spend: '$180M',
		intensity: '4.9e-4',
		quality: 'success', // high quality
		qualityLabel: 'high',
		uncertainty: 'info', // medium uncertainty
		uncertaintyLabel: 'medium',
	},
	{
		name: 'Dow Chemical',
		tco2e: '156k',
		spend: '$310M',
		intensity: '5.0e-4',
		quality: 'info', // medium quality
		qualityLabel: 'medium',
		uncertainty: 'warning', // high uncertainty
		uncertaintyLabel: 'high',
	},
];

/** Scene timing constants */
const TIMING = {
	clickFrame: 62,
} as const;

/** Layout constants */
const TABLE_WIDTH = 1160;

/**
 * Measure to Evidence scene demonstrating one-click evidence attachment.
 * Shows the supplier measurement table with action to add evidence.
 */
export const MeasureToEvidenceScene: React.FC = () => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();

	const appear = spring({fps, frame, config: SPRING_CONFIGS.default, durationInFrames: ANIMATION_DURATIONS.normal});
	const opacity = interpolate(frame, [0, 10], [0, 1], {extrapolateRight: 'clamp'});
	const translateY = interpolate(appear, [0, 1], [10, 0]);

	const left = LAYOUT.contentLeft;
	const top = 160;

	const tableStyles = useMemo(() => ({
		position: 'absolute' as const,
		left,
		top,
		width: TABLE_WIDTH,
		borderRadius: THEME_EXTENDED.radius.lg,
		border: `1px solid ${THEME.border}`,
		backgroundColor: THEME.panel,
		overflow: 'hidden' as const,
	}), [left, top]);

	return (
		<AppFrame active="Measure" title="Measure">
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
					Attach evidence to a KPI in one click.
				</div>

				{/* Data table */}
				<div style={tableStyles}>
					<TableHeader />
					{SUPPLIER_DATA.map((supplier, index) => (
						<TableRow
							key={supplier.name}
							data={supplier}
							isFocused={index === 0}
						/>
					))}
				</div>

				{/* Click interaction */}
				<Cursor
					x={left + TABLE_WIDTH - 40}
					y={top + 132}
					enterFrame={TIMING.clickFrame - 8}
					exitFrame={TIMING.clickFrame + 26}
				/>
				<FocusRing
					x={left + TABLE_WIDTH - 140}
					y={top + 104}
					w={132}
					h={62}
					startFrame={TIMING.clickFrame}
					durationInFrames={18}
					color={THEME.green}
				/>

				<Toast
					text="Deep link to Evidence (entity_id + field_key prefilled)"
					tone="info"
					startFrame={TIMING.clickFrame + 8}
					durationInFrames={54}
				/>
			</AbsoluteFill>
		</AppFrame>
	);
};

