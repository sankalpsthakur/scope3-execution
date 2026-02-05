import type React from 'react';

/**
 * Design system theme tokens for the Remotion video.
 * All colors follow a dark mode palette with semantic naming.
 *
 * Cross-repo naming convention:
 * - Both repos export a primary theme object (THEME here, theme in strategy)
 * - Color naming follows a semantic pattern (primary, good, warn, bad, etc.)
 * - Additional aliases provided for cross-repo component compatibility
 *
 * COLOR THEORY NOTES:
 * - Primary green (#22C55E) provides ~7.6:1 contrast on dark bg (WCAG AAA)
 * - Split-complementary color scheme: green (142 deg), sky (199 deg), amber (38 deg)
 * - All text colors meet WCAG AA (4.5:1) minimum contrast requirements
 * - Muted text (#A1A1AA) provides 6.5:1 contrast (was #71717A at 3.9:1 - FAILED AA)
 */
export const THEME = {
	// =========================================================================
	// BACKGROUND COLORS - Elevation System
	// Each level adds ~1-2% lightness for proper dark theme depth perception
	// =========================================================================
	bg: '#09090B', // Level 0 - base canvas
	bgSubtle: '#0C0C0F', // Level 0.5 - subtle elevation
	panel: '#111113', // Level 1 - cards, panels
	panelHover: '#161618', // Level 1.5 - panel hover state
	surface: '#1A1A1D', // Level 2 - elevated surfaces
	surfaceHover: '#222225', // Level 2.5 - surface hover
	surfaceMuted: '#0F0F11', // Recessed surfaces

	// =========================================================================
	// BORDER COLORS - Consistent Opacity Scale
	// Using 0.06 / 0.10 / 0.14 / 0.20 progression
	// =========================================================================
	borderSubtle: 'rgba(255,255,255,0.06)', // Subtle dividers
	border: 'rgba(255,255,255,0.10)', // Default borders
	borderMedium: 'rgba(255,255,255,0.14)', // Emphasized borders
	borderFocus: 'rgba(255,255,255,0.20)', // Focus/active borders

	// =========================================================================
	// TEXT COLORS - WCAG AA Compliant
	// All contrast ratios calculated against bg #09090B
	// =========================================================================
	text: '#FAFAFA', // Primary text - 19:1 contrast (WCAG AAA)
	textSecondary: 'rgba(255,255,255,0.80)', // Secondary - ~15:1 contrast
	textTertiary: 'rgba(255,255,255,0.64)', // Tertiary - ~12:1 contrast
	muted: '#A1A1AA', // Muted text - 6.5:1 contrast (FIXED: was #71717A at 3.9:1)
	textMuted: '#A1A1AA', // Alias for cross-repo compatibility

	// =========================================================================
	// SEMANTIC COLORS - Primary/Accent
	// =========================================================================
	primary: '#22C55E', // Green is primary for dark theme - 7.6:1 contrast
	primaryMuted: 'rgba(34,197,94,0.16)',
	accent: '#0EA5E9', // Sky blue accent - 5.8:1 contrast
	accentMuted: 'rgba(14,165,233,0.16)',

	// =========================================================================
	// STATUS COLORS - Consistent Opacity Scale
	// Base color, muted (0.12), glow (0.24)
	// =========================================================================
	// Success / Good (green)
	green: '#22C55E',
	greenDark: '#16A34A',
	greenMuted: 'rgba(34,197,94,0.12)',
	greenGlow: 'rgba(34,197,94,0.24)',
	good: '#22C55E', // Cross-repo alias

	// Error / Bad (red)
	red: '#EF4444',
	redMuted: 'rgba(239,68,68,0.12)',
	redGlow: 'rgba(239,68,68,0.24)',
	bad: '#EF4444', // Cross-repo alias

	// Warning (amber)
	amber: '#F59E0B',
	amberMuted: 'rgba(245,158,11,0.12)',
	amberGlow: 'rgba(245,158,11,0.24)',
	warn: '#F59E0B', // Cross-repo alias

	// Info (sky blue)
	sky: '#0EA5E9',
	skyMuted: 'rgba(14,165,233,0.12)',
	skyGlow: 'rgba(14,165,233,0.24)',
} as const;

/**
 * Standardized opacity scale for consistent transparency usage.
 * Use these values instead of arbitrary opacity numbers.
 *
 * USAGE GUIDE:
 * - subtle (0.04): Very subtle overlays, hover tints
 * - light (0.08): Light backgrounds, subtle borders (use borderSubtle)
 * - medium (0.12): Default muted colors, chip backgrounds
 * - strong (0.16): Emphasized overlays, primaryMuted/accentMuted
 * - muted (0.24): Chip borders, glow effects
 * - half (0.40): Disabled states
 * - high (0.64): Tertiary text (textTertiary uses this)
 * - solid (0.80): Secondary text (textSecondary uses this)
 */
export const OPACITY = {
	subtle: 0.04,
	light: 0.08,
	medium: 0.12,
	strong: 0.16,
	muted: 0.24,
	half: 0.40,
	high: 0.64,
	solid: 0.80,
} as const;

/**
 * Extended theme with additional design tokens
 * Matches scope3-strategy theme structure for potential component sharing
 */
export const THEME_EXTENDED = {
	...THEME,
	colors: THEME, // Nested for compatibility with strategy theme.colors.x pattern

	// Consistent radius scale (based on 4px increments)
	radius: {
		xs: 6,
		sm: 8,
		md: 12,
		lg: 16,
		xl: 20,
		pill: 999,
	},

	// Layered shadow system for depth
	shadow: {
		// Subtle elevation
		xs: '0 1px 2px rgba(0,0,0,0.3)',
		sm: '0 2px 4px rgba(0,0,0,0.2), 0 1px 2px rgba(0,0,0,0.3)',
		// Medium elevation with soft spread
		md: '0 4px 12px rgba(0,0,0,0.25), 0 2px 4px rgba(0,0,0,0.2)',
		// High elevation for modals/toasts
		lg: '0 8px 24px rgba(0,0,0,0.35), 0 4px 8px rgba(0,0,0,0.25)',
		// Dramatic elevation for focus states
		xl: '0 16px 48px rgba(0,0,0,0.45), 0 8px 16px rgba(0,0,0,0.3)',
		// Legacy aliases
		soft: '0 2px 8px rgba(0,0,0,0.3)',
		medium: '0 4px 16px rgba(0,0,0,0.5)',
		heavy: '0 18px 60px rgba(0,0,0,0.55)',
	},

	// Glow effects for focus states
	glow: {
		green: '0 0 20px rgba(34,197,94,0.35), 0 0 40px rgba(34,197,94,0.15)',
		greenSubtle: '0 0 12px rgba(34,197,94,0.20)',
		sky: '0 0 20px rgba(14,165,233,0.35), 0 0 40px rgba(14,165,233,0.15)',
		skySubtle: '0 0 12px rgba(14,165,233,0.20)',
		red: '0 0 20px rgba(239,68,68,0.35), 0 0 40px rgba(239,68,68,0.15)',
		amber: '0 0 20px rgba(245,158,11,0.35), 0 0 40px rgba(245,158,11,0.15)',
	},

	// Premium gradient definitions
	gradient: {
		// Background gradients
		bgVignette: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(20,20,22,0) 0%, rgba(9,9,11,1) 100%)',
		bgRadial: 'radial-gradient(ellipse 100% 100% at 50% 0%, rgba(34,197,94,0.04) 0%, transparent 50%)',
		// Subtle grid pattern for backgrounds (CSS repeating gradient)
		bgGrid: `repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(255,255,255,0.015) 40px, rgba(255,255,255,0.015) 41px),
				 repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(255,255,255,0.015) 40px, rgba(255,255,255,0.015) 41px)`,
		// Surface gradients for glass effect
		glassLight: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
		glassDark: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
		// Accent gradients
		greenShine: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
		skyShine: 'linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)',
		// Button gradients
		buttonPrimary: 'linear-gradient(180deg, #22C55E 0%, #16A34A 100%)',
		buttonSecondary: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%)',
		// Card highlight
		cardHighlight: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
		// Card surface with subtle depth
		cardSurface: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 50%, rgba(0,0,0,0.05) 100%)',
		// Text gradients
		textSubtle: 'linear-gradient(180deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.65) 100%)',
	},

	// Spacing scale (8px base)
	space: {
		xs: 4,
		sm: 8,
		md: 16,
		lg: 24,
		xl: 32,
		'2xl': 48,
		'3xl': 64,
		'4xl': 96,
	},

	fonts: {
		heading: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
		body: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
		mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
	},

	// Typography scale
	fontSize: {
		xs: 11,
		sm: 12,
		base: 14,
		md: 16,
		lg: 18,
		xl: 22,
		'2xl': 28,
		'3xl': 36,
		'4xl': 44,
		'5xl': 56,
		'6xl': 64,
	},

	// Font weights
	fontWeight: {
		normal: 400,
		medium: 500,
		semibold: 600,
		bold: 700,
		extrabold: 800,
		black: 900,
	},

	// Line heights
	lineHeight: {
		tight: 1.1,
		snug: 1.25,
		normal: 1.4,
		relaxed: 1.6,
		loose: 1.75,
	},

	// Letter spacing scale (tracking)
	letterSpacing: {
		tighter: -2,    // Display headings (64px+)
		tight: -1.5,    // Large headings (44px)
		snug: -0.5,     // Subheadings
		normal: -0.2,   // Body text default
		none: 0,        // No tracking
		wide: 0.3,      // Buttons, chips
		wider: 1.0,     // Labels
		widest: 1.4,    // Uppercase labels
	},

	/**
	 * Text rendering optimizations for video quality.
	 * Apply to root element for crisp font rendering.
	 */
	textRendering: {
		WebkitFontSmoothing: 'antialiased',
		MozOsxFontSmoothing: 'grayscale',
		textRendering: 'optimizeLegibility',
	} as React.CSSProperties,

	/**
	 * Complete text style presets for consistent typography.
	 * Use these instead of manually combining fontSize, fontWeight, etc.
	 *
	 * Video readability notes:
	 * - Minimum body text: 14px for 1080p
	 * - Headings should be at least 1.5x body size
	 * - Line height: 1.1-1.2 for headings, 1.4-1.6 for body
	 */
	textStyles: {
		// Display styles (hero text, 64px+)
		displayLarge: {
			fontSize: 64,
			fontWeight: 900,
			letterSpacing: -2,
			lineHeight: 1.1,
		},
		displayMedium: {
			fontSize: 56,
			fontWeight: 900,
			letterSpacing: -1.6,
			lineHeight: 1.06,
		},
		// Heading styles
		h1: {
			fontSize: 44,
			fontWeight: 900,
			letterSpacing: -1.5,
			lineHeight: 1.1,
		},
		h2: {
			fontSize: 36,
			fontWeight: 800,
			letterSpacing: -1,
			lineHeight: 1.2,
		},
		h3: {
			fontSize: 28,
			fontWeight: 800,
			letterSpacing: -0.5,
			lineHeight: 1.25,
		},
		h4: {
			fontSize: 22,
			fontWeight: 700,
			letterSpacing: -0.3,
			lineHeight: 1.25,
		},
		h5: {
			fontSize: 18,
			fontWeight: 700,
			letterSpacing: -0.2,
			lineHeight: 1.3,
		},
		// Body text styles (min 14px for video)
		body: {
			fontSize: 16,
			fontWeight: 400,
			letterSpacing: -0.1,
			lineHeight: 1.5,
		},
		bodyLarge: {
			fontSize: 18,
			fontWeight: 400,
			letterSpacing: -0.1,
			lineHeight: 1.5,
		},
		bodySmall: {
			fontSize: 14,
			fontWeight: 400,
			letterSpacing: 0,
			lineHeight: 1.4,
		},
		// Strong body variant
		bodyStrong: {
			fontSize: 16,
			fontWeight: 800,
			letterSpacing: -0.2,
			lineHeight: 1.4,
		},
		// UI label styles (uppercase)
		label: {
			fontSize: 12,
			fontWeight: 900,
			letterSpacing: 1.1,
			lineHeight: 1.2,
			textTransform: 'uppercase' as const,
		},
		labelSmall: {
			fontSize: 11,
			fontWeight: 700,
			letterSpacing: 1.4,
			lineHeight: 1.2,
			textTransform: 'uppercase' as const,
		},
		// Button/action text
		button: {
			fontSize: 14,
			fontWeight: 900,
			letterSpacing: 0.2,
			lineHeight: 1.2,
		},
		buttonSmall: {
			fontSize: 12,
			fontWeight: 900,
			letterSpacing: 0.2,
			lineHeight: 1.2,
		},
		// Caption/helper text
		caption: {
			fontSize: 13,
			fontWeight: 400,
			letterSpacing: 0,
			lineHeight: 1.35,
		},
		// Monospace text
		mono: {
			fontSize: 12,
			fontWeight: 400,
			letterSpacing: 0,
			lineHeight: 1.4,
		},
	},
} as const;

/** Type for theme color keys */
export type ThemeColor = keyof typeof THEME;

/** Standard spring config used across animations */
export const SPRING_CONFIG = {damping: 200} as const;

/** Standard animation durations in frames (at 30fps) */
export const ANIMATION_DURATIONS = {
	fast: 12,
	normal: 16,
	slow: 24,
} as const;

/** Layout constants for scene positioning */
export const LAYOUT = {
	sidebarWidth: 320,
	contentLeft: 360,
	contentPadding: 36,
} as const;

// ============================================================================
// SPRING CONFIGURATION PRESETS (Apple/Stripe-quality)
// ============================================================================

/**
 * Spring configuration presets for Remotion animations.
 * These create natural, polished motion with appropriate overshoot.
 *
 * Key principles:
 * - Lower damping (10-30) = more natural motion with overshoot
 * - Higher stiffness (150-300) = more responsive/snappy
 * - Mass affects "weight" - lower = snappier, higher = deliberate
 */
export const SPRING_CONFIGS = {
	/** Snappy spring for buttons, chips, small UI (iOS tap feel) */
	snappy: {mass: 1, damping: 15, stiffness: 300},
	/** Default smooth spring - most UI animations (slight overshoot) */
	default: {mass: 1, damping: 20, stiffness: 170},
	/** Gentle spring for large elements (cards, panels, modals) */
	gentle: {mass: 1, damping: 26, stiffness: 120},
	/** Bouncy spring for playful/celebratory elements */
	bouncy: {mass: 0.8, damping: 12, stiffness: 200},
	/** Precise spring for cursor/pointer (minimal overshoot) */
	precise: {mass: 1, damping: 30, stiffness: 200},
	/** Slide spring - smooth lateral movement */
	slide: {mass: 1, damping: 22, stiffness: 140},
	/** Soft spring for background/ambient animations */
	soft: {mass: 1.2, damping: 28, stiffness: 80},
	/** Legacy critically-damped (for backwards compatibility) */
	legacy: {damping: 200},
} as const;

/**
 * Timing constants for animation durations (in seconds).
 * Use these with secToFrames() for frame calculations.
 */
export const TIMING = {
	/** Quick micro-interaction (button press, toggle) */
	microSec: 0.15,
	/** Fast transition (chip, small element) */
	fastSec: 0.25,
	/** Standard appear duration */
	appearSec: 0.4,
	/** Standard fade duration */
	fadeSec: 0.5,
	/** Standard slide duration */
	slideSec: 0.6,
	/** Slow/dramatic transition */
	slowSec: 0.8,
	/** Scene transition duration */
	sceneSec: 1.0,
	/** Legacy quick transition alias */
	quickSec: 0.3,
} as const;

// ============================================================================
// COMPONENT TOKENS (Unified across repos)
// ============================================================================

/**
 * Unified Chip tone configurations.
 *
 * SEMANTIC NAMING (use these for new code):
 * - success: positive actions/states (green)
 * - warning: caution/attention needed (amber)
 * - error: destructive/negative states (red)
 * - info: informational/neutral-action (sky blue)
 * - neutral: default/inactive state (gray)
 * - primary: brand/primary action (green)
 *
 * LEGACY ALIASES (for backward compatibility):
 * - green -> success
 * - amber -> warning
 * - red -> error
 * - sky -> info
 * - gray -> neutral
 * - good -> success (from strategy repo)
 * - warn -> warning (from strategy repo)
 * - bad -> error (from strategy repo)
 */
export const CHIP_TONES = {
	// Semantic names (preferred)
	success: {
		bg: THEME.greenMuted,
		fg: THEME.green,
		border: 'rgba(34,197,94,0.24)',
	},
	warning: {
		bg: THEME.amberMuted,
		fg: THEME.amber,
		border: 'rgba(245,158,11,0.24)',
	},
	error: {
		bg: THEME.redMuted,
		fg: THEME.red,
		border: 'rgba(239,68,68,0.24)',
	},
	info: {
		bg: THEME.skyMuted,
		fg: THEME.sky,
		border: 'rgba(14,165,233,0.24)',
	},
	neutral: {
		bg: 'rgba(255,255,255,0.06)',
		fg: THEME.textSecondary,
		border: THEME.border,
	},
	primary: {
		bg: THEME.primaryMuted,
		fg: THEME.primary,
		border: 'rgba(34,197,94,0.24)',
	},
	// Legacy aliases for backward compatibility
	green: {
		bg: THEME.greenMuted,
		fg: THEME.green,
		border: 'rgba(34,197,94,0.24)',
	},
	amber: {
		bg: THEME.amberMuted,
		fg: THEME.amber,
		border: 'rgba(245,158,11,0.24)',
	},
	red: {
		bg: THEME.redMuted,
		fg: THEME.red,
		border: 'rgba(239,68,68,0.24)',
	},
	sky: {
		bg: THEME.skyMuted,
		fg: THEME.sky,
		border: 'rgba(14,165,233,0.24)',
	},
	gray: {
		bg: 'rgba(255,255,255,0.06)',
		fg: THEME.textSecondary,
		border: THEME.border,
	},
	// Cross-repo aliases (from strategy naming)
	good: {
		bg: THEME.greenMuted,
		fg: THEME.green,
		border: 'rgba(34,197,94,0.24)',
	},
	warn: {
		bg: THEME.amberMuted,
		fg: THEME.amber,
		border: 'rgba(245,158,11,0.24)',
	},
	bad: {
		bg: THEME.redMuted,
		fg: THEME.red,
		border: 'rgba(239,68,68,0.24)',
	},
} as const;

/**
 * Toast indicator dot colors by tone.
 * Unified naming: success, warning, error, info
 */
export const TOAST_TONES = {
	success: THEME.green,
	warning: THEME.amber,
	error: THEME.red,
	info: THEME.sky,
} as const;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type ThemeColorKey = keyof typeof THEME;
export type ChipTone = keyof typeof CHIP_TONES;
export type ToastTone = keyof typeof TOAST_TONES;
export type RadiusKey = keyof typeof THEME_EXTENDED['radius'];
export type ShadowKey = keyof typeof THEME_EXTENDED['shadow'];
export type SpaceKey = keyof typeof THEME_EXTENDED['space'];
export type FontSizeKey = keyof typeof THEME_EXTENDED['fontSize'];
export type FontWeightKey = keyof typeof THEME_EXTENDED['fontWeight'];
export type LineHeightKey = keyof typeof THEME_EXTENDED['lineHeight'];
export type LetterSpacingKey = keyof typeof THEME_EXTENDED['letterSpacing'];
export type TextStyleKey = keyof typeof THEME_EXTENDED['textStyles'];

