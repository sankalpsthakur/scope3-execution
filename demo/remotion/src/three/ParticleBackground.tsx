/**
 * Three.js Particle Background Component for Remotion
 *
 * A subtle, ambient particle effect that enhances the premium dark theme.
 * Particles float gently upward with a soft glow, creating depth without distraction.
 *
 * Performance considerations:
 * - Low particle count (optimized for video rendering)
 * - Memoized geometry and materials
 * - Uses instanced rendering for efficiency
 * - Syncs with Remotion's useCurrentFrame() for deterministic renders
 */
import React, {useMemo, useRef} from 'react';
import {useCurrentFrame, useVideoConfig, interpolate} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {
	Points,
	BufferGeometry,
	Float32BufferAttribute,
	PointsMaterial,
	AdditiveBlending,
	Vector3,
} from 'three';
import {THEME} from '../theme';

/** Configuration for the particle system */
interface ParticleConfig {
	/** Number of particles (keep low for render performance) */
	count?: number;
	/** Color of particles (hex string) */
	color?: string;
	/** Maximum opacity of particles */
	maxOpacity?: number;
	/** Speed multiplier for vertical movement */
	speed?: number;
	/** Spread of particles on X/Y axes */
	spread?: number;
	/** Depth spread on Z axis */
	depth?: number;
	/** Base size of particles */
	size?: number;
	/** Fade in duration in frames */
	fadeInFrames?: number;
}

const DEFAULT_CONFIG: Required<ParticleConfig> = {
	count: 60,
	color: THEME.green,
	maxOpacity: 0.35,
	speed: 0.008,
	spread: 12,
	depth: 8,
	size: 0.08,
	fadeInFrames: 30,
};

/**
 * Seeded random number generator for deterministic particle positions
 * This ensures consistent renders across frames and machines
 */
function seededRandom(seed: number): () => number {
	let state = seed;
	return () => {
		state = (state * 1103515245 + 12345) & 0x7fffffff;
		return state / 0x7fffffff;
	};
}

/**
 * Particle cloud component that renders within the Three.js scene
 */
const ParticleCloud: React.FC<{config: Required<ParticleConfig>; frame: number; fadeOpacity: number}> = ({
	config,
	frame,
	fadeOpacity,
}) => {
	const pointsRef = useRef<Points>(null);

	// Memoize particle positions (deterministic based on seed)
	const {positions, velocities, phases} = useMemo(() => {
		const rand = seededRandom(42);
		const pos: number[] = [];
		const vel: number[] = [];
		const pha: number[] = [];

		for (let i = 0; i < config.count; i++) {
			// Random starting positions
			pos.push(
				(rand() - 0.5) * config.spread,  // x
				(rand() - 0.5) * config.spread,  // y
				(rand() - 0.5) * config.depth - 4 // z (pushed back from camera)
			);

			// Random velocities for organic movement
			vel.push(
				(rand() - 0.5) * 0.002, // x drift
				rand() * 0.5 + 0.5,     // y upward bias
				(rand() - 0.5) * 0.001  // z drift
			);

			// Random phase offset for size/opacity variation
			pha.push(rand() * Math.PI * 2);
		}

		return {
			positions: new Float32Array(pos),
			velocities: vel,
			phases: pha,
		};
	}, [config.count, config.spread, config.depth]);

	// Memoize geometry to avoid recreating every frame
	const geometry = useMemo(() => {
		const geo = new BufferGeometry();
		geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
		return geo;
	}, [positions]);

	// Memoize material
	const material = useMemo(() => {
		return new PointsMaterial({
			color: config.color,
			size: config.size,
			transparent: true,
			opacity: config.maxOpacity * fadeOpacity,
			blending: AdditiveBlending,
			depthWrite: false,
			sizeAttenuation: true,
		});
	}, [config.color, config.size, config.maxOpacity, fadeOpacity]);

	// Update particle positions based on frame (deterministic animation)
	useMemo(() => {
		const positionAttribute = geometry.getAttribute('position');
		if (!positionAttribute) return;

		const posArray = positionAttribute.array as Float32Array;
		const time = frame * config.speed;

		for (let i = 0; i < config.count; i++) {
			const i3 = i * 3;

			// Calculate new Y position with wrap-around
			const baseY = positions[i3 + 1];
			const yVelocity = velocities[i * 3 + 1];
			let newY = baseY + time * yVelocity;

			// Wrap particles that go above the viewport
			const halfSpread = config.spread / 2;
			if (newY > halfSpread) {
				newY = -halfSpread + (newY - halfSpread) % config.spread;
			}

			// Subtle horizontal drift using sine waves for organic feel
			const phase = phases[i];
			const xDrift = Math.sin(time * 0.5 + phase) * 0.3;
			const zDrift = Math.cos(time * 0.3 + phase * 1.5) * 0.2;

			posArray[i3] = positions[i3] + xDrift;
			posArray[i3 + 1] = newY;
			posArray[i3 + 2] = positions[i3 + 2] + zDrift;
		}

		positionAttribute.needsUpdate = true;
	}, [frame, geometry, positions, velocities, phases, config]);

	return <primitive object={new Points(geometry, material)} />;
};

/**
 * Floating geometric shapes that add depth to the background
 */
const FloatingShapes: React.FC<{frame: number; fadeOpacity: number}> = ({frame, fadeOpacity}) => {
	const time = frame * 0.01;

	// Create subtle rotating wireframe shapes
	const shapes = useMemo(() => {
		const rand = seededRandom(123);
		return Array.from({length: 5}, (_, i) => ({
			position: new Vector3(
				(rand() - 0.5) * 10,
				(rand() - 0.5) * 8,
				-6 - rand() * 4
			),
			rotationSpeed: (rand() - 0.5) * 0.3,
			scale: 0.3 + rand() * 0.4,
			phase: rand() * Math.PI * 2,
		}));
	}, []);

	return (
		<>
			{shapes.map((shape, i) => {
				const rotation = time * shape.rotationSpeed + shape.phase;
				const breathe = Math.sin(time * 0.5 + shape.phase) * 0.1;

				return (
					<mesh
						key={i}
						position={shape.position}
						rotation={[rotation, rotation * 0.7, 0]}
						scale={shape.scale + breathe}
					>
						<icosahedronGeometry args={[1, 0]} />
						<meshBasicMaterial
							color={THEME.green}
							wireframe
							transparent
							opacity={0.08 * fadeOpacity}
						/>
					</mesh>
				);
			})}
		</>
	);
};

export interface ParticleBackgroundProps extends ParticleConfig {
	/** Whether to show floating geometric shapes */
	showShapes?: boolean;
	/** Z-index for layering (default: 0) */
	zIndex?: number;
}

/**
 * Main particle background component using @remotion/three
 *
 * Usage:
 * ```tsx
 * <ParticleBackground color={THEME.green} count={80} />
 * ```
 */
export const ParticleBackground: React.FC<ParticleBackgroundProps> = ({
	showShapes = true,
	zIndex = 0,
	...configOverrides
}) => {
	const frame = useCurrentFrame();
	const {width, height} = useVideoConfig();

	// Merge config with defaults
	const config = useMemo(
		() => ({...DEFAULT_CONFIG, ...configOverrides}),
		[configOverrides]
	);

	// Fade in animation
	const fadeOpacity = interpolate(frame, [0, config.fadeInFrames], [0, 1], {
		extrapolateRight: 'clamp',
	});

	// Camera configuration for depth perspective
	const cameraConfig = useMemo(
		() => ({
			fov: 50,
			near: 0.1,
			far: 100,
			position: [0, 0, 5] as [number, number, number],
		}),
		[]
	);

	return (
		<div
			style={{
				position: 'absolute',
				top: 0,
				left: 0,
				width,
				height,
				zIndex,
				pointerEvents: 'none',
			}}
		>
			<ThreeCanvas
				width={width}
				height={height}
				camera={cameraConfig}
				style={{
					background: 'transparent',
				}}
			>
				<ambientLight intensity={0.5} />
				<ParticleCloud config={config} frame={frame} fadeOpacity={fadeOpacity} />
				{showShapes && <FloatingShapes frame={frame} fadeOpacity={fadeOpacity} />}
			</ThreeCanvas>
		</div>
	);
};

export default ParticleBackground;
