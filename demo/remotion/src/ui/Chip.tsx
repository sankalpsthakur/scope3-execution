import React, {useMemo} from 'react';
import {THEME, THEME_EXTENDED, CHIP_TONES, type ChipTone} from '../theme';

// Re-export ChipTone for consumers
export type {ChipTone};

export interface ChipProps {
	label: string;
	/**
	 * Semantic tone for the chip color.
	 *
	 * Preferred semantic names:
	 * - 'success' - positive states (green)
	 * - 'warning' - caution states (amber)
	 * - 'error' - negative states (red)
	 * - 'info' - informational (sky blue)
	 * - 'neutral' - default/inactive (gray)
	 * - 'primary' - brand action (green)
	 *
	 * Legacy names (still supported for backward compatibility):
	 * - 'green', 'amber', 'red', 'sky', 'gray'
	 * - 'good', 'warn', 'bad' (cross-repo compatibility)
	 */
	tone?: ChipTone;
	/** Compact size variant */
	size?: 'sm' | 'md';
}

/**
 * Get chip config from unified CHIP_TONES with dot color.
 * Falls back to neutral if tone not found.
 */
const getChipConfig = (tone: ChipTone) => {
	const toneConfig = CHIP_TONES[tone] ?? CHIP_TONES.neutral;
	return {
		bg: toneConfig.bg,
		fg: toneConfig.fg,
		border: toneConfig.border,
		dotColor: toneConfig.fg, // Dot uses foreground color
	};
};

/**
 * Status chip/badge component with semantic color tones.
 * Uses unified CHIP_TONES from theme for cross-repo consistency.
 * Features subtle gradient background and status dot for visual polish.
 */
export const Chip: React.FC<ChipProps> = React.memo(({label, tone = 'neutral', size = 'md'}) => {
	const config = getChipConfig(tone);

	const isSmall = size === 'sm';

	const isSemanticTone = tone !== 'neutral' && tone !== 'gray';

	const containerStyles = useMemo(
		() => ({
			display: 'inline-flex' as const,
			alignItems: 'center' as const,
			justifyContent: 'center' as const,
			gap: isSmall ? 5 : 7,
			padding: isSmall ? '4px 10px' : '6px 12px',
			borderRadius: THEME_EXTENDED.radius.pill,
			// Subtle gradient for depth
			background: `linear-gradient(180deg, ${config.bg} 0%, ${config.bg}dd 100%)`,
			color: config.fg,
			fontSize: isSmall ? THEME_EXTENDED.fontSize.xs : THEME_EXTENDED.fontSize.sm,
			fontWeight: THEME_EXTENDED.fontWeight.bold,
			letterSpacing: 0.3,
			border: `1px solid ${config.border}`,
			// Subtle inner highlight and outer shadow
			boxShadow: [
				`inset 0 1px 0 rgba(255,255,255,0.08)`,
				isSemanticTone ? `0 1px 3px rgba(0,0,0,0.2)` : 'none',
			].filter(s => s !== 'none').join(', '),
		}),
		[config, isSmall, isSemanticTone]
	);

	const dotStyles = useMemo(
		() => ({
			width: isSmall ? 6 : 7,
			height: isSmall ? 6 : 7,
			borderRadius: THEME_EXTENDED.radius.pill,
			backgroundColor: config.dotColor,
			flexShrink: 0,
			// Enhanced glow on the dot for better visibility
			boxShadow: isSemanticTone ? `0 0 6px ${config.dotColor}70` : 'none',
		}),
		[config, isSmall, isSemanticTone]
	);

	return (
		<span style={containerStyles}>
			<span style={dotStyles} />
			<span>{label}</span>
		</span>
	);
});

