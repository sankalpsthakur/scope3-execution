import React from 'react';
import {AbsoluteFill} from 'remotion';
import {THEME, THEME_EXTENDED, OPACITY} from '../theme';

export const Thumbnail: React.FC = () => {
	return (
		<AbsoluteFill
			style={{
				backgroundColor: THEME.bg,
				fontFamily: THEME_EXTENDED.fonts.heading,
				color: THEME.text,
				padding: THEME_EXTENDED.space['3xl'],
				boxSizing: 'border-box',
				justifyContent: 'center',
			}}
		>
			<div
				style={{
					display: 'inline-flex',
					alignItems: 'center',
					gap: 10,
					padding: '10px 14px',
					borderRadius: THEME_EXTENDED.radius.pill,
					border: `1px solid ${THEME.border}`,
					backgroundColor: `rgba(255,255,255,${OPACITY.subtle})`,
					color: THEME.textSecondary,
					fontWeight: THEME_EXTENDED.fontWeight.extrabold,
					fontSize: THEME_EXTENDED.fontSize.base,
				}}
			>
				<span style={{color: THEME.green}}>●</span> Scope3 demo assets
			</div>

			<div style={{...THEME_EXTENDED.textStyles.displayMedium, marginTop: 18}}>
				Evidence-first
				<br />
				Scope 3 MRV
			</div>

			<div style={{marginTop: THEME_EXTENDED.space.md, ...THEME_EXTENDED.textStyles.bodyLarge, color: THEME.textTertiary}}>
				Integrations → Measure → Evidence → Quality → Locks
			</div>

			<div style={{marginTop: THEME_EXTENDED.space.xl, display: 'flex', gap: 12, flexWrap: 'wrap'}}>
				{['Coupa', 'SAP Ariba', 'Concur', 'Workday', 'NetSuite', 'project44', 'SFTP/CSV'].map((x) => (
					<span
						key={x}
						style={{
							padding: '8px 12px',
							borderRadius: THEME_EXTENDED.radius.pill,
							border: `1px solid ${THEME.border}`,
							backgroundColor: `rgba(255,255,255,${OPACITY.subtle})`,
							color: THEME.textSecondary,
							...THEME_EXTENDED.textStyles.caption,
							fontWeight: THEME_EXTENDED.fontWeight.extrabold,
						}}
					>
						{x}
					</span>
				))}
			</div>
		</AbsoluteFill>
	);
};

