"use client";

import { useEffect, useMemo, useRef, type CSSProperties } from "react";

/**
 * Self-contained extraction of the "portal-field" effect from MengTo/threeui's
 * NeuformBatchEffects collection (PortalFieldCollection's default variant).
 *
 * The upstream component bakes a small ambient Three.js shader HTML document
 * into a sandboxed iframe, then "isolates" just the `#webgl-container`
 * background element (hiding the rest of the original landing-page markup
 * that the shader was originally embedded in) so only the glowing portal
 * arc renders full-bleed. All of that baking/isolation/knob logic — plus the
 * verbatim shader HTML — is inlined here so this file has no dependency on
 * sibling effect files (flow-field, cloud-field, bell-field, stream
 * convergence) that live in other unrelated modules of the source repo.
 */

const PORTAL_FIELD_SOURCE = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AEON // Portal</title>
</head>
<body style="
    --bg-base: #020202;
    background-color: var(--bg-base);
    margin: 0;
" class="min-h-screen overflow-hidden">

    <!-- Ambient Background -->
    <div id="webgl-container" class="absolute inset-0 z-0 pointer-events-none opacity-80 mix-blend-screen"></div>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js"></script>
    <script>
        const container = document.getElementById('webgl-container');
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
        camera.position.z = 1;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);

        const geometry = new THREE.PlaneGeometry(2, 2);

        const vertexShader = \`
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = vec4(position, 1.0);
            }
        \`;

        const fragmentShader = \`
            uniform float u_time;
            uniform vec2 u_resolution;
            uniform vec2 u_mouse;
            uniform vec3 u_colorCore;
            uniform vec3 u_colorFringe;
            uniform float u_isLightMode;
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
                vec3 h = max( 0.5-vec3(dot(a,a), dot(b,b), dot(c,c) ), 0.0 );
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

                vec2 center = vec2(0.5, 0.5);

                float d1 = sdArc(st, center, __ARC1_RADIUS__, __ARC1_WIDTH__, 0.15);
                float d2 = sdArc(st, center, __ARC2_RADIUS__, __ARC2_WIDTH__, 0.2);

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

                gl_FragColor = vec4(finalColor, alpha * 0.6);
            }
        \`;

        const material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: {
                u_time: { value: 0.0 },
                u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
                u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
                u_colorCore: { value: new THREE.Color('__CORE_COLOR__') },
                u_colorFringe: { value: new THREE.Color('__FRINGE_COLOR__') },
                u_isLightMode: { value: __IS_LIGHT__ }
            },
            transparent: true,
            blending: THREE.AdditiveBlending
        });

        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        let targetMouse = new THREE.Vector2(0.5, 0.5);
        document.addEventListener('mousemove', (e) => {
            targetMouse.x = e.clientX / window.innerWidth;
            targetMouse.y = 1.0 - (e.clientY / window.innerHeight);
        });

        const clock = new THREE.Clock();
        function animate() {
            requestAnimationFrame(animate);
            material.uniforms.u_time.value = clock.getElapsedTime() * ((window.__PORTAL_CONTROLS && window.__PORTAL_CONTROLS.speed) || 1);
            material.uniforms.u_mouse.value.lerp(targetMouse, 0.03);
            renderer.render(scene, camera);
        }
        animate();

        window.addEventListener('resize', () => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            renderer.setSize(width, height);
            material.uniforms.u_resolution.value.set(width, height);
        });

        window.addEventListener('message', (event) => {
            if (!event.data || event.data.type !== 'portal-controls') return;
            window.__PORTAL_CONTROLS = event.data.controls || {};
            const opacity = window.__PORTAL_CONTROLS.opacity == null ? 1 : window.__PORTAL_CONTROLS.opacity;
            container.style.opacity = String(opacity);
        });
    </script>
</body>
</html>`;

export type PortalFieldCollectionProps = {
  /** Kept for API parity with the upstream collection; this build only ships the default "portal-field" effect. */
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

/** WebGL1 GLSL ES requires float literals (10.0), not ints (10). */
function glslFloat(value: number, digits = 3) {
  const fixed = Number(value).toFixed(digits);
  return fixed.includes(".") ? fixed : `${fixed}.0`;
}

const THEMES = {
  dark: { core: "#FFFFFF", fringe: "#1e3a8a", isLight: 0 },
  light: { core: "#020202", fringe: "#94a3b8", isLight: 1 },
};

function buildSource(mode: "dark" | "light", size: number, length: number) {
  const theme = THEMES[mode];
  return PORTAL_FIELD_SOURCE.replace(
    "__ARC1_RADIUS__",
    glslFloat(0.6 * length, 3),
  )
    .replace("__ARC1_WIDTH__", glslFloat(0.02 * size, 4))
    .replace("__ARC2_RADIUS__", glslFloat(0.65 * length, 3))
    .replace("__ARC2_WIDTH__", glslFloat(0.06 * size, 4))
    .replace("__CORE_COLOR__", theme.core)
    .replace("__FRINGE_COLOR__", theme.fringe)
    .replace("__IS_LIGHT__", glslFloat(theme.isLight, 1));
}

export default function PortalFieldCollection({
  mode = DEFAULTS.mode,
  speed = DEFAULTS.speed,
  size = DEFAULTS.size,
  length = DEFAULTS.length,
  opacity = DEFAULTS.opacity,
  hue = DEFAULTS.hue,
  saturation = DEFAULTS.saturation,
  brightness = DEFAULTS.brightness,
  className,
  style,
}: PortalFieldCollectionProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const safeSpeed = clamp(speed, 0, 3);
  const safeSize = clamp(size, 0.05, 4);
  const safeLength = clamp(length, 0.35, 2.5);
  const safeOpacity = clamp(opacity, 0.05, 1);
  const safeHue = clamp(hue, -180, 180);
  const safeSaturation = clamp(saturation, 0, 2);
  const safeBrightness = clamp(brightness, 0.35, 1.65);

  const source = useMemo(
    () => buildSource(mode, safeSize, safeLength),
    [mode, safeSize, safeLength],
  );

  useEffect(() => {
    const frame = iframeRef.current?.contentWindow;
    if (!frame) return;
    frame.postMessage(
      {
        type: "portal-controls",
        controls: { speed: safeSpeed, opacity: safeOpacity },
      },
      "*",
    );
  }, [safeSpeed, safeOpacity, source]);

  const filter =
    safeHue === 0 && safeSaturation === 1 && safeBrightness === 1
      ? undefined
      : `hue-rotate(${safeHue}deg) saturate(${safeSaturation}) brightness(${safeBrightness})`;

  return (
    <iframe
      ref={iframeRef}
      className={className}
      title="Portal Field"
      srcDoc={source}
      sandbox="allow-scripts"
      loading="eager"
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        border: 0,
        background: mode === "light" ? "#eef1f6" : "#05060a",
        filter,
        ...style,
      }}
    />
  );
}
