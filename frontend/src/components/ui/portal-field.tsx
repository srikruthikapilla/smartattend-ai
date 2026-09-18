"use client";

import React, { useEffect, useRef, useMemo, type CSSProperties } from "react";
import * as THREE from "three";

export type PortalFieldCollectionProps = {
  /** Kept for API parity with the upstream collection */
  variant?: "portal-field";
  mode?: "dark" | "light";
  speed?: number;
  size?: number;
  length?: number;
  density?: number;
  opacity?: number;
  hue?: number;
  saturation?: number;
  brightness?: number;
  coreColor?: string;
  fringeColor?: string;
  className?: string;
  style?: CSSProperties;
};

const DEFAULTS = {
  mode: "dark" as const,
  speed: 1,
  size: 1,
  length: 1,
  density: 1,
  opacity: 1,
  hue: 0,
  saturation: 1,
  brightness: 1,
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

const THEMES = {
  dark: { core: "#FFFFFF", fringe: "#0d9488", isLight: 0 },
  light: { core: "#020202", fringe: "#94a3b8", isLight: 1 },
};

const VERTEX_SHADER = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
}
`;

const FRAGMENT_SHADER = `
uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform vec3 u_colorCore;
uniform vec3 u_colorFringe;
uniform float u_isLightMode;
uniform float u_arc1Radius;
uniform float u_arc1Width;
uniform float u_arc2Radius;
uniform float u_arc2Width;
uniform float u_opacity;
varying vec2 vUv;

vec2 hash( vec2 p ) {
    p = vec2( dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)) );
    return -1.0 + 2.0*fract(sin(p)*43758.5453123);
}

float noise( in vec2 p ) {
    const float K1 = 0.366025404;
    const float K2 = 0.211324865;
    vec2 i = floor( p + (p.x+p.y)*K1 );
    vec2 a = p - i + (i.x+i.y)*K2;
    vec2 o = (a.x>a.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);
    vec2 b = a - o + K2;
    vec2 c = a - 1.0 + 2.0*K2;
    vec3 h = max( vec3(0.5) - vec3(dot(a,a), dot(b,b), dot(c,c)), 0.0 );
    vec3 n = h*h*h*h*vec3( dot(a,hash(i+0.0)), dot(b,hash(i+o)), dot(c,hash(i+1.0)));
    return dot( n, vec3(70.0) );
}

float sdArc(vec2 p, vec2 center, float radius, float width, float warp) {
    p.y += sin(p.x * 2.0 + u_time * 0.3) * warp;
    p.x += noise(p * 1.5 + u_time * 0.1) * (warp * 0.8);
    float d = length(p - center) - radius;
    return abs(d) - width;
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec2 st = uv;
    st.x *= u_resolution.x / u_resolution.y;

    vec2 mouseOffset = (u_mouse - 0.5) * 0.05;
    st += mouseOffset;

    vec2 center = vec2(0.5 * (u_resolution.x / u_resolution.y), 0.5);

    float d1 = sdArc(st, center, u_arc1Radius, u_arc1Width, 0.15);
    float d2 = sdArc(st, center, u_arc2Radius, u_arc2Width, 0.2);

    float coreGlow = exp(-d1 * 30.0);
    float fringeGlow = exp(-d2 * 10.0);
    float wash = smoothstep(1.5, -0.5, length(st - center)) * 0.15;

    vec3 finalColor = vec3(0.0);
    finalColor += u_colorCore * coreGlow;
    finalColor += u_colorFringe * fringeGlow;
    finalColor += u_colorFringe * wash * (sin(u_time * 0.5) * 0.2 + 0.8);

    float alpha = clamp(coreGlow + fringeGlow + wash, 0.0, 1.0);
    finalColor = vec3(1.0) - exp(-finalColor * 1.5);

    if(u_isLightMode > 0.5) {
        alpha = clamp((coreGlow * 1.2 + fringeGlow + wash * 0.4), 0.0, 0.4);
    }

    gl_FragColor = vec4(finalColor, alpha * 0.75 * u_opacity);
}
`;

export default function PortalFieldCollection({
  mode = DEFAULTS.mode,
  speed = DEFAULTS.speed,
  size = DEFAULTS.size,
  length = DEFAULTS.length,
  opacity = DEFAULTS.opacity,
  hue = DEFAULTS.hue,
  saturation = DEFAULTS.saturation,
  brightness = DEFAULTS.brightness,
  coreColor,
  fringeColor,
  className,
  style,
}: PortalFieldCollectionProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const safeSpeed = clamp(speed, 0, 3);
  const safeSize = clamp(size, 0.05, 4);
  const safeLength = clamp(length, 0.35, 2.5);
  const safeOpacity = clamp(opacity, 0.05, 1);
  const safeHue = clamp(hue, -180, 180);
  const safeSaturation = clamp(saturation, 0, 2);
  const safeBrightness = clamp(brightness, 0.35, 1.65);

  const theme = THEMES[mode] || THEMES.dark;
  const activeCoreColor = coreColor || theme.core;
  const activeFringeColor = fringeColor || theme.fringe;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let width = container.clientWidth || 400;
    let height = container.clientHeight || 400;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    container.appendChild(renderer.domElement);

    const geometry = new THREE.PlaneGeometry(2, 2);

    const uniforms = {
      u_time: { value: 0.0 },
      u_resolution: { value: new THREE.Vector2(width, height) },
      u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
      u_colorCore: { value: new THREE.Color(activeCoreColor) },
      u_colorFringe: { value: new THREE.Color(activeFringeColor) },
      u_isLightMode: { value: theme.isLight },
      u_arc1Radius: { value: 0.6 * safeLength },
      u_arc1Width: { value: 0.02 * safeSize },
      u_arc2Radius: { value: 0.65 * safeLength },
      u_arc2Width: { value: 0.06 * safeSize },
      u_opacity: { value: safeOpacity },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms,
      transparent: true,
      blending: THREE.AdditiveBlending,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const targetMouse = new THREE.Vector2(0.5, 0.5);

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        targetMouse.x = (e.clientX - rect.left) / rect.width;
        targetMouse.y = 1.0 - (e.clientY - rect.top) / rect.height;
      }
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: newWidth, height: newHeight } = entry.contentRect;
        if (newWidth > 0 && newHeight > 0) {
          width = newWidth;
          height = newHeight;
          renderer.setSize(width, height);
          uniforms.u_resolution.value.set(width, height);
        }
      }
    });

    resizeObserver.observe(container);

    const clock = new THREE.Clock();
    let animId: number;

    function animate() {
      animId = requestAnimationFrame(animate);
      uniforms.u_time.value = clock.getElapsedTime() * safeSpeed;
      uniforms.u_mouse.value.lerp(targetMouse, 0.03);
      renderer.render(scene, camera);
    }

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("mousemove", handleMouseMove);
      resizeObserver.disconnect();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, [safeSpeed, safeSize, safeLength, safeOpacity, activeCoreColor, activeFringeColor, theme.isLight]);

  const filter = useMemo(() => {
    if (safeHue === 0 && safeSaturation === 1 && safeBrightness === 1) {
      return undefined;
    }
    return `hue-rotate(${safeHue}deg) saturate(${safeSaturation}) brightness(${safeBrightness})`;
  }, [safeHue, safeSaturation, safeBrightness]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full relative overflow-hidden pointer-events-none ${className || ""}`}
      style={{
        background: mode === "light" ? "#eef1f6" : "#020202",
        filter,
        ...style,
      }}
    />
  );
}
