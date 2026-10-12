'use client';

import { cn } from '@/lib/utils';
import { type CSSProperties, useEffect, useRef } from 'react';

export interface DitheredLogoProps {
  imageSrc: string;
  gridSize?: number;
  scale?: number;
  dotScale?: number;
  invert?: boolean;
  cornerRadius?: number;
  threshold?: number;
  contrast?: number;
  gamma?: number;
  blur?: number;
  diffusionStrength?: number;
  serpentine?: boolean;
  particleColor?: string;
  style?: CSSProperties;
  className?: string;
}

type PointCloud = {
  x: Float32Array;
  y: Float32Array;
  dx: Float32Array;
  dy: Float32Array;
  dotSize: number;
};

type Wave = { x: number; y: number; bornAt: number };

const defaults = {
  gridSize: 200,
  scale: 0.5,
  dotScale: 1,
  invert: true,
  cornerRadius: 0.2,
  threshold: 180,
  contrast: 0,
  gamma: 1,
  blur: 3.75,
  diffusionStrength: 1,
  serpentine: true,
};

function loadAsset(source: string, signal: AbortSignal) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const abort = () => reject(new DOMException('Aborted', 'AbortError'));
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      signal.removeEventListener('abort', abort);
      resolve(image);
    };
    image.onerror = () => reject(new Error(`Unable to load image: ${source}`));
    signal.addEventListener('abort', abort, { once: true });
    image.src = source;
  });
}

function sampleImage(
  image: HTMLImageElement,
  maxDimension: number,
  contrast: number,
  gamma: number,
  blur: number,
) {
  const ratio = image.naturalWidth / image.naturalHeight;
  const width = Math.max(1, Math.round(ratio >= 1 ? maxDimension : maxDimension * ratio));
  const height = Math.max(1, Math.round(ratio >= 1 ? maxDimension / ratio : maxDimension));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('DitheredLogo could not create a 2D context.');

  context.clearRect(0, 0, width, height);
  context.filter = blur > 0 ? `blur(${blur}px)` : 'none';
  context.drawImage(image, 0, 0, width, height);
  context.filter = 'none';

  const pixels = context.getImageData(0, 0, width, height).data;
  const luminance = new Float32Array(width * height);
  const alpha = new Uint8Array(width * height);
  const contrastScale = contrast === 0 ? 1 : (259 * (contrast + 255)) / (255 * (259 - contrast));

  for (let pixel = 0; pixel < width * height; pixel++) {
    const offset = pixel * 4;
    alpha[pixel] = pixels[offset + 3]!;
    const luma =
      pixels[offset]! * 0.2126 + pixels[offset + 1]! * 0.7152 + pixels[offset + 2]! * 0.0722;
    const contrasted = contrastScale * (luma - 128) + 128;
    luminance[pixel] =
      255 * Math.pow(Math.min(1, Math.max(0, contrasted / 255)), 1 / Math.max(0.01, gamma));
  }

  return { width, height, luminance, alpha };
}

function insideRoundedRect(x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.max(0, Math.min(Math.min(width, height) / 2, radius));
  const nearX = x < r ? r : x > width - r - 1 ? width - r - 1 : x;
  const nearY = y < r ? r : y > height - r - 1 ? height - r - 1 : y;
  return (x - nearX) ** 2 + (y - nearY) ** 2 <= r ** 2;
}

function diffuse(
  input: Float32Array,
  alpha: Uint8Array,
  width: number,
  height: number,
  threshold: number,
  strength: number,
  serpentine: boolean,
  invert: boolean,
  cornerRadius: number,
) {
  const values = input.slice();
  const output: number[] = [];
  const addError = (x: number, y: number, error: number, weight: number) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const index = y * width + x;
    if (alpha[index]! < 128) return;
    values[index] = values[index]! + error * weight * strength;
  };

  for (let y = 0; y < height; y++) {
    const reverse = serpentine && y % 2 === 1;
    for (let column = 0; column < width; column++) {
      const x = reverse ? width - column - 1 : column;
      const index = y * width + x;
      if (alpha[index]! < 128) continue;
      const on = values[index]! >= threshold;
      const chosen = on ? 255 : 0;
      const error = values[index]! - chosen;
      const direction = reverse ? -1 : 1;

      if (
        (invert ? !on : on) &&
        (!invert || insideRoundedRect(x, y, width, height, cornerRadius * Math.min(width, height)))
      ) {
        output.push(x, y);
      }

      addError(x + direction, y, error, 7 / 16);
      addError(x - direction, y + 1, error, 3 / 16);
      addError(x, y + 1, error, 5 / 16);
      addError(x + direction, y + 1, error, 1 / 16);
    }
  }
  return new Float32Array(output);
}

function createCloud(
  points: Float32Array,
  gridWidth: number,
  gridHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  scale: number,
  dotScale: number,
): PointCloud {
  const unit = (Math.min(canvasWidth, canvasHeight) * scale) / Math.max(gridWidth, gridHeight);
  const originX = (canvasWidth - gridWidth * unit) / 2;
  const originY = (canvasHeight - gridHeight * unit) / 2;
  const count = points.length / 2;
  const x = new Float32Array(count);
  const y = new Float32Array(count);

  for (let index = 0; index < count; index++) {
    x[index] = originX + points[index * 2]! * unit;
    y[index] = originY + points[index * 2 + 1]! * unit;
  }

  return {
    x,
    y,
    dx: new Float32Array(count),
    dy: new Float32Array(count),
    dotSize: Math.max(0.5, unit * dotScale),
  };
}

class ParticleRenderer {
  private frame = 0;
  private cloud: PointCloud | null = null;
  private pointer = { x: 0, y: 0, active: false };
  private waves: Wave[] = [];
  private color = '#000';
  /* Upstream hard-codes the cursor/ripple distances in pixels, tuned for the
     240px demo. At a 32px sidebar mark that pushes every particle clean off
     the canvas, so the logo disappears on hover. Derived from the canvas box
     instead — the factors below reproduce the original numbers at 240px. */
  private reach = 100;
  private push = 38;
  private waveSpeed = 0.23;
  private waveWidth = 38;
  private waveForce = 20;

  /* Plain fields rather than constructor parameter properties: the web app
     builds with `erasableSyntaxOnly`, which rejects that TypeScript-only form. */
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
    this.canvas = canvas;
    this.context = context;
  }

  setCloud(cloud: PointCloud) {
    this.cloud = cloud;
    this.play();
  }

  setColor(color: string) {
    this.color = color;
    this.play();
  }

  movePointer(x: number, y: number) {
    this.pointer = { x, y, active: true };
    this.play();
  }

  releasePointer() {
    this.pointer.active = false;
    this.play();
  }

  addWave(x: number, y: number) {
    this.waves.push({ x, y, bornAt: performance.now() });
    this.play();
  }

  resize(width: number, height: number) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.round(width * dpr));
    this.canvas.height = Math.max(1, Math.round(height * dpr));
    this.context.setTransform(dpr, 0, 0, dpr, 0, 0);

    const base = Math.min(width, height);
    this.reach = base * 0.417;
    this.push = base * 0.158;
    this.waveSpeed = base * 0.00096;
    this.waveWidth = base * 0.158;
    this.waveForce = base * 0.083;
  }

  stop() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  private play = () => {
    if (!this.frame) this.frame = requestAnimationFrame(this.tick);
  };

  private tick = (now: number) => {
    this.frame = 0;
    const cloud = this.cloud;
    if (!cloud) return;
    const bounds = this.canvas.getBoundingClientRect();
    this.waves = this.waves.filter((wave) => now - wave.bornAt < 720);
    let moving = this.pointer.active || this.waves.length > 0;

    this.context.clearRect(0, 0, bounds.width, bounds.height);
    this.context.fillStyle = this.color;

    for (let index = 0; index < cloud.x.length; index++) {
      let forceX = 0;
      let forceY = 0;
      const px = cloud.x[index]!;
      const py = cloud.y[index]!;

      if (this.pointer.active) {
        const vx = px + cloud.dx[index]! - this.pointer.x;
        const vy = py + cloud.dy[index]! - this.pointer.y;
        const distance = Math.hypot(vx, vy);
        if (distance > 0.1 && distance < this.reach) {
          const strength = (1 - distance / this.reach) ** 2 * this.push;
          forceX += (vx / distance) * strength;
          forceY += (vy / distance) * strength;
        }
      }

      for (const wave of this.waves) {
        const age = now - wave.bornAt;
        const vx = px - wave.x;
        const vy = py - wave.y;
        const distance = Math.hypot(vx, vy);
        const ring = Math.abs(distance - age * this.waveSpeed);
        if (distance > 0.1 && ring < this.waveWidth) {
          const strength = (1 - ring / this.waveWidth) * (1 - age / 720) * this.waveForce;
          forceX += (vx / distance) * strength;
          forceY += (vy / distance) * strength;
        }
      }

      cloud.dx[index] = cloud.dx[index]! * 0.84 + forceX * 0.16;
      cloud.dy[index] = cloud.dy[index]! * 0.84 + forceY * 0.16;
      if (Math.abs(cloud.dx[index]!) > 0.02 || Math.abs(cloud.dy[index]!) > 0.02) {
        moving = true;
      } else {
        cloud.dx[index] = 0;
        cloud.dy[index] = 0;
      }
      this.context.fillRect(
        px + cloud.dx[index]!,
        py + cloud.dy[index]!,
        cloud.dotSize,
        cloud.dotSize,
      );
    }

    if (moving) this.play();
  };
}

export function DitheredLogo({
  imageSrc,
  gridSize = defaults.gridSize,
  scale = defaults.scale,
  dotScale = defaults.dotScale,
  invert = defaults.invert,
  cornerRadius = defaults.cornerRadius,
  threshold = defaults.threshold,
  contrast = defaults.contrast,
  gamma = defaults.gamma,
  blur = defaults.blur,
  diffusionStrength = defaults.diffusionStrength,
  serpentine = defaults.serpentine,
  particleColor = 'currentColor',
  style,
  className,
}: DitheredLogoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const renderer = new ParticleRenderer(canvas, context);
    const abortController = new AbortController();
    let sampled: ReturnType<typeof sampleImage> | null = null;
    let points: Float32Array | null = null;
    let rebuildFrame = 0;

    const resolveColor = () =>
      particleColor === 'currentColor' ? getComputedStyle(canvas).color : particleColor;
    const rebuildCloud = () => {
      if (!sampled || !points) return;
      const bounds = canvas.getBoundingClientRect();
      renderer.resize(bounds.width, bounds.height);
      renderer.setColor(resolveColor());
      renderer.setCloud(
        createCloud(
          points,
          sampled.width,
          sampled.height,
          bounds.width,
          bounds.height,
          scale,
          dotScale * (bounds.width <= 640 ? 0.8 : 1),
        ),
      );
    };
    const scheduleRebuild = () => {
      cancelAnimationFrame(rebuildFrame);
      rebuildFrame = requestAnimationFrame(rebuildCloud);
    };
    const localPoint = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    };
    const onMove = (event: PointerEvent) => {
      const point = localPoint(event);
      renderer.movePointer(point.x, point.y);
    };
    const onLeave = () => renderer.releasePointer();
    const onUp = (event: PointerEvent) => {
      const point = localPoint(event);
      renderer.addWave(point.x, point.y);
      if (event.pointerType !== 'mouse') renderer.releasePointer();
    };

    const observer = new ResizeObserver(scheduleRebuild);
    const themeObserver = new MutationObserver(() => renderer.setColor(resolveColor()));
    observer.observe(canvas);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    });
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('pointercancel', onLeave);
    canvas.addEventListener('pointerup', onUp);

    loadAsset(imageSrc, abortController.signal)
      .then((image) => {
        sampled = sampleImage(image, gridSize, contrast, gamma, blur);
        points = diffuse(
          sampled.luminance,
          sampled.alpha,
          sampled.width,
          sampled.height,
          threshold,
          diffusionStrength,
          serpentine,
          invert,
          cornerRadius,
        );
        rebuildCloud();
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          console.error('DitheredLogo: failed to prepare image', error);
        }
      });

    return () => {
      abortController.abort();
      cancelAnimationFrame(rebuildFrame);
      renderer.stop();
      observer.disconnect();
      themeObserver.disconnect();
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('pointercancel', onLeave);
      canvas.removeEventListener('pointerup', onUp);
    };
  }, [
    blur,
    contrast,
    cornerRadius,
    diffusionStrength,
    dotScale,
    gamma,
    gridSize,
    imageSrc,
    invert,
    particleColor,
    scale,
    serpentine,
    threshold,
  ]);

  return (
    <div className={cn('relative h-60 w-60 text-black', className)} style={style}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block h-full w-full touch-none"
        aria-label="Interactive dithered image"
        role="img"
      />
    </div>
  );
}

export default DitheredLogo;
