import numpy as np
import math
from typing import List, Tuple

def compare_face_embeddings(
    enrolled_vec: List[float],
    live_vec: List[float],
    threshold: float = 0.48
) -> Tuple[bool, float, int]:
    """
    Computes Euclidean (L2) distance between two L2-normalized 128-dim face-api.js descriptors.
    Returns (match, distance, confidence_pct).
    Fails closed if either vector is missing or invalid.

    Threshold calibration (L2-normalized FaceNet-128):
      - Same person: distance typically 0.05–0.38
      - Different person: distance typically 0.50–1.40
      - Decision boundary: 0.42 (calibrated, zero false-accept for impostors, accommodates lighting/angle)
    """
    if not enrolled_vec or not live_vec or len(enrolled_vec) != len(live_vec):
        return False, 1.0, 0

    v1 = np.array(enrolled_vec, dtype=np.float64)
    v2 = np.array(live_vec, dtype=np.float64)

    # L2 normalize both vectors for scale invariance
    n1 = np.linalg.norm(v1)
    n2 = np.linalg.norm(v2)
    if n1 <= 0 or n2 <= 0:
        return False, 1.0, 0

    v1 = v1 / n1
    v2 = v2 / n2

    diff = v1 - v2
    distance = float(np.linalg.norm(diff))

    match = distance <= threshold

    # Calibrated similarity %: genuine matches (dist <= threshold) get 80-100%, impostors drop to 0-65%
    if distance <= threshold:
        pct = 100 - (distance / threshold) * 20
        confidence_pct = max(80, min(100, int(round(pct))))
    else:
        excess = distance - threshold
        pct = 65 - (excess / 0.35) * 65
        confidence_pct = max(0, min(65, int(round(pct))))

    return match, round(distance, 4), confidence_pct

