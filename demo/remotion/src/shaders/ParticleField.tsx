/**
 * ParticleField - Floating particle system for depth and atmosphere.
 *
 * Creates subtle floating particles that add depth and visual interest.
 * Particles slowly drift upward with gentle horizontal sway.
 *
 * Features:
 * - Configurable particle count and size
 * - Parallax depth effect with multiple layers
 * - Smooth fade in/out at edges
 * - Frame-synced animation for video rendering
 */
import React, {useMemo, useRef, useEffect} from 'react';
import {useCurrentFrame, useVideoConfig, AbsoluteFill, interpolate} from 'remotion';
import {THEME} from '../theme';

// Seeded random for deterministic particle positions
const seededRandom = (seed: number): number => {
	const x = Math.sin(seed * 9999) * 10000;
	return x - Math.floor(x);
};

interface Particle {
	id: number;
	x: number;
	y: number;
	size: number;
	speed: number;
	opacity: number;
	layer: number;
	swayOffset: number;
	swaySpeed: number;
}

// GLSL Vertex Shader for particle rendering
const vertexShader = `
attribute vec2 aPosition;
attribute float aSize;
attribute float aOpacity;

uniform vec2 uResolution;
uniform float uPointScale;

varying float vOpacity;

void main() {
	// Convert pixel coordinates to clip space
	vec2 clipSpace = (aPosition / uResolution) * 2.0 - 1.0;
	clipSpace.y = -clipSpace.y; // Flip Y

	gl_Position = vec4(clipSpace, 0.0, 1.0);
	gl_PointSize = aSize * uPointScale;
	vOpacity = aOpacity;
}
`;

// GLSL Fragment Shader for soft circular particles
const fragmentShader = `
precision mediump float;

uniform vec3 uColor;

varying float vOpacity;

void main() {
	// Create soft circular particle
	vec2 center = gl_PointCoord - 0.5;
	float dist = length(center);

	// Soft edge falloff
	float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
	alpha *= vOpacity;

	// Subtle glow effect
	float glow = 1.0 - smoothstep(0.0, 0.5, dist);
	glow *= 0.3;

	gl_FragColor = vec4(uColor, alpha + glow * vOpacity);
}
`;

interface ParticleFieldProps {
	/** Number of particles (default: 50) */
	count?: number;
	/** Particle color (default: theme green) */
	color?: string;
	/** Minimum particle size (default: 2) */
	minSize?: number;
	/** Maximum particle size (default: 6) */
	maxSize?: number;
	/** Minimum particle opacity (default: 0.1) */
	minOpacity?: number;
	/** Maximum particle opacity (default: 0.4) */
	maxOpacity?: number;
	/** Upward drift speed multiplier (default: 1) */
	speed?: number;
	/** Horizontal sway amount (default: 30) */
	swayAmount?: number;
	/** Number of depth layers (default: 3) */
	layers?: number;
	/** Random seed for particle positions (default: 12345) */
	seed?: number;
	/** Fade in duration in frames (default: 30) */
	fadeInFrames?: number;
	/** Edge fade margin in pixels (default: 100) */
	edgeFade?: number;
	/** Optional style overrides */
	style?: React.CSSProperties;
	/** Z-index for layering (default: 1) */
	zIndex?: number;
}

// Convert hex to RGB
const hexToRgb = (hex: string): [number, number, number] => {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	if (!result) return [0.13, 0.77, 0.37]; // Default green
	return [
		parseInt(result[1], 16) / 255,
		parseInt(result[2], 16) / 255,
		parseInt(result[3], 16) / 255,
	];
};

/**
 * WebGL-based particle field with floating particles.
 * Optimized for smooth animation synced with Remotion frames.
 */
export const ParticleField: React.FC<ParticleFieldProps> = ({
	count = 50,
	color = THEME.green,
	minSize = 2,
	maxSize = 6,
	minOpacity = 0.1,
	maxOpacity = 0.4,
	speed = 1,
	swayAmount = 30,
	layers = 3,
	seed = 12345,
	fadeInFrames = 30,
	edgeFade = 100,
	style,
	zIndex = 1,
}) => {
	const frame = useCurrentFrame();
	const {fps, width, height} = useVideoConfig();
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const glRef = useRef<WebGLRenderingContext | null>(null);
	const programRef = useRef<WebGLProgram | null>(null);
	const buffersRef = useRef<{
		position: WebGLBuffer | null;
		size: WebGLBuffer | null;
		opacity: WebGLBuffer | null;
	}>({position: null, size: null, opacity: null});
	const uniformsRef = useRef<Record<string, WebGLUniformLocation | null>>({});

	// Generate particles once with seed
	const particles = useMemo((): Particle[] => {
		const result: Particle[] = [];

		for (let i = 0; i < count; i++) {
			const layer = (i % layers) + 1;
			const layerSpeed = layer / layers; // Faster for closer layers

			result.push({
				id: i,
				x: seededRandom(seed + i * 1.1) * width,
				y: seededRandom(seed + i * 2.2) * height,
				size: minSize + seededRandom(seed + i * 3.3) * (maxSize - minSize) * layerSpeed,
				speed: (0.3 + seededRandom(seed + i * 4.4) * 0.7) * layerSpeed,
				opacity: minOpacity + seededRandom(seed + i * 5.5) * (maxOpacity - minOpacity) * layerSpeed,
				layer,
				swayOffset: seededRandom(seed + i * 6.6) * Math.PI * 2,
				swaySpeed: 0.5 + seededRandom(seed + i * 7.7) * 0.5,
			});
		}

		return result;
	}, [count, seed, width, height, minSize, maxSize, minOpacity, maxOpacity, layers]);

	// Calculate time
	const time = frame / fps;

	// Fade in
	const globalOpacity = interpolate(frame, [0, fadeInFrames], [0, 1], {
		extrapolateRight: 'clamp',
	});

	// RGB color
	const colorRgb = useMemo(() => hexToRgb(color), [color]);

	// Initialize WebGL
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const gl = canvas.getContext('webgl', {
			alpha: true,
			antialias: true,
			preserveDrawingBuffer: true,
			premultipliedAlpha: true,
		});

		if (!gl) {
			console.warn('WebGL not supported for particle field');
			return;
		}

		glRef.current = gl;

		// Enable point sprites
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

		// Compile shaders
		const compileShader = (type: number, source: string): WebGLShader | null => {
			const shader = gl.createShader(type);
			if (!shader) return null;
			gl.shaderSource(shader, source);
			gl.compileShader(shader);
			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
				console.error('Shader compile error:', gl.getShaderInfoLog(shader));
				gl.deleteShader(shader);
				return null;
			}
			return shader;
		};

		const vs = compileShader(gl.VERTEX_SHADER, vertexShader);
		const fs = compileShader(gl.FRAGMENT_SHADER, fragmentShader);
		if (!vs || !fs) return;

		const program = gl.createProgram();
		if (!program) return;
		gl.attachShader(program, vs);
		gl.attachShader(program, fs);
		gl.linkProgram(program);

		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			console.error('Program link error:', gl.getProgramInfoLog(program));
			return;
		}

		programRef.current = program;
		gl.useProgram(program);

		// Get locations
		uniformsRef.current = {
			uResolution: gl.getUniformLocation(program, 'uResolution'),
			uPointScale: gl.getUniformLocation(program, 'uPointScale'),
			uColor: gl.getUniformLocation(program, 'uColor'),
		};

		// Create buffers
		buffersRef.current = {
			position: gl.createBuffer(),
			size: gl.createBuffer(),
			opacity: gl.createBuffer(),
		};

		return () => {
			gl.deleteProgram(program);
			gl.deleteShader(vs);
			gl.deleteShader(fs);
		};
	}, []);

	// Update and render particles each frame
	useEffect(() => {
		const gl = glRef.current;
		const program = programRef.current;
		const buffers = buffersRef.current;
		const uniforms = uniformsRef.current;
		const canvas = canvasRef.current;

		if (!gl || !program || !canvas) return;

		if (canvas.width !== width || canvas.height !== height) {
			canvas.width = width;
			canvas.height = height;
			gl.viewport(0, 0, width, height);
		}

		gl.useProgram(program);
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);

		// Calculate animated particle positions
		const positions: number[] = [];
		const sizes: number[] = [];
		const opacities: number[] = [];

		for (const particle of particles) {
			// Calculate position with drift and sway
			const drift = time * 30 * speed * particle.speed;
			let y = particle.y - drift;

			// Wrap around when particle goes off top
			y = ((y % height) + height) % height;

			// Horizontal sway
			const sway = Math.sin(time * particle.swaySpeed + particle.swayOffset) * swayAmount * particle.speed;
			const x = particle.x + sway;

			// Edge fade calculation
			const edgeFadeX = Math.min(
				x / edgeFade,
				(width - x) / edgeFade,
				1
			);
			const edgeFadeY = Math.min(
				y / edgeFade,
				(height - y) / edgeFade,
				1
			);
			const edgeFadeMultiplier = Math.max(0, Math.min(edgeFadeX, edgeFadeY));

			positions.push(x, y);
			sizes.push(particle.size);
			opacities.push(particle.opacity * globalOpacity * edgeFadeMultiplier);
		}

		// Update buffers
		const positionLoc = gl.getAttribLocation(program, 'aPosition');
		const sizeLoc = gl.getAttribLocation(program, 'aSize');
		const opacityLoc = gl.getAttribLocation(program, 'aOpacity');

		if (buffers.position) {
			gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW);
			gl.enableVertexAttribArray(positionLoc);
			gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);
		}

		if (buffers.size) {
			gl.bindBuffer(gl.ARRAY_BUFFER, buffers.size);
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sizes), gl.DYNAMIC_DRAW);
			gl.enableVertexAttribArray(sizeLoc);
			gl.vertexAttribPointer(sizeLoc, 1, gl.FLOAT, false, 0, 0);
		}

		if (buffers.opacity) {
			gl.bindBuffer(gl.ARRAY_BUFFER, buffers.opacity);
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(opacities), gl.DYNAMIC_DRAW);
			gl.enableVertexAttribArray(opacityLoc);
			gl.vertexAttribPointer(opacityLoc, 1, gl.FLOAT, false, 0, 0);
		}

		// Set uniforms
		if (uniforms.uResolution) gl.uniform2f(uniforms.uResolution, width, height);
		if (uniforms.uPointScale) gl.uniform1f(uniforms.uPointScale, 1);
		if (uniforms.uColor) gl.uniform3fv(uniforms.uColor, colorRgb);

		// Draw particles
		gl.drawArrays(gl.POINTS, 0, particles.length);
	}, [frame, time, width, height, particles, globalOpacity, colorRgb, speed, swayAmount, edgeFade]);

	return (
		<AbsoluteFill
			style={{
				zIndex,
				pointerEvents: 'none',
				...style,
			}}
		>
			<canvas
				ref={canvasRef}
				width={width}
				height={height}
				style={{
					width: '100%',
					height: '100%',
					display: 'block',
				}}
			/>
		</AbsoluteFill>
	);
};

/**
 * CSS-based particle field fallback.
 * Uses CSS transforms for particle animation.
 */
export const ParticleFieldCSS: React.FC<ParticleFieldProps> = ({
	count = 30,
	color = THEME.green,
	minSize = 2,
	maxSize = 6,
	minOpacity = 0.1,
	maxOpacity = 0.4,
	speed = 1,
	swayAmount = 30,
	seed = 12345,
	fadeInFrames = 30,
	style,
	zIndex = 1,
}) => {
	const frame = useCurrentFrame();
	const {fps, width, height} = useVideoConfig();
	const time = frame / fps;

	const globalOpacity = interpolate(frame, [0, fadeInFrames], [0, 1], {
		extrapolateRight: 'clamp',
	});

	// Generate particles
	const particles = useMemo(() => {
		const result = [];
		for (let i = 0; i < count; i++) {
			result.push({
				id: i,
				x: seededRandom(seed + i * 1.1) * 100,
				y: seededRandom(seed + i * 2.2) * 100,
				size: minSize + seededRandom(seed + i * 3.3) * (maxSize - minSize),
				speed: 0.3 + seededRandom(seed + i * 4.4) * 0.7,
				opacity: minOpacity + seededRandom(seed + i * 5.5) * (maxOpacity - minOpacity),
				swayOffset: seededRandom(seed + i * 6.6) * Math.PI * 2,
				swaySpeed: 0.5 + seededRandom(seed + i * 7.7) * 0.5,
			});
		}
		return result;
	}, [count, seed, minSize, maxSize, minOpacity, maxOpacity]);

	return (
		<AbsoluteFill
			style={{
				zIndex,
				pointerEvents: 'none',
				overflow: 'hidden',
				opacity: globalOpacity,
				...style,
			}}
		>
			{particles.map((particle) => {
				const drift = time * 3 * speed * particle.speed;
				const y = ((particle.y - drift * 10) % 120) - 10;
				const sway = Math.sin(time * particle.swaySpeed + particle.swayOffset) * swayAmount * particle.speed * 0.1;

				return (
					<div
						key={particle.id}
						style={{
							position: 'absolute',
							left: `${particle.x + sway}%`,
							top: `${y}%`,
							width: particle.size,
							height: particle.size,
							borderRadius: '50%',
							backgroundColor: color,
							opacity: particle.opacity,
							boxShadow: `0 0 ${particle.size}px ${color}`,
						}}
					/>
				);
			})}
		</AbsoluteFill>
	);
};

export default ParticleField;
