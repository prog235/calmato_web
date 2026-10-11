import { type RefObject, useEffect } from "react";

type CleanRipple = {
  x: number;
  y: number;
  radius: number;
  strength: number;
  age: number;
  life: number;
  speed: number;
  isTrail: boolean;
};

const MAX_RENDER_RIPPLES = 32;
const MAX_CLICK_RIPPLES = 8;
// Keep the longer wakes within the 24 trail slots even during sustained motion.
const TRAIL_INTERVAL = 0.08;

const VERTEX_SHADER = `
  attribute vec2 a_position;
  varying vec2 v_uv;

  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const RENDER_SHADER = `
  precision highp float;

  varying vec2 v_uv;
  uniform sampler2D u_background;
  uniform vec2 u_imageUvScale;
  uniform vec2 u_imageUvTexel;
  uniform float u_time;
  uniform float u_refraction;
  uniform float u_ambientStrength;
  uniform float u_underwaterBlur;
  uniform float u_aspect;
  uniform float u_rippleCount;
  uniform vec4 u_ripples[32];
  uniform vec4 u_rippleMotion[32];

  // The derivative of a dispersing wave packet gives a continuous surface
  // normal, including the small troughs following the leading crest.
  vec2 waveGradient(vec2 center, float radius, float strength, float age, float trail) {
    vec2 delta = (v_uv - center) * vec2(u_aspect, 1.0);
    float distanceToCenter = length(delta);
    float width = mix(0.026, 0.032, trail) + age * mix(0.012, 0.014, trail);
    float front = (distanceToCenter - radius) / width;
    float envelope = exp(-front * front * 0.65);
    float slope = envelope * (sin(front * 3.6) * 0.78 +
      front * cos(front * 3.6) * 0.28);
    // Avoid a singular normal at the impact point and soften the initial dip.
    float centerMask = smoothstep(0.0, width * 0.7, distanceToCenter);
    vec2 direction = delta / max(distanceToCenter, 0.0001);
    return direction * slope * strength * centerMask;
  }

  void main() {
    vec2 gradient = vec2(0.0);

    for (int index = 0; index < 32; index++) {
      if (float(index) >= u_rippleCount) continue;
      vec4 ripple = u_ripples[index];
      vec4 motion = u_rippleMotion[index];
      gradient += waveGradient(ripple.xy, ripple.z, ripple.w, motion.x, motion.w);
      if (motion.w < 0.5) {
        // Reflections retain the original phase and lose energy at the bank.
        float reflectedStrength = ripple.w * 0.18;
        gradient += waveGradient(vec2(-ripple.x, ripple.y), ripple.z,
          reflectedStrength, motion.x, 0.0);
        gradient += waveGradient(vec2(2.0 - ripple.x, ripple.y), ripple.z,
          reflectedStrength, motion.x, 0.0);
        gradient += waveGradient(vec2(ripple.x, -ripple.y), ripple.z,
          reflectedStrength, motion.x, 0.0);
        gradient += waveGradient(vec2(ripple.x, 2.0 - ripple.y), ripple.z,
          reflectedStrength, motion.x, 0.0);
      }
    }
    // Saturate gently where waves interfere instead of sharply folding the image.
    gradient /= 1.0 + length(gradient) * 1.4;

    float waterMask = 1.0 - smoothstep(0.58, 0.96, v_uv.y);
    // Crossed swells and finer capillary waves give the whole screen a living
    // surface. The same slopes drive both refraction and reflected light.
    vec2 surfaceUv = v_uv * vec2(u_aspect, 1.0);
    float swellA = dot(surfaceUv, vec2(2.8, 6.5)) + u_time * 0.24;
    float swellB = dot(surfaceUv, vec2(-5.0, 3.8)) - u_time * 0.18;
    float swellC = dot(surfaceUv, vec2(18.0, 23.0)) + u_time * 0.28;
    float fineA = dot(surfaceUv, vec2(34.0, -51.0)) + sin(swellB) * 0.65 + u_time * 0.62;
    float fineB = dot(surfaceUv, vec2(57.0, 32.0)) + sin(swellA) * 0.55 - u_time * 0.52;
    vec2 surfaceSlope =
      normalize(vec2(2.8, 6.5)) * cos(swellA) * 0.042 +
      normalize(vec2(-5.0, 3.8)) * cos(swellB) * 0.032 +
      normalize(vec2(18.0, 23.0)) * cos(swellC) * 0.011 +
      normalize(vec2(34.0, -51.0)) * cos(fineA) * 0.004 +
      normalize(vec2(57.0, 32.0)) * cos(fineB) * 0.003;
    vec2 ambient = surfaceSlope * u_ambientStrength;
    vec2 distortion = gradient * u_refraction + ambient;

    vec2 imageUv = (v_uv - 0.5) * u_imageUvScale + 0.5;
    vec2 refractedUv = clamp(imageUv + distortion * vec2(1.0 / u_aspect, 1.0) * u_imageUvScale, 0.001, 0.999);
    vec2 blurStep = u_imageUvTexel * u_underwaterBlur;
    vec3 sharpColor = texture2D(u_background, refractedUv).rgb;
    vec3 blurredColor = sharpColor * 0.32;
    blurredColor += texture2D(
      u_background, clamp(refractedUv + vec2(blurStep.x, 0.0), 0.001, 0.999)
    ).rgb * 0.17;
    blurredColor += texture2D(
      u_background, clamp(refractedUv - vec2(blurStep.x, 0.0), 0.001, 0.999)
    ).rgb * 0.17;
    blurredColor += texture2D(
      u_background, clamp(refractedUv + vec2(0.0, blurStep.y), 0.001, 0.999)
    ).rgb * 0.17;
    blurredColor += texture2D(
      u_background, clamp(refractedUv - vec2(0.0, blurStep.y), 0.001, 0.999)
    ).rgb * 0.17;

    // Retain transparency at rest; only moving crests soften the image a little.
    float crestBlur = smoothstep(0.025, 0.22, length(gradient)) * 0.12;
    vec3 color = mix(sharpColor, blurredColor, 0.16 + crestBlur);
    color = clamp((color - 0.5) * 0.96 + 0.5, 0.0, 1.0);
    float hazeAmount = 0.006 + waterMask * 0.005;
    color = mix(color, vec3(0.43, 0.445, 0.455), hazeAmount);

    vec3 normal = normalize(vec3((gradient + surfaceSlope) * 3.8, 1.0));
    vec3 viewDirection = normalize(vec3((v_uv - 0.5) * vec2(0.25, 0.18), 1.0));
    vec3 reflected = reflect(-viewDirection, normal);
    vec3 lightDirection = normalize(vec3(-0.3, 0.45, 0.84));
    float lightAlignment = max(dot(reflected, lightDirection), 0.0);
    float softReflection = pow(lightAlignment, 10.0);
    float glint = pow(lightAlignment, 42.0);
    float fresnel = 0.025 + 0.975 * pow(1.0 - max(dot(normal, viewDirection), 0.0), 5.0);
    vec3 skyReflection = mix(vec3(0.24, 0.30, 0.34), vec3(0.70, 0.78, 0.81),
      smoothstep(-0.5, 0.8, reflected.y));
    color = mix(color, skyReflection, fresnel * 0.7);
    color += vec3(0.83, 0.92, 1.0) * (softReflection * 0.045 + glint * 0.075);
    // Paired light and shade follow the same normal as the refracted background.
    float facingLight = dot(normal.xy, normalize(lightDirection.xy));
    color *= 1.0 + clamp(facingLight, -0.5, 0.5) * 0.045;

    // Soft moving concentrations of light under the surface, bent by ripples.
    vec2 causticUv = surfaceUv + (gradient + surfaceSlope) * 0.24;
    float causticA = sin(dot(causticUv, vec2(21.0, 31.0)) + sin(swellB) + u_time * 0.31);
    float causticB = sin(dot(causticUv, vec2(-27.0, 19.0)) + sin(swellA) - u_time * 0.26);
    float caustic = pow(max(1.0 - abs(causticA + causticB) * 0.5, 0.0), 10.0);
    color += vec3(0.72, 0.86, 0.91) * caustic * (0.004 + waterMask * 0.005);
    color *= 1.0 - length(gradient) * 0.025;
    gl_FragColor = vec4(color, 1.0);
  }
`;

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Unable to create water shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? "Unknown shader error";
    gl.deleteShader(shader);
    throw new Error(message);
  }

  return shader;
}

function createProgram(
  gl: WebGLRenderingContext,
  vertexSource: string,
  fragmentSource: string
) {
  const program = gl.createProgram();
  if (!program) throw new Error("Unable to create water program");

  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) ?? "Unknown program error";
    gl.deleteProgram(program);
    throw new Error(message);
  }

  return program;
}

function uniform(gl: WebGLRenderingContext, program: WebGLProgram, name: string) {
  const location = gl.getUniformLocation(program, name);
  if (location === null) throw new Error(`Missing water uniform: ${name}`);
  return location;
}

export function useWaterRipples(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  backgroundSrc: string
) {
  useEffect(() => {
    const canvasElement = canvasRef.current;
    if (!canvasElement) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;

    const glContext = canvasElement.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    });
    if (!glContext) return;

    const canvas: HTMLCanvasElement = canvasElement;
    const gl: WebGLRenderingContext = glContext;

    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const isMobile = coarsePointer || window.innerWidth < 768;
    const cleanRipples: CleanRipple[] = [];
    const resources: Array<
      WebGLBuffer | WebGLTexture | WebGLProgram
    > = [];
    const image = new window.Image();

    let renderProgram: WebGLProgram;
    let quadBuffer: WebGLBuffer;
    let backgroundTexture: WebGLTexture;
    let canvasWidth = 1;
    let canvasHeight = 1;
    let imageReady = false;
    let animationFrame = 0;
    let startedAt = performance.now();
    let pointer: { x: number; y: number } | null = null;
    let smoothedPointer: { x: number; y: number } | null = null;
    let trailClock = 0;
    let previousAnimationTime = performance.now();
    const rippleData = new Float32Array(MAX_RENDER_RIPPLES * 4);
    const rippleMotionData = new Float32Array(MAX_RENDER_RIPPLES * 4);
    const locations = new Map<string, WebGLUniformLocation>();

    function renderUniform(name: string) {
      let location = locations.get(name);
      if (!location) {
        location = uniform(gl, renderProgram, name);
        locations.set(name, location);
      }
      return location;
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1 : 1.5);
      const nextWidth = Math.max(1, Math.round(rect.width * dpr));
      const nextHeight = Math.max(1, Math.round(rect.height * dpr));
      if (nextWidth === canvasWidth && nextHeight === canvasHeight) return;

      canvasWidth = nextWidth;
      canvasHeight = nextHeight;
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
    }

    function bindQuad(program: WebGLProgram) {
      const position = gl.getAttribLocation(program, "a_position");
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    }

    function imageUvScale() {
      const canvasAspect = canvasWidth / canvasHeight;
      const imageAspect = image.naturalWidth / image.naturalHeight;
      if (canvasAspect > imageAspect) {
        return { x: 1, y: imageAspect / canvasAspect };
      }
      return { x: canvasAspect / imageAspect, y: 1 };
    }

    function render(time: number) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvasWidth, canvasHeight);
      gl.useProgram(renderProgram);
      bindQuad(renderProgram);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, backgroundTexture);
      gl.uniform1i(renderUniform("u_background"), 0);

      const uvScale = imageUvScale();
      gl.uniform2f(
        renderUniform("u_imageUvScale"),
        uvScale.x,
        uvScale.y
      );
      gl.uniform2f(
        renderUniform("u_imageUvTexel"),
        uvScale.x / canvasWidth,
        uvScale.y / canvasHeight
      );
      gl.uniform1f(renderUniform("u_time"), (time - startedAt) / 1000);
      gl.uniform1f(
        renderUniform("u_refraction"),
        isMobile ? 0.02 : 0.034
      );
      gl.uniform1f(
        renderUniform("u_ambientStrength"),
        isMobile ? 0.045 : 0.07
      );
      gl.uniform1f(
        renderUniform("u_underwaterBlur"),
        isMobile ? 0.4 : 0.65
      );
      gl.uniform1f(
        renderUniform("u_aspect"),
        canvasWidth / canvasHeight
      );

      const visibleRipples = cleanRipples;
      rippleData.fill(0);
      rippleMotionData.fill(0);
      visibleRipples.forEach((ripple, index) => {
        const attack = Math.min(ripple.age / 0.12, 1);
        const fade = attack * attack * (3 - 2 * attack) *
          Math.pow(1 - ripple.age / ripple.life, ripple.isTrail ? 1.65 : 2) /
          Math.sqrt(1 + ripple.radius * 9);
        rippleData[index * 4] = ripple.x;
        rippleData[index * 4 + 1] = ripple.y;
        rippleData[index * 4 + 2] = ripple.radius;
        rippleData[index * 4 + 3] = ripple.strength * fade;
        rippleMotionData[index * 4] = ripple.age;
        rippleMotionData[index * 4 + 3] = ripple.isTrail ? 1 : 0;
      });
      gl.uniform1f(
        renderUniform("u_rippleCount"),
        visibleRipples.length
      );
      gl.uniform4fv(
        renderUniform("u_ripples[0]"),
        rippleData
      );
      gl.uniform4fv(
        renderUniform("u_rippleMotion[0]"),
        rippleMotionData
      );
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    function animate(time: number) {
      const delta = Math.min((time - previousAnimationTime) / 1000, 0.04);
      previousAnimationTime = time;

      for (let index = cleanRipples.length - 1; index >= 0; index -= 1) {
        const ripple = cleanRipples[index];
        ripple.age += delta;
        ripple.radius += ripple.speed * delta;
        if (ripple.age >= ripple.life) cleanRipples.splice(index, 1);
      }

      if (pointer && smoothedPointer) {
        const previous = { ...smoothedPointer };
        const follow = 1 - Math.exp(-delta / 0.045);
        smoothedPointer.x += (pointer.x - smoothedPointer.x) * follow;
        smoothedPointer.y += (pointer.y - smoothedPointer.y) * follow;
        const distance = Math.hypot(
          (smoothedPointer.x - previous.x) * canvasWidth / canvasHeight,
          smoothedPointer.y - previous.y
        );
        const speed = distance / Math.max(delta, 0.001);
        trailClock += delta;
        if (trailClock >= TRAIL_INTERVAL && speed > 0.012) {
          addRipple(smoothedPointer, true, Math.min(0.184 + speed * 0.176, 0.384));
          trailClock %= TRAIL_INTERVAL;
        }
      }
      if (imageReady) render(time);
      animationFrame = window.requestAnimationFrame(animate);
    }

    function pointerPosition(event: PointerEvent) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left) / rect.width,
        y: 1 - (event.clientY - rect.top) / rect.height,
      };
    }

    function addRipple(point: { x: number; y: number }, isTrail: boolean, strength: number) {
      const count = cleanRipples.filter((ripple) => ripple.isTrail === isTrail).length;
      const capacity = isTrail ? MAX_RENDER_RIPPLES - MAX_CLICK_RIPPLES : MAX_CLICK_RIPPLES;
      // Keep existing waves alive; rapid input must not erase a visible crest.
      if (count >= capacity) return;
      cleanRipples.push({
        ...point,
        radius: 0,
        strength: strength * (isMobile ? 0.75 : 1),
        age: 0,
        life: isTrail ? 1.8 : 4.8,
        speed: isTrail ? 0.18 : 0.22,
        isTrail,
      });
    }

    function onPointerDown(event: PointerEvent) {
      if (!event.isPrimary || event.button !== 0) return;
      addRipple(pointerPosition(event), false, 0.72);
    }

    function onPointerMove(event: PointerEvent) {
      if (event.pointerType === "touch" || !event.isPrimary) return;
      pointer = pointerPosition(event);
      if (!smoothedPointer) smoothedPointer = { ...pointer };
    }

    function resetPointer() {
      pointer = null;
      smoothedPointer = null;
      trailClock = 0;
    }

    function onVisibilityChange() {
      resetPointer();
      window.cancelAnimationFrame(animationFrame);
      if (!document.hidden) {
        previousAnimationTime = performance.now();
        animationFrame = window.requestAnimationFrame(animate);
      }
    }

    function dispose() {
      image.onload = null;
      window.cancelAnimationFrame(animationFrame);
      for (const resource of resources) {
        if (resource instanceof WebGLProgram) gl.deleteProgram(resource);
        else if (resource instanceof WebGLBuffer) gl.deleteBuffer(resource);
        else if (resource instanceof WebGLTexture) gl.deleteTexture(resource);
      }
    }

    function initialize() {
      renderProgram = createProgram(gl, VERTEX_SHADER, RENDER_SHADER);
      resources.push(renderProgram);

      const buffer = gl.createBuffer();
      if (!buffer) throw new Error("Unable to create water geometry");
      quadBuffer = buffer;
      resources.push(buffer);
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
        gl.STATIC_DRAW
      );

      const texture = gl.createTexture();
      if (!texture) throw new Error("Unable to create water background");
      backgroundTexture = texture;
      resources.push(texture);
      gl.bindTexture(gl.TEXTURE_2D, backgroundTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);

      resize();
      startedAt = performance.now();
      animationFrame = window.requestAnimationFrame(animate);
    }

    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, backgroundTexture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        image
      );
      imageReady = true;
    };

    try {
      initialize();
      image.src = backgroundSrc;
    } catch (error) {
      dispose();
      console.error("Unable to initialize the water surface", error);
      return;
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove, { passive: true });

    canvas.addEventListener("pointerleave", resetPointer);
    canvas.addEventListener("pointercancel", resetPointer);
    window.addEventListener("blur", resetPointer);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      resizeObserver.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", resetPointer);
      canvas.removeEventListener("pointercancel", resetPointer);
      window.removeEventListener("blur", resetPointer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      dispose();
    };
  }, [backgroundSrc, canvasRef]);
}
