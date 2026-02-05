/**
 * GradientBackground - Animated gradient shader background for dark theme.
 *
 * Uses Three.js ShaderMaterial with custom GLSL shaders to create smooth,
 * animated gradient effects with subtle green accent glow.
 *
 * Features:
 * - Smooth animated radial gradients
 * - Subtle noise for organic movement
 * - Green accent glow pulse
 * - Sync with Remotion's useCurrentFrame()
 */
import React, {useRef, useEffect, useMemo} from 'react';
import {useCurrentFrame, useVideoConfig, AbsoluteFill} from 'remotion';
import {THEME} from '../theme';

// Convert hex color to RGB array
const hexToRgb = (hex: string): [number, number, number] => {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	if (!result) return [0, 0, 0];
	return [
		parseInt(result[1], 16) / 255,
		parseInt(result[2], 16) / 255,
		parseInt(result[3], 16) / 255,
	];
};

// GLSL Vertex Shader - passes through position and UV coordinates
const vertexShader = `
varying vec2 vUv;

void main() {
	vUv = uv;
	gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// GLSL Fragment Shader - creates animated gradient with noise and glow
const fragmentShader = `
uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uColorBg;
uniform vec3 uColorSubtle;
uniform vec3 uColorAccent;
uniform float uGlowIntensity;

varying vec2 vUv;

// Simplex-style noise function for organic movement
float hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);

	float a = hash(i);
	float b = hash(i + vec2(1.0, 0.0));
	float c = hash(i + vec2(0.0, 1.0));
	float d = hash(i + vec2(1.0, 1.0));

	return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Fractal Brownian Motion for layered noise
float fbm(vec2 p) {
	float value = 0.0;
	float amplitude = 0.5;
	vec2 shift = vec2(100.0);

	for (int i = 0; i < 4; i++) {
		value += amplitude * noise(p);
		p = p * 2.0 + shift;
		amplitude *= 0.5;
	}
	return value;
}

void main() {
	vec2 uv = vUv;
	vec2 aspectRatio = vec2(uResolution.x / uResolution.y, 1.0);
	vec2 centeredUv = (uv - 0.5) * aspectRatio;

	// Animated radial gradient from center
	float dist = length(centeredUv);
	float radialGradient = smoothstep(0.0, 1.2, dist);

	// Subtle noise movement
	float noiseValue = fbm(centeredUv * 2.0 + uTime * 0.1) * 0.15;

	// Base gradient between bg colors
	vec3 bgGradient = mix(uColorSubtle, uColorBg, radialGradient + noiseValue);

	// Green accent glow at top-left
	vec2 glowCenter = vec2(-0.3, 0.3);
	float glowDist = length(centeredUv - glowCenter);
	float glow = smoothstep(0.8, 0.0, glowDist) * uGlowIntensity;

	// Pulsing glow animation
	glow *= 0.5 + 0.5 * sin(uTime * 0.5);

	// Combine base gradient with accent glow
	vec3 finalColor = bgGradient + uColorAccent * glow * 0.3;

	// Add subtle vignette
	float vignette = 1.0 - smoothstep(0.5, 1.4, dist);
	finalColor *= 0.85 + 0.15 * vignette;

	gl_FragColor = vec4(finalColor, 1.0);
}
`;

interface GradientBackgroundProps {
	/** Base background color (default: theme bg) */
	bgColor?: string;
	/** Subtle gradient color (default: theme bgSubtle) */
	subtleColor?: string;
	/** Accent glow color (default: theme green) */
	accentColor?: string;
	/** Glow intensity 0-1 (default: 0.5) */
	glowIntensity?: number;
	/** Animation speed multiplier (default: 1) */
	speed?: number;
	/** Whether to animate (default: true) */
	animate?: boolean;
	/** Optional style overrides */
	style?: React.CSSProperties;
	/** Z-index for layering (default: -1) */
	zIndex?: number;
}

/**
 * Animated gradient background using canvas-based shader rendering.
 * Optimized for Remotion video rendering with frame-synced animations.
 */
export const GradientBackground: React.FC<GradientBackgroundProps> = ({
	bgColor = THEME.bg,
	subtleColor = THEME.bgSubtle,
	accentColor = THEME.green,
	glowIntensity = 0.5,
	speed = 1,
	animate = true,
	style,
	zIndex = -1,
}) => {
	const frame = useCurrentFrame();
	const {fps, width, height} = useVideoConfig();
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const glRef = useRef<WebGLRenderingContext | null>(null);
	const programRef = useRef<WebGLProgram | null>(null);
	const uniformsRef = useRef<Record<string, WebGLUniformLocation | null>>({});

	// Convert colors to RGB
	const colors = useMemo(() => ({
		bg: hexToRgb(bgColor),
		subtle: hexToRgb(subtleColor),
		accent: hexToRgb(accentColor),
	}), [bgColor, subtleColor, accentColor]);

	// Calculate time from frame
	const time = animate ? (frame / fps) * speed : 0;

	// Initialize WebGL context and shader program
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const gl = canvas.getContext('webgl', {
			alpha: false,
			antialias: false,
			preserveDrawingBuffer: true,
		});

		if (!gl) {
			console.warn('WebGL not supported, falling back to CSS gradient');
			return;
		}

		glRef.current = gl;

		// Compile shader
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

		// Create and link program
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
			uColorBg: gl.getUniformLocation(program, 'uColorBg'),
			uColorSubtle: gl.getUniformLocation(program, 'uColorSubtle'),
			uColorAccent: gl.getUniformLocation(program, 'uColorAccent'),
			uGlowIntensity: gl.getUniformLocation(program, 'uGlowIntensity'),
		};

		// Set up geometry (full-screen quad)
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

		// Update canvas size if needed
		if (canvas.width !== width || canvas.height !== height) {
			canvas.width = width;
			canvas.height = height;
			gl.viewport(0, 0, width, height);
		}

		gl.useProgram(program);

		// Update uniforms
		if (uniforms.uTime) gl.uniform1f(uniforms.uTime, time);
		if (uniforms.uResolution) gl.uniform2f(uniforms.uResolution, width, height);
		if (uniforms.uColorBg) gl.uniform3fv(uniforms.uColorBg, colors.bg);
		if (uniforms.uColorSubtle) gl.uniform3fv(uniforms.uColorSubtle, colors.subtle);
		if (uniforms.uColorAccent) gl.uniform3fv(uniforms.uColorAccent, colors.accent);
		if (uniforms.uGlowIntensity) gl.uniform1f(uniforms.uGlowIntensity, glowIntensity);

		// Draw
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	}, [time, width, height, colors, glowIntensity]);

	return (
		<AbsoluteFill
			style={{
				zIndex,
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
 * Fallback CSS gradient for when WebGL is not available.
 * Provides similar visual effect using CSS gradients and animations.
 */
export const GradientBackgroundCSS: React.FC<GradientBackgroundProps> = ({
	bgColor = THEME.bg,
	subtleColor = THEME.bgSubtle,
	accentColor = THEME.green,
	glowIntensity = 0.5,
	style,
	zIndex = -1,
}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const time = frame / fps;

	// Animate glow pulse
	const glowPulse = 0.5 + 0.5 * Math.sin(time * 0.5);
	const glowOpacity = glowIntensity * glowPulse * 0.3;

	return (
		<AbsoluteFill
			style={{
				zIndex,
				background: `
					radial-gradient(ellipse 80% 60% at 50% 40%, ${subtleColor} 0%, ${bgColor} 100%),
					radial-gradient(circle at 20% 20%, rgba(${hexToRgb(accentColor).map(c => Math.round(c * 255)).join(',')}, ${glowOpacity}) 0%, transparent 50%)
				`,
				...style,
			}}
		/>
	);
};

export default GradientBackground;
