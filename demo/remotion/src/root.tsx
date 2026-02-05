import {Composition, Folder, Still} from 'remotion';
import {z} from 'zod';

import {HighlightReel} from './scenes/HighlightReel';
import {Thumbnail} from './stills/Thumbnail';

export const HighlightReelSchema = z.object({
	title: z.string().default('Scope3: Evidence-First Scope 3 MRV'),
	subtitle: z.string().default('Integrations → Measure → Evidence → Quality → Locks'),
});

export type HighlightReelProps = z.infer<typeof HighlightReelSchema>;

export const RemotionRoot: React.FC = () => {
	return (
		<>
			<Folder name="Marketing">
				<Composition
					id="Marketing-HighlightReel1080p"
					component={HighlightReel}
					durationInFrames={30 * 22}
					fps={30}
					width={1920}
					height={1080}
					defaultProps={
						{
							title: 'Scope3: Evidence-First Scope 3 MRV',
							subtitle: 'Integrations → Measure → Evidence → Quality → Locks',
						} satisfies HighlightReelProps
					}
				/>
			</Folder>

			<Folder name="Stills">
				<Still id="Stills-Thumbnail" component={Thumbnail} width={1280} height={720} />
			</Folder>
		</>
	);
};

