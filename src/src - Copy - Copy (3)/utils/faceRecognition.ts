import * as faceapi from "face-api.js";

/**
 * Calculates Euclidean distance between two 128-dimensional descriptors.
 */
export function calculateFaceDistance(
  desc1: number[],
  desc2: number[]
): number {
  if (desc1.length !== desc2.length) {
    throw new Error("Descriptor dimensions mismatch");
  }

  let sum = 0;

  for (let i = 0; i < desc1.length; i++) {
    const diff = desc1[i] - desc2[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

export interface FaceVerificationResult {
  match: boolean;
  distance: number;
  confidencePct: number;
  message: string;
}

/**
 * Compare two face descriptors.
 */
export function verifyFaceMatch(
  enrolledDescriptor: number[] | undefined,
  liveDescriptor: number[] | undefined,
  threshold = 0.55
): FaceVerificationResult {

  if (!enrolledDescriptor || enrolledDescriptor.length === 0) {
    return {
      match: false,
      distance: 1,
      confidencePct: 0,
      message:
        "Student has not enrolled facial biometrics yet."
    };
  }

  if (!liveDescriptor || liveDescriptor.length === 0) {
    return {
      match: false,
      distance: 1,
      confidencePct: 0,
      message:
        "Unable to detect a face. Please face the camera."
    };
  }

  const distance = calculateFaceDistance(
    enrolledDescriptor,
    liveDescriptor
  );

  const confidencePct = Math.max(
    0,
    Math.min(100, Math.round((1 - distance) * 100))
  );

  return {
    match: distance <= threshold,
    distance: Number(distance.toFixed(3)),
    confidencePct,
    message:
      distance <= threshold
        ? `Face verified (${confidencePct}% confidence).`
        : `Face verification failed (${confidencePct}% confidence).`
  };
}

/**
 * Extract a real 128-dimensional face descriptor
 * using face-api.js.
 */
export async function generateFaceDescriptor(
  video: HTMLVideoElement
): Promise<number[] | null> {

  const detection = await faceapi
    .detectSingleFace(
      video,
      new faceapi.TinyFaceDetectorOptions()
    )
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) {
    return null;
  }

  return Array.from(detection.descriptor);
}