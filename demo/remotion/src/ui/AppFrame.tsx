import React, {useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import {THEME, THEME_EXTENDED, LAYOUT} from '../theme';

/** Navigation items in the sidebar */
const SIDEBAR_ITEMS = [
	'Measure',
	'Reduce',
	'Engage',
	'Report',
	'Integrations',
	'Evidence',
	'Quality',
] as const;

export type SidebarItem = (typeof SIDEBAR_ITEMS)[number];

export interface AppFrameProps {
	active: SidebarItem;
	title: string;
	children: React.ReactNode;
}

interface SidebarItemProps {
	label: SidebarItem;
	isActive: boolean;
}

/**
 * Individual sidebar navigation item.
 * Features subtle hover-like active state with gradient background.
 */
const SidebarNavItem: React.FC<SidebarItemProps> = React.memo(({label, isActive}) => {
	const itemStyles = useMemo(() => ({
		display: 'flex' as const,
		alignItems: 'center' as const,
		gap: 10,
		padding: '10px 14px',
		borderRadius: THEME_EXTENDED.radius.md,
		background: isActive
			? `linear-gradient(90deg, rgba(34,197,94,0.12) 0%, rgba(34,197,94,0.04) 100%)`
			: 'transparent',
		border: `1px solid ${isActive ? 'rgba(34,197,94,0.20)' : 'transparent'}`,
		transition: 'all 0.2s ease',
	}), [isActive]);

	const dotStyles = useMemo(() => ({
		width: 8,
		height: 8,
		borderRadius: THEME_EXTENDED.radius.pill,
		backgroundColor: isActive ? THEME.green : 'rgba(255,255,255,0.15)',
		boxShadow: isActive ? `0 0 8px ${THEME.greenGlow}` : 'none',
		flexShrink: 0,
	}), [isActive]);

	const labelStyles = useMemo(() => ({
		fontSize: THEME_EXTENDED.fontSize.base,
		fontWeight: isActive ? THEME_EXTENDED.fontWeight.semibold : THEME_EXTENDED.fontWeight.medium,
		color: isActive ? THEME.text : THEME.textTertiary,
		letterSpacing: -0.1,
	}), [isActive]);

	return (
		<div style={itemStyles}>
			<div style={dotStyles} />
			<div style={labelStyles}>{label}</div>
		</div>
	);
});

/**
 * App logo component in the sidebar header.
 * Features gradient icon with subtle glow effect.
 */
const AppLogo: React.FC = React.memo(() => {
	const logoContainerStyles = useMemo(() => ({
		display: 'flex' as const,
		alignItems: 'center' as const,
		gap: 14,
		marginBottom: THEME_EXTENDED.space.lg,
		paddingBottom: THEME_EXTENDED.space.lg,
		borderBottom: `1px solid ${THEME.borderSubtle}`,
	}), []);

	const logoIconStyles = useMemo(() => ({
		width: 44,
		height: 44,
		borderRadius: THEME_EXTENDED.radius.md,
		background: THEME_EXTENDED.gradient.greenShine,
		display: 'flex' as const,
		alignItems: 'center' as const,
		justifyContent: 'center' as const,
		fontWeight: THEME_EXTENDED.fontWeight.black,
		fontSize: THEME_EXTENDED.fontSize.md,
		color: '#000000',
		boxShadow: [
			THEME_EXTENDED.glow.greenSubtle,
			THEME_EXTENDED.shadow.sm,
		].join(', '),
		letterSpacing: -0.5,
	}), []);

	const brandTextStyles = useMemo(() => ({
		fontWeight: THEME_EXTENDED.fontWeight.black,
		letterSpacing: -0.5,
		fontSize: THEME_EXTENDED.fontSize.md,
		color: THEME.text,
	}), []);

	const taglineStyles = useMemo(() => ({
		fontSize: THEME_EXTENDED.fontSize.xs,
		color: THEME.muted,
		letterSpacing: 1.0,
		fontWeight: THEME_EXTENDED.fontWeight.medium,
		marginTop: 2,
	}), []);

	return (
		<div style={logoContainerStyles}>
			<div style={logoIconStyles}>S3</div>
			<div>
				<div style={brandTextStyles}>SCOPE3</div>
				<div style={taglineStyles}>CARBON INTELLIGENCE</div>
			</div>
		</div>
	);
});

/**
 * Main application frame with sidebar navigation.
 * Features gradient background overlay and polished sidebar.
 */
export const AppFrame: React.FC<AppFrameProps> = React.memo(({active, title, children}) => {
	const containerStyles = useMemo(() => ({
		backgroundColor: THEME.bg,
		color: THEME.text,
		fontFamily: THEME_EXTENDED.fonts.heading,
	}), []);

	const sidebarStyles = useMemo(() => ({
		width: LAYOUT.sidebarWidth,
		// Subtle gradient for depth
		background: `linear-gradient(180deg, ${THEME.panel} 0%, ${THEME.bgSubtle} 100%)`,
		borderRight: `1px solid ${THEME.border}`,
		padding: THEME_EXTENDED.space.lg,
		boxSizing: 'border-box' as const,
		display: 'flex' as const,
		flexDirection: 'column' as const,
	}), []);

	const contentStyles = useMemo(() => ({
		flex: 1,
		padding: LAYOUT.contentPadding,
		boxSizing: 'border-box' as const,
		position: 'relative' as const,
	}), []);

	const titleStyles = useMemo(() => ({
		fontSize: THEME_EXTENDED.fontSize['4xl'],
		fontWeight: THEME_EXTENDED.fontWeight.black,
		letterSpacing: -1.5,
		lineHeight: THEME_EXTENDED.lineHeight.tight,
		color: THEME.text,
	}), []);

	const sectionLabelStyles = useMemo(() => ({
		fontSize: THEME_EXTENDED.fontSize.xs,
		color: THEME.muted,
		letterSpacing: 1.2,
		fontWeight: THEME_EXTENDED.fontWeight.semibold,
		marginBottom: THEME_EXTENDED.space.sm,
		textTransform: 'uppercase' as const,
	}), []);

	return (
		<AbsoluteFill style={containerStyles}>
			{/* Subtle ambient gradient overlay */}
			<div
				style={{
					position: 'absolute',
					inset: 0,
					background: THEME_EXTENDED.gradient.bgRadial,
					pointerEvents: 'none',
				}}
			/>

			<div style={{display: 'flex', height: '100%', position: 'relative'}}>
				{/* Sidebar */}
				<div style={sidebarStyles}>
					<AppLogo />

					<div style={sectionLabelStyles}>MODULES</div>

					<div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
						{SIDEBAR_ITEMS.map((item) => (
							<SidebarNavItem key={item} label={item} isActive={item === active} />
						))}
					</div>

					{/* Sidebar footer spacer */}
					<div style={{flex: 1}} />
				</div>

				{/* Main content area */}
				<div style={contentStyles}>
					<div style={{marginBottom: THEME_EXTENDED.space.md}}>
						<div style={titleStyles}>{title}</div>
					</div>
					{children}
				</div>
			</div>
		</AbsoluteFill>
	);
});

