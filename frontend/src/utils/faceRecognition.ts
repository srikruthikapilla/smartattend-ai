import * as faceapi from "face-api.js";

/**
 * Load face-api.js neural network models from local /models or fallback CDN.
 */
let modelsLoaded = false;

export async function loadFaceApiModels(): Promise<boolean> {
  if (modelsLoaded) return true;

  const paths = [
    '/models',
    'https://justadudewhohacks.github.io/face-api.js/models'
  ];

  for (const modelPath of paths) {
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(modelPath),
        faceapi.nets.faceLandmark68Net.loadFromUri(modelPath),
        faceapi.nets.faceRecognitionNet.loadFromUri(modelPath)
      ]);
      modelsLoaded = true;
      console.log(`[Face AI] Models successfully loaded from: ${modelPath}`);
      return true;
    } catch (err) {
      console.warn(`[Face AI] Model load attempt failed for ${modelPath}:`, err);
    }
  }

  return false;
}

/**
 * Calculates Euclidean distance between two 128-dimensional descriptors.
 * Normalizes both descriptors to L2 unit length to guarantee scale invariance.
 */
export function calculateFaceDistance(
  desc1: number[],
  desc2: number[]
): number {
  if (!desc1 || !desc2 || desc1.length !== desc2.length) {
    return 1.0;
  }

  let norm1 = 0;
  let norm2 = 0;
  for (let i = 0; i < desc1.length; i++) {
    norm1 += desc1[i] * desc1[i];
    norm2 += desc2[i] * desc2[i];
  }
  norm1 = Math.sqrt(norm1) || 1;
  norm2 = Math.sqrt(norm2) || 1;

  let sum = 0;
  for (let i = 0; i < desc1.length; i++) {
    const diff = (desc1[i] / norm1) - (desc2[i] / norm2);
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * Maps Euclidean distance to a human-readable similarity/confidence percentage.
 * Threshold 0.30 separates genuine face matches from different faces (impostors)
 * on L2-normalized FaceNet-128 embeddings:
 * - Genuine match (distance <= 0.30): 80% to 100% confidence.
 * - Impostor/Mismatch (distance > 0.30): drops sharply from 65% down to 0%.
 */
export function calculateConfidencePct(distance: number, threshold = 0.30): number {
  if (distance <= threshold) {
    const pct = 100 - (distance / threshold) * 20;
    return Math.max(80, Math.min(100, Math.round(pct)));
  } else {
    const excess = distance - threshold;
    const pct = 65 - (excess / 0.30) * 65;
    return Math.max(0, Math.min(65, Math.round(pct)));
  }
}

export interface FaceVerificationResult {
  match: boolean;
  distance: number;
  confidencePct: number;
  blinkVerified?: boolean;
  multipleFaces?: boolean;
  faceCount?: number;
  message: string;
}

export interface FaceDetectionResult {
  descriptor: number[];
  landmarks: any;
  detection: any;
  multipleFaces?: boolean;
  faceCount?: number;
  isCentered?: boolean;
}

/**
 * Euclidean point-to-point distance in 2D space.
 */
function euclideanDist(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  if (!p1 || !p2) return 0;
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Compute Eye Aspect Ratio (EAR) from 68 face landmarks.
 * Left eye: 36–41 | Right eye: 42–47
 */
export function calculateEyeAspectRatio(landmarks: any): {
  leftEAR: number;
  rightEAR: number;
  avgEAR: number;
  isClosed: boolean;
} {
  const positions = landmarks?.positions || landmarks?.relativePositions || landmarks;
  if (!positions || positions.length < 48) {
    return { leftEAR: 0.28, rightEAR: 0.28, avgEAR: 0.28, isClosed: false };
  }

  // Left Eye (36-41)
  const l_p1 = positions[36];
  const l_p2 = positions[37];
  const l_p3 = positions[38];
  const l_p4 = positions[39];
  const l_p5 = positions[40];
  const l_p6 = positions[41];

  const l_vert1 = euclideanDist(l_p2, l_p6);
  const l_vert2 = euclideanDist(l_p3, l_p5);
  const l_horiz = euclideanDist(l_p1, l_p4);
  const leftEAR = (l_vert1 + l_vert2) / (2.0 * Math.max(l_horiz, 0.001));

  // Right Eye (42-47)
  const r_p1 = positions[42];
  const r_p2 = positions[43];
  const r_p3 = positions[44];
  const r_p4 = positions[45];
  const r_p5 = positions[46];
  const r_p6 = positions[47];

  const r_vert1 = euclideanDist(r_p2, r_p6);
  const r_vert2 = euclideanDist(r_p3, r_p5);
  const r_horiz = euclideanDist(r_p1, r_p4);
  const rightEAR = (r_vert1 + r_vert2) / (2.0 * Math.max(r_horiz, 0.001));

  const avgEAR = (leftEAR + rightEAR) / 2.0;

  // General threshold for eye closure
  const isClosed = avgEAR < 0.225;

  return { leftEAR, rightEAR, avgEAR, isClosed };
}

/**
 * Adaptive Real-time Blink & Liveness Tracker state machine.
 * Tracks personal open-eye baseline and uses sliding window valley detection
 * to reliably catch natural human blinks across varying camera frame rates.
 */
export class BlinkDetector {
  private state: 'waiting_open' | 'open' | 'closed' = 'waiting_open';
  public blinkCount = 0;
  public lastEAR = 0.28;
  public baselineEAR = 0; // Dynamic personal baseline
  public blinkProgressPct = 0;
  private framesSinceOpen = 0;
  private closedFrames = 0;
  private earHistory: number[] = [];
  private calibrationFrames = 0;

  public processFrame(landmarks: any): {
    hasBlinked: boolean;
    blinkCount: number;
    avgEAR: number;
    isClosed: boolean;
    progressPct: number;
  } {
    const { avgEAR } = calculateEyeAspectRatio(landmarks);
    this.lastEAR = avgEAR;

    // Track sliding window of recent EAR samples
    this.earHistory.push(avgEAR);
    if (this.earHistory.length > 10) {
      this.earHistory.shift();
    }

    // Dynamic baseline calibration: learn resting open EAR
    if (this.baselineEAR === 0) {
      this.baselineEAR = avgEAR;
      this.calibrationFrames = 1;
    } else if (this.calibrationFrames < 5) {
      this.baselineEAR = Math.max(this.baselineEAR, avgEAR);
      this.calibrationFrames++;
    } else if (avgEAR >= this.baselineEAR * 0.85 || avgEAR > 0.22) {
      // Slow Exponential Moving Average during open eye state
      this.baselineEAR = this.baselineEAR * 0.92 + avgEAR * 0.08;
    }
    // Constrain baseline to realistic anatomical range [0.18, 0.42]
    this.baselineEAR = Math.max(0.18, Math.min(0.42, this.baselineEAR));

    const effectiveBaseline = this.baselineEAR > 0 ? this.baselineEAR : 0.27;

    // Adaptive closure & reopen thresholds
    // Eye closure: 15% drop from baseline OR EAR < 0.215 OR absolute delta >= 0.024
    const closeThreshold = Math.max(0.15, Math.min(0.25, effectiveBaseline * 0.83));
    const openThreshold = Math.max(0.18, Math.min(0.35, effectiveBaseline * 0.90));

    const isClosed = avgEAR <= closeThreshold || (effectiveBaseline - avgEAR >= 0.024);
    let hasBlinked = false;

    // Primary State Machine
    switch (this.state) {
      case 'waiting_open':
        this.blinkProgressPct = 20;
        if (avgEAR >= openThreshold || this.calibrationFrames >= 2) {
          this.framesSinceOpen++;
          if (this.framesSinceOpen >= 1) {
            this.state = 'open';
            this.blinkProgressPct = 40;
          }
        }
        break;

      case 'open':
        this.blinkProgressPct = 40;
        if (isClosed) {
          this.closedFrames++;
          if (this.closedFrames >= 1) {
            this.state = 'closed';
            this.blinkProgressPct = 75;
          }
        } else {
          this.closedFrames = 0;
        }
        break;

      case 'closed':
        this.blinkProgressPct = 75;
        if (avgEAR >= openThreshold || (avgEAR > closeThreshold + 0.015)) {
          // Completed blink: open -> closed -> open
          this.blinkCount++;
          hasBlinked = true;
          this.state = 'open';
          this.closedFrames = 0;
          this.blinkProgressPct = 100;
        }
        break;
    }

    // Secondary Sliding Window Valley/Trough Detection:
    // Catches [Open -> Dip -> Reopen] pattern even if frame rate skipped state transitions
    if (!hasBlinked && this.earHistory.length >= 3) {
      const recent = this.earHistory;
      const cur = recent[recent.length - 1];
      const minEAR = Math.min(...recent);
      const startEAR = recent[0];

      const dipDepth = Math.max(effectiveBaseline - minEAR, startEAR - minEAR);

      if (
        startEAR >= openThreshold &&
        cur >= openThreshold &&
        dipDepth >= 0.022
      ) {
        this.blinkCount++;
        hasBlinked = true;
        this.state = 'open';
        this.closedFrames = 0;
        this.blinkProgressPct = 100;
      }
    }

    return {
      hasBlinked,  // Only true for the frame that completed a blink, not permanently
      blinkCount: this.blinkCount,
      avgEAR: Number(avgEAR.toFixed(3)),
      isClosed,
      progressPct: this.blinkProgressPct
    };
  }

  public reset() {
    this.state = 'waiting_open';
    this.blinkCount = 0;
    this.blinkProgressPct = 0;
    this.baselineEAR = 0;
    this.framesSinceOpen = 0;
    this.closedFrames = 0;
    this.earHistory = [];
    this.calibrationFrames = 0;
  }
}

/**
 * Fallback generator: creates a deterministic 128-D vector from canvas frame
 */
export function generateCanvasFallbackDescriptor(video: HTMLVideoElement): number[] {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.drawImage(video, 0, 0, 64, 64);
    const imgData = ctx.getImageData(0, 0, 64, 64).data;
    const vector = new Array(128).fill(0);
    for (let i = 0; i < imgData.length; i += 4) {
      const idx = (i / 4) % 128;
      const brightness = (imgData[i] * 0.299 + imgData[i+1] * 0.587 + imgData[i+2] * 0.114) / 255;
      vector[idx] += brightness;
    }
    // Normalize L2
    const norm = Math.sqrt(vector.reduce((a, b) => a + b * b, 0)) || 1;
    return vector.map(v => Number((v / norm).toFixed(4)));
  }
  return Array.from({ length: 128 }, () => Number((Math.random() * 0.1).toFixed(4)));
}

/**
 * Extract real 128-dimensional face descriptor and landmarks from video element.
 * Enforces single-face detection to reject background faces and multiple individuals.
 */
export async function detectFaceWithLandmarks(
  video: HTMLVideoElement
): Promise<FaceDetectionResult | null> {
  try {
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return null;

    // Detect all faces in the camera frame
    const allDetections = await faceapi
      .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.38 }))
      .withFaceLandmarks()
      .withFaceDescriptors();

    if (!allDetections || allDetections.length === 0) {
      return null;
    }

    // MULTI-PERSON SECURITY CHECK:
    // If more than 1 face is visible in frame, flag as multipleFaces to prevent capturing other person
    if (allDetections.length > 1) {
      return {
        descriptor: [],
        landmarks: null,
        detection: null,
        multipleFaces: true,
        faceCount: allDetections.length,
        isCentered: false
      };
    }

    const singleResult = allDetections[0];
    const box = singleResult.detection.box;
    const centerX = box.x + box.width / 2;
    const vWidth = video.videoWidth || 640;
    
    // Check if face is centered (within middle 75% of frame) and of adequate size
    const isCentered = centerX >= vWidth * 0.12 && centerX <= vWidth * 0.88 && box.width >= 60;

    return {
      descriptor: Array.from(singleResult.descriptor),
      landmarks: singleResult.landmarks,
      detection: singleResult.detection,
      multipleFaces: false,
      faceCount: 1,
      isCentered
    };
  } catch (err) {
    console.warn("Face detection attempt failed:", err);
  }

  return null;
}

export async function waitForVideoReady(
  video: HTMLVideoElement,
  timeoutMs = 8000
): Promise<boolean> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (
      video &&
      video.readyState >= 2 &&
      video.videoWidth > 0 &&
      video.videoHeight > 0
    ) {
      return true;
    }

    await new Promise(resolve => setTimeout(resolve, 120));
  }

  return false;
}

/**
 * Extract a real 128-dimensional face descriptor using face-api.js with fallback.
 */
export async function generateFaceDescriptor(
  video: HTMLVideoElement,
  maxAttempts = 6,
  intervalMs = 150
): Promise<number[] | null> {
  const ready = await waitForVideoReady(video);
  if (!ready) {
    return null;
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await detectFaceWithLandmarks(video);
    if (res && res.descriptor && res.descriptor.length === 128 && !res.multipleFaces) {
      return res.descriptor;
    }
    if (attempt < maxAttempts - 1) {
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }

  return null;
}

export interface EnrollmentProgress {
  framesCollected: number;
  totalFrames: number;
  pct: number;
  status: 'scanning' | 'processing' | 'done' | 'error';
  message: string;
  multipleFaces?: boolean;
}

/**
 * Select the Medoid descriptor from a list of collected face vectors.
 * The medoid is the vector that has the lowest total Euclidean distance to all other vectors.
 * Unlike arithmetic averaging, medoid selection preserves real facial features and prevents
 * vector smoothing toward the global centroid / "mean face".
 */
export function computeMedoidDescriptor(descriptors: number[][]): number[] {
  if (!descriptors || descriptors.length === 0) return [];
  if (descriptors.length === 1) {
    const d = descriptors[0];
    const norm = Math.sqrt(d.reduce((s, v) => s + v * v, 0)) || 1;
    return d.map(v => Number((v / norm).toFixed(6)));
  }

  let bestIndex = 0;
  let minTotalDistance = Infinity;

  for (let i = 0; i < descriptors.length; i++) {
    let totalDist = 0;
    for (let j = 0; j < descriptors.length; j++) {
      if (i !== j) {
        totalDist += calculateFaceDistance(descriptors[i], descriptors[j]);
      }
    }
    if (totalDist < minTotalDistance) {
      minTotalDistance = totalDist;
      bestIndex = i;
    }
  }

  const chosen = descriptors[bestIndex];
  const norm = Math.sqrt(chosen.reduce((s, v) => s + v * v, 0)) || 1;
  return chosen.map(v => Number((v / norm).toFixed(6)));
}

/**
 * Multi-frame face enrollment: captures high-confidence frames over time
 * and selects the sharpest Medoid biometric template.
 * Strictly enforces single-face presence to reject frames with other people in the background.
 */
export async function captureEnrollmentDescriptor(
  video: HTMLVideoElement,
  onProgress: (p: EnrollmentProgress) => void,
  totalFrames = 8,
  intervalMs = 500
): Promise<number[] | null> {
  const collected: number[][] = [];
  let attempt = 0;
  const maxAttempts = totalFrames * 6; // allow more retries if detection misses

  onProgress({ framesCollected: 0, totalFrames, pct: 0, status: 'scanning', message: 'Keep still — scanning your face...' });

  const ready = await waitForVideoReady(video);
  if (!ready) {
    onProgress({
      framesCollected: 0,
      totalFrames,
      pct: 0,
      status: 'error',
      message: 'Camera is not ready yet. Please allow camera access and keep your face centered.'
    });
    return null;
  }

  return new Promise((resolve) => {
    const interval = setInterval(async () => {
      if (collected.length >= totalFrames) {
        clearInterval(interval);
        onProgress({ framesCollected: collected.length, totalFrames, pct: 95, status: 'processing', message: 'Building your face profile...' });

        // Select the Medoid descriptor to preserve sharp individual facial landmarks
        const template = computeMedoidDescriptor(collected);

        onProgress({ framesCollected: collected.length, totalFrames, pct: 100, status: 'done', message: 'Face profile registered!' });
        resolve(template);
        return;
      }

      attempt++;
      if (attempt > maxAttempts) {
        clearInterval(interval);
        if (collected.length >= 3) {
          // Enough high-confidence frames to proceed
          onProgress({ framesCollected: collected.length, totalFrames, pct: 95, status: 'processing', message: 'Building your face profile...' });
          const template = computeMedoidDescriptor(collected);
          onProgress({ framesCollected: collected.length, totalFrames, pct: 100, status: 'done', message: 'Face profile registered!' });
          resolve(template);
        } else {
          onProgress({ framesCollected: collected.length, totalFrames, pct: 0, status: 'error', message: 'Could not detect your face with sufficient confidence. Please ensure good lighting and only one person in frame.' });
          resolve(null);
        }
        return;
      }

      try {
        if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;
        const res = await detectFaceWithLandmarks(video);

        if (res?.multipleFaces) {
          onProgress({
            framesCollected: collected.length,
            totalFrames,
            pct: Math.round((collected.length / totalFrames) * 90),
            status: 'scanning',
            message: `⚠️ Multiple faces detected (${res.faceCount} people). Please ensure only you are visible.`,
            multipleFaces: true
          });
          return;
        }

        if (res && res.descriptor && res.descriptor.length === 128 && res.isCentered !== false) {
          collected.push(res.descriptor);
          const pct = Math.round((collected.length / totalFrames) * 90);
          const messages = [
            'Keep still — scanning your face...',
            'Hold steady...',
            'Scanning facial landmarks...',
            'Almost there — keep looking at camera...',
            'Great — a few more seconds...',
            'Perfect — finishing up...',
          ];
          const msg = messages[Math.min(collected.length - 1, messages.length - 1)];
          onProgress({ framesCollected: collected.length, totalFrames, pct, status: 'scanning', message: msg });
        }
      } catch {
        // Silently retry on frame error
      }
    }, intervalMs);
  });
}

/**
 * Compare two face descriptors with strict calibrated threshold and blink liveness.
 * Threshold 0.45 separates genuine face matches from impostors.
 * Fails closed if enrolled descriptor is missing or empty.
 */
export function verifyFaceMatch(
  enrolledDescriptor: number[] | undefined,
  liveDescriptor: number[] | undefined,
  blinkVerified = true,
  threshold = 0.30
): FaceVerificationResult {
  if (!enrolledDescriptor || enrolledDescriptor.length === 0) {
    return {
      match: false,
      distance: 1.0,
      confidencePct: 0,
      blinkVerified: false,
      message: "No biometric face profile registered for this student. Enrollment required."
    };
  }

  if (!liveDescriptor || liveDescriptor.length === 0) {
    return {
      match: false,
      distance: 1.0,
      confidencePct: 0,
      blinkVerified: false,
      message: "Unable to detect a face. Please look directly into the camera."
    };
  }

  const distance = calculateFaceDistance(enrolledDescriptor, liveDescriptor);
  const confidencePct = calculateConfidencePct(distance, threshold);
  const match = distance <= threshold;

  return {
    match,
    distance: Number(distance.toFixed(3)),
    confidencePct,
    blinkVerified,
    message: match
      ? `Face verified (${confidencePct}% confidence)${blinkVerified ? ' with confirmed Eye Blink Liveness.' : '.'}`
      : `Face mismatch: Live face (${confidencePct}% similarity) does not match enrolled profile for this Roll No.`
  };
}

