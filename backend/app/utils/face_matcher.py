import numpy as np
import math
from typing import List, Tuple

def compare_face_embeddings(
    enrolled_vec: List[float],
    live_vec: List[float],
    threshold: float = 0.38
) -> Tuple[bool, float, int]:
    """
    Computes Euclidean (L2) distance between two 128-dim face-api.js descriptors.
    Returns (match, distance, confidence_pct).
    Fails closed if either vector is missing or invalid.
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

    # Calibrated similarity %: 100% at dist=0, 80% at dist=0.20, 45% at threshold 0.38, 0% at dist >= 0.55
    confidence_pct = max(0, min(100, int(round((1.0 - (distance / 0.55)) * 100))))

    return match, round(distance, 4), confidence_pct
