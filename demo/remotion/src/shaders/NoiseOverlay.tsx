/**
 * NoiseOverlay - Film grain and noise texture effect.
 *
 * Adds subtle film grain/noise texture to video for a cinematic,
 * high-production quality feel. Can be animated or static.
 *
 * Features:
 * - Configurable grain intensity
 * - Animated grain with frame sync
 * - Blend modes for different effects
 * - Performance optimized with WebGL
 */
import React, {useRef, useEffect, useMemo, useCallback} from 'react';
import {useCurrentFrame, useVideoConfig, AbsoluteFill, interpolate} from 'remotion';

// GLSL Vertex Shader
const vertexShader = `
varying vec2 vUv;

void main() {
	vUv = uv;
	gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// GLSL Fragment Shader for film grain
const fragmentShader = `
uniform float uTime;
uniform vec2 uResolution;
uniform float uIntensity;
uniform float uSize;
uniform int uMonochrome;

varying vec2 vUv;

// High quality pseudo-random function
float random(vec2 st) {
	return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

// Film grain noise function
float grain(vec2 texCoord, float t) {
	vec2 mult = texCoord * uResolution / uSize;
	float offset = random(vec2(t, t));
	return random(mult + offset);
}

void main() {
	vec2 uv = vUv;

	// Generate animated grain
	float g = grain(uv, uTime);

	// Center around 0.5 for neutral grain
	g = g - 0.5;

	// Apply intensity
	g *= uIntensity;

	vec3 color;
	if (uMonochrome == 1) {
		// Monochrome grain
		color = vec3(g);
	} else {
		// RGB grain (subtle color shifts)
		float r = grain(uv + vec2(0.1, 0.0), uTime);
		float b = grain(uv + vec2(0.0, 0.1), uTime);
		color = vec3((r - 0.5) * uIntensity, g, (b - 0.5) * uIntensity);
	}

	// Output with alpha for blending
	// Using 0.5 + color allows for overlay blend mode effect
	gl_FragColor = vec4(0.5 + color, 1.0);
}
`;

interface NoiseOverlayProps {
	/** Grain intensity 0-1 (default: 0.08) */
	intensity?: number;
	/** Grain size in pixels (default: 1.5) */
	size?: number;
	/** Use monochrome grain (default: true) */
	monochrome?: boolean;
	/** Animate grain per frame (default: true) */
	animate?: boolean;
	/** CSS blend mode (default: 'overlay') */
	blendMode?: 'overlay' | 'soft-light' | 'hard-light' | 'multiply' | 'screen' | 'normal';
	/** Overall opacity (default: 1) */
	opacity?: number;
	/** Fade in duration in frames (default: 0) */
	fadeInFrames?: number;
	/** Optional style overrides */
	style?: React.CSSProperties;
	/** Z-index for layering (default: 100) */
	zIndex?: number;
}

/**
 * Film grain noise overlay using WebGL shader.
 * Syncs animation with Remotion frames for consistent video rendering.
 */
export const NoiseOverlay: React.FC<NoiseOverlayProps> = ({
	intensity = 0.08,
	size = 1.5,
	monochrome = true,
	animate = true,
	blendMode = 'overlay',
	opacity = 1,
	fadeInFrames = 0,
	style,
	zIndex = 100,
}) => {
	const frame = useCurrentFrame();
	const {fps, width, height} = useVideoConfig();
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const glRef = useRef<WebGLRenderingContext | null>(null);
	const programRef = useRef<WebGLProgram | null>(null);
	const uniformsRef = useRef<Record<string, WebGLUniformLocation | null>>({});

	// Calculate animated time
	const time = animate ? frame : 0;

	// Fade in calculation
	const fadeOpacity = fadeInFrames > 0
		? interpolate(frame, [0, fadeInFrames], [0, 1], {extrapolateRight: 'clamp'})
		: 1;

	const finalOpacity = opacity * fadeOpacity;

	// Initialize WebGL
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const gl = canvas.getContext('webgl', {
			alpha: true,
			antialias: false,
			preserveDrawingBuffer: true,
			premultipliedAlpha: false,
		});

		if (!gl) {
			console.warn('WebGL not supported for noise overlay');
			return;
		}

		glRef.current = gl;

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

		// Get uniform locations
		uniformsRef.current = {
			uTime: gl.getUniformLocation(program, 'uTime'),
			uResolution: gl.getUniformLocation(program, 'uResolution'),
			uIntensity: gl.getUniformLocation(program, 'uIntensity'),
			uSize: gl.getUniformLocation(program, 'uSize'),
			uMonochrome: gl.getUniformLocation(program, 'uMonochrome'),
		};

		// Set up geometry
		const positionBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
			-1, -1, 0, 0,
			 1, -1, 1, 0,
			-1,  1, 0, 1,
			 1,  1, 1, 1,
		]), gl.STATIC_DRAW);

		const positionLoc = gl.getAttribLocation(program, 'position');
		const uvLoc = gl.getAttribLocation(program, 'uv');
		gl.enableVertexAttribArray(positionLoc);
		gl.enableVertexAttribArray(uvLoc);
		gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 16, 0);
		gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 16, 8);

		return () => {
			gl.deleteProgram(program);
			gl.deleteShader(vs);
			gl.deleteShader(fs);
		};
	}, []);

	// Render each frame
	useEffect(() => {
		const gl = glRef.current;
		const program = programRef.current;
		const uniforms = uniformsRef.current;
		const canvas = canvasRef.current;

		if (!gl || !program || !canvas) return;

		if (canvas.width !== width || canvas.height !== height) {
			canvas.width = width;
			canvas.height = height;
			gl.viewport(0, 0, width, height);
		}

		gl.useProgram(program);
		gl.clearColor(0.5, 0.5, 0.5, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);

		if (uniforms.uTime) gl.uniform1f(uniforms.uTime, time);
		if (uniforms.uResolution) gl.uniform2f(uniforms.uResolution, width, height);
		if (uniforms.uIntensity) gl.uniform1f(uniforms.uIntensity, intensity);
		if (uniforms.uSize) gl.uniform1f(uniforms.uSize, size);
		if (uniforms.uMonochrome) gl.uniform1i(uniforms.uMonochrome, monochrome ? 1 : 0);

		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	}, [time, width, height, intensity, size, monochrome]);

	return (
		<AbsoluteFill
			style={{
				zIndex,
				pointerEvents: 'none',
				mixBlendMode: blendMode,
				opacity: finalOpacity,
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
 * CSS-based noise overlay fallback.
 * Uses SVG filter for noise when WebGL is unavailable.
 */
export const NoiseOverlayCSS: React.FC<NoiseOverlayProps> = ({
	intensity = 0.08,
	blendMode = 'overlay',
	opacity = 1,
	fadeInFrames = 0,
	style,
	zIndex = 100,
}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();

	const fadeOpacity = fadeInFrames > 0
		? interpolate(frame, [0, fadeInFrames], [0, 1], {extrapolateRight: 'clamp'})
		: 1;

	const filterId = useMemo(() => `noise-filter-${Math.random().toString(36).substr(2, 9)}`, []);

	// Animate seed for grain movement
	const seed = frame % 100;

	return (
		<AbsoluteFill
			style={{
				zIndex,
				pointerEvents: 'none',
				opacity: opacity * fadeOpacity,
				...style,
			}}
		>
			<svg width="100%" height="100%" style={{position: 'absolute'}}>
				<defs>
					<filter id={filterId}>
						<feTurbulence
							type="fractalNoise"
							baseFrequency={0.8}
							numOctaves={4}
							seed={seed}
							stitchTiles="stitch"
						/>
						<feColorMatrix type="saturate" values="0" />
					</filter>
				</defs>
				<rect
					width="100%"
					height="100%"
					filter={`url(#${filterId})`}
					style={{
						mixBlendMode: blendMode,
						opacity: intensity * 2,
					}}
				/>
			</svg>
		</AbsoluteFill>
	);
};

export default NoiseOverlay;
