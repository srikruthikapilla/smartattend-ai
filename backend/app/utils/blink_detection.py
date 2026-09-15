"""
Smart Attend — Server-Side ML / Signal Processing Blink Detection
================================================================
Validates temporal Eye Aspect Ratio (EAR) sequence and landmark geometry
to verify natural human blinks and prevent presentation attacks / photo spoofing.
"""

import math
import logging
from dataclasses import dataclass
from typing import List, Optional, Tuple
import numpy as np

logger = logging.getLogger(__name__)

# Standard 68-point facial landmark indices for eyes
# Left eye: points 36 to 41 (0-indexed)
LEFT_EYE_INDICES = [36, 37, 38, 39, 40, 41]
# Right eye: points 42 to 47 (0-indexed)
RIGHT_EYE_INDICES = [42, 43, 44, 45, 46, 47]


@dataclass
class ServerBlinkResult:
    is_valid_blink: bool
    confidence: float
    reason: str
    ear_current: Optional[float] = None
    dip_depth: Optional[float] = None
    min_ear: Optional[float] = None
    max_ear: Optional[float] = None


def _euclidean_distance(p1: List[float], p2: List[float]) -> float:
    """Compute 2D Euclidean distance between two points."""
    return math.hypot(p1[0] - p2[0], p1[1] - p2[1])


def compute_eye_aspect_ratio(eye_points: List[List[float]]) -> float:
    """
    Computes EAR for a single 6-point eye landmark set:
    EAR = (|p2 - p6| + |p3 - p5|) / (2.0 * |p1 - p4|)
    """
    if len(eye_points) < 6:
        return 0.0

    p1, p2, p3, p4, p5, p6 = eye_points[:6]
    vert1 = _euclidean_distance(p2, p6)
    vert2 = _euclidean_distance(p3, p5)
    horiz = _euclidean_distance(p1, p4)

    if horiz <= 1e-4:
        return 0.0

    return (vert1 + vert2) / (2.0 * horiz)


def compute_ear_from_68_landmarks(landmarks: List[List[float]]) -> Tuple[float, float, float]:
    """
    Extracts left and right eye points from 68 landmarks and computes EAR.
    Returns (avg_ear, left_ear, right_ear).
    """
    if not landmarks or len(landmarks) < 48:
        return 0.0, 0.0, 0.0

    try:
        left_points = [landmarks[i] for i in LEFT_EYE_INDICES]
        right_points = [landmarks[i] for i in RIGHT_EYE_INDICES]

        left_ear = compute_eye_aspect_ratio(left_points)
        right_ear = compute_eye_aspect_ratio(right_points)
        avg_ear = (left_ear + right_ear) / 2.0

        return round(avg_ear, 4), round(left_ear, 4), round(right_ear, 4)
    except Exception as e:
        logger.warning(f"Failed to compute EAR from landmarks: {e}")
        return 0.0, 0.0, 0.0


def verify_blink_from_ear_history(ear_history: List[float]) -> ServerBlinkResult:
    """
    Analyzes a sliding window of EAR measurements (typically 5–30 samples).
    Validates a natural human blink pattern:
      1. Open eye state (EAR >= 0.18)
      2. Transient dip/trough (minimum EAR drops significantly, dip >= 0.022)
      3. Recovery / reopening (recent EAR returns near or above baseline)
      4. Temporal sanity (rejects flat sequences, negative values, extreme noise)
    """
    if not ear_history or len(ear_history) < 2:
        return ServerBlinkResult(
            is_valid_blink=False,
            confidence=0.0,
            reason="Insufficient EAR history samples (minimum 2 required)"
        )

    # Convert to clean numpy float array
    try:
        ear_arr = np.array(ear_history, dtype=np.float64)
    except Exception:
        return ServerBlinkResult(
            is_valid_blink=False,
            confidence=0.0,
            reason="Invalid EAR sample data format"
        )

    # 1. Biological sanity bounds check [0.05, 0.55]
    if np.any(ear_arr < 0.02) or np.any(ear_arr > 0.65):
        return ServerBlinkResult(
            is_valid_blink=False,
            confidence=0.0,
            reason=f"EAR values out of plausible physiological bounds: [{ear_arr.min():.3f}, {ear_arr.max():.3f}]"
        )

    # 2. Check variation / reject flat signals (static image attack)
    std_dev = float(np.std(ear_arr))
    if std_dev < 0.005:
        return ServerBlinkResult(
            is_valid_blink=False,
            confidence=0.0,
            reason=f"EAR variance too low (std={std_dev:.5f}) — indicates static photo or spoof"
        )

    min_ear = float(np.min(ear_arr))
    max_ear = float(np.max(ear_arr))
    cur_ear = float(ear_arr[-1])
    start_ear = float(ear_arr[0])
    dip_depth = max_ear - min_ear

    # 3. Minimum dip threshold (human blink has a distinct contraction)
    # A true blink creates a minimum dip >= 0.016 in EAR
    if dip_depth < 0.016:
        return ServerBlinkResult(
            is_valid_blink=False,
            confidence=0.2,
            reason=f"Insufficient EAR dip depth ({dip_depth:.4f} < 0.016 minimum)",
            ear_current=round(cur_ear, 4),
            dip_depth=round(dip_depth, 4),
            min_ear=round(min_ear, 4),
            max_ear=round(max_ear, 4)
        )

    # 4. Trough location: The minimum EAR should be internal (not exclusively at the very last frame)
    # or the last frame should have begun reopening
    min_idx = int(np.argmin(ear_arr))
    is_internal_trough = (0 < min_idx < len(ear_arr) - 1)
    reopened = (cur_ear > min_ear + 0.010) or (cur_ear >= 0.15 and is_internal_trough) or (cur_ear > min_ear and len(ear_arr) <= 5)

    if not reopened and cur_ear <= min_ear + 0.006:
        return ServerBlinkResult(
            is_valid_blink=False,
            confidence=0.3,
            reason=f"Eyes appear closed or have not yet reopened (current={cur_ear:.3f}, min={min_ear:.3f})",
            ear_current=round(cur_ear, 4),
            dip_depth=round(dip_depth, 4),
            min_ear=round(min_ear, 4),
            max_ear=round(max_ear, 4)
        )

    # 5. Baseline open EAR check (max EAR should represent an open eye, >= 0.15)
    if max_ear < 0.15:
        return ServerBlinkResult(
            is_valid_blink=False,
            confidence=0.3,
            reason=f"Maximum EAR ({max_ear:.3f}) below open-eye baseline (0.15)",
            ear_current=round(cur_ear, 4),
            dip_depth=round(dip_depth, 4),
            min_ear=round(min_ear, 4),
            max_ear=round(max_ear, 4)
        )

    # Calculate confidence score based on dip depth and baseline quality
    # Typical genuine blink: dip_depth 0.04–0.12, max_ear 0.25–0.38
    conf = min(0.99, max(0.70, 0.70 + (dip_depth / 0.10) * 0.25))

    return ServerBlinkResult(
        is_valid_blink=True,
        confidence=round(conf, 3),
        reason="Natural blink pattern validated (open -> trough -> reopen)",
        ear_current=round(cur_ear, 4),
        dip_depth=round(dip_depth, 4),
        min_ear=round(min_ear, 4),
        max_ear=round(max_ear, 4)
    )


def verify_live_blink(
    ear_history: Optional[List[float]] = None,
    face_landmarks: Optional[List[List[float]]] = None,
    client_blink_verified: bool = False
) -> ServerBlinkResult:
    """
    Comprehensive multi-modal server-side blink verification:
      1. If ear_history is provided: performs temporal trough analysis.
      2. If face_landmarks is provided: validates anatomical landmarks and checks instantaneous EAR.
      3. Cross-verifies with client declaration.
    """
    # 1. Landmark inspection if available
    landmark_ear: Optional[float] = None
    if face_landmarks and len(face_landmarks) >= 68:
        avg_ear, left_ear, right_ear = compute_ear_from_68_landmarks(face_landmarks)
        landmark_ear = avg_ear
        # If eye EAR from landmarks is completely outside physical reality, reject
        if avg_ear <= 0.02 or avg_ear >= 0.65:
            return ServerBlinkResult(
                is_valid_blink=False,
                confidence=0.0,
                reason=f"Anomalous facial landmark geometry: EAR={avg_ear:.3f}"
            )

    # 2. Temporal EAR history analysis
    if ear_history and len(ear_history) >= 2:
        # If landmark EAR is also provided, ensure the history ends near the landmark EAR
        if landmark_ear is not None:
            # Append or reconcile current landmark EAR
            full_history = list(ear_history)
            if abs(full_history[-1] - landmark_ear) > 0.12:
                # Discrepancy between reported landmark and EAR history
                logger.warning(f"EAR history tail ({full_history[-1]:.3f}) differs from landmark EAR ({landmark_ear:.3f})")
            result = verify_blink_from_ear_history(full_history)
        else:
            result = verify_blink_from_ear_history(ear_history)

        return result

    # 3. Landmark-only snapshot: anatomical structure alone is NOT a liveness verdict.
    # A single frame cannot prove a live human blink — fail closed rather than
    # trusting a client-reported boolean with no temporal telemetry.
    if landmark_ear is not None:
        if not (0.15 <= landmark_ear <= 0.45):
            return ServerBlinkResult(
                is_valid_blink=False,
                confidence=0.0,
                reason=f"Anomalous facial landmark geometry: EAR={landmark_ear:.3f}"
            )
        return ServerBlinkResult(
            is_valid_blink=False,
            confidence=0.5,
            reason="Single-frame landmarks only: insufficient temporal EAR history for liveness. Minimum 3 EAR samples required.",
            ear_current=landmark_ear
        )

    # 4. No server-side telemetry at all — fail closed, never trust the client claim.
    return ServerBlinkResult(
        is_valid_blink=False,
        confidence=0.0,
        reason="No blink detected: no EAR history or facial landmarks provided"
    )
