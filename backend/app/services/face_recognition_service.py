import numpy as np
import logging
from typing import List, Dict, Any, Optional, Tuple

logger = logging.getLogger(__name__)

class FaceRecognitionService:
    """
    High-performance Vector Face Recognition & Similarity Engine.
    Uses vectorized NumPy operations (L2-normalized Cosine & Euclidean metric)
    to perform lightning-fast (sub-millisecond) matching for single and group classroom captures.
    Supports both 128-D (face-api.js) and 512-D (InsightFace/ArcFace) vector embeddings.
    """

    def __init__(self):
        # In-memory fast vector registry: { hall_ticket: { "vector": np.ndarray, "dim": int, "name": str, "student_id": str } }
        self._enrolled_faces: Dict[str, Dict[str, Any]] = {}
        # Pre-stacked matrices for O(1) vectorized matrix multiplication
        self._matrix_128: Optional[np.ndarray] = None
        self._keys_128: List[str] = []
        self._matrix_512: Optional[np.ndarray] = None
        self._keys_512: List[str] = []

    def _normalize(self, vec: np.ndarray) -> np.ndarray:
        norm = np.linalg.norm(vec)
        return vec / norm if norm > 0 else vec

    def register_embedding(
        self,
        hall_ticket: str,
        vector: List[float],
        name: Optional[str] = None,
        student_id: Optional[str] = None
    ) -> None:
        """Register or update an enrolled face vector in the fast memory registry."""
        ht = str(hall_ticket).strip().upper()
        if not vector or len(vector) not in (128, 512):
            raise ValueError(f"Vector length must be 128 or 512, received {len(vector) if vector else 0}")

        np_vec = self._normalize(np.array(vector, dtype=np.float32))
        self._enrolled_faces[ht] = {
            "vector": np_vec,
            "dim": len(vector),
            "name": name or f"Student ({ht})",
            "student_id": student_id or ht
        }
        self._rebuild_matrices()

    def remove_embedding(self, hall_ticket: str) -> None:
        """Revoke and delete a student's biometric vector (DPDP compliance)."""
        ht = str(hall_ticket).strip().upper()
        self._enrolled_faces.pop(ht, None)
        self._rebuild_matrices()

    def _rebuild_matrices(self) -> None:
        """Reconstruct stacked numpy matrices for vectorized batch multiplication."""
        k128, v128 = [], []
        k512, v512 = [], []

        for ht, item in self._enrolled_faces.items():
            if item["dim"] == 128:
                k128.append(ht)
                v128.append(item["vector"])
            elif item["dim"] == 512:
                k512.append(ht)
                v512.append(item["vector"])

        self._keys_128 = k128
        self._matrix_128 = np.stack(v128) if v128 else None

        self._keys_512 = k512
        self._matrix_512 = np.stack(v512) if v512 else None

    def compare_two_vectors(
        self,
        v1: List[float],
        v2: List[float],
        threshold: float = 0.42
    ) -> Tuple[bool, float, int]:
        """
        Compare two individual vectors (Euclidean distance on normalized space).
        Returns (is_match, distance, confidence_pct).
        Fails closed if either vector is missing or invalid.
        """
        if not v1 or not v2 or len(v1) != len(v2):
            return False, 1.0, 0

        nv1 = self._normalize(np.array(v1, dtype=np.float32))
        nv2 = self._normalize(np.array(v2, dtype=np.float32))
        
        diff = nv1 - nv2
        distance = float(np.linalg.norm(diff))
        match = distance <= threshold

        # Calibrated confidence: genuine matches (dist <= 0.42) get 80-100%, impostors drop to 0-65%
        if distance <= threshold:
            pct = 100 - (distance / threshold) * 20
            conf = max(80, min(100, int(round(pct))))
        else:
            excess = distance - threshold
            pct = 65 - (excess / 0.35) * 65
            conf = max(0, min(65, int(round(pct))))

        return match, round(distance, 4), conf

    def match_single_vector(
        self,
        live_vector: List[float],
        target_hall_ticket: Optional[str] = None,
        threshold: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Match a live face vector against either a specific hall ticket (1:1) or the entire enrolled database (1:N).
        Uses calibrated thresholds (0.42 for 1:1, 0.38 for 1:N) with Top-2 margin validation.
        """
        dim = len(live_vector) if live_vector else 0
        if dim not in (128, 512):
            return {
                "matched": False,
                "error": f"Invalid vector dimension {dim}. Expected 128 or 512."
            }

        live_norm = self._normalize(np.array(live_vector, dtype=np.float32))

        # 1. Targeted 1-to-1 comparison if hall ticket is given (Calibrated 0.42 threshold)
        if target_hall_ticket:
            eff_threshold = threshold if threshold is not None else 0.42
            ht = target_hall_ticket.strip().upper()
            enrolled = self._enrolled_faces.get(ht)
            if not enrolled or enrolled["dim"] != dim:
                return {
                    "matched": False,
                    "hallTicket": ht,
                    "error": f"No {dim}-D enrollment found for {ht}"
                }
            
            diff = live_norm - enrolled["vector"]
            dist = float(np.linalg.norm(diff))
            match = dist <= eff_threshold

            if dist <= eff_threshold:
                pct = 100 - (dist / eff_threshold) * 20
                conf = max(80, min(100, int(round(pct))))
            else:
                excess = dist - eff_threshold
                pct = 65 - (excess / 0.35) * 65
                conf = max(0, min(65, int(round(pct))))

            return {
                "matched": match,
                "hallTicket": ht,
                "studentName": enrolled["name"],
                "studentId": enrolled["student_id"],
                "distance": round(dist, 4),
                "confidencePct": conf,
                "status": "verified" if match else "mismatch"
            }


        # 2. 1-to-N Search across all enrolled vectors (Strict 0.28 threshold + Margin test)
        eff_threshold = threshold if threshold is not None else 0.28
        matrix = self._matrix_128 if dim == 128 else self._matrix_512
        keys = self._keys_128 if dim == 128 else self._keys_512

        if matrix is None or len(keys) == 0:
            return {
                "matched": False,
                "error": f"No enrolled {dim}-D faces in memory registry."
            }

        # Matrix multiplication for cosine similarity: S = M . v
        cosine_sims = np.dot(matrix, live_norm)
        sorted_indices = np.argsort(cosine_sims)[::-1]
        best_idx = int(sorted_indices[0])
        best_sim = float(cosine_sims[best_idx])
        
        # Check Top-1 vs Top-2 margin to reject ambiguous matches
        is_ambiguous = False
        if len(keys) >= 2:
            second_sim = float(cosine_sims[sorted_indices[1]])
            margin = best_sim - second_sim
            if margin < 0.05 and best_sim < 0.96:
                is_ambiguous = True

        # Euclidean distance = sqrt(2 * (1 - cosine))
        dist = float(np.sqrt(max(0.0, 2.0 * (1.0 - best_sim))))
        match = (dist <= eff_threshold) and (not is_ambiguous)
        conf = max(0, min(100, int(round((1.0 - (dist / 0.55)) * 100))))
        matched_ht = keys[best_idx]
        matched_info = self._enrolled_faces[matched_ht]

        return {
            "matched": match,
            "hallTicket": matched_ht,
            "studentName": matched_info["name"],
            "studentId": matched_info["student_id"],
            "distance": round(dist, 4),
            "confidencePct": conf,
            "isAmbiguous": is_ambiguous,
            "status": "verified" if match else ("ambiguous" if is_ambiguous else "unknown")
        }

    def match_classroom_group_faces(
        self,
        detected_faces: List[Dict[str, Any]],
        threshold: float = 0.28
    ) -> List[Dict[str, Any]]:
        """
        Batch-match multiple faces detected in a classroom photo/frame.
        Each item in `detected_faces` contains:
          - `descriptor`: List[float] (128-D or 512-D)
          - `boundingBox`: Optional[Dict[str, float]] { "x": ..., "y": ..., "width": ..., "height": ... }
          - `livenessScore`: Optional[float]

        Returns a list of match results with bounding boxes and student IDs for UI overlays.
        """
        results = []
        already_matched_hts = set()

        for idx, face in enumerate(detected_faces):
            desc = face.get("descriptor") or face.get("faceDescriptor")
            box = face.get("boundingBox") or face.get("box")
            liveness = face.get("livenessScore", 1.0)

            if not desc:
                continue

            match_res = self.match_single_vector(desc, threshold=threshold)
            ht = match_res.get("hallTicket")
            conf = match_res.get("confidencePct", 0)
            is_matched = match_res.get("matched", False)
            is_ambiguous = match_res.get("isAmbiguous", False)

            # Avoid double-counting the same student in the same frame if multiple boxes match
            if is_matched and ht:
                if ht in already_matched_hts:
                    is_matched = False
                    match_res["status"] = "duplicate_in_frame"
                else:
                    already_matched_hts.add(ht)

            # Determine review flag
            needs_review = False
            if is_ambiguous:
                needs_review = True
            elif is_matched and conf < 70:
                needs_review = True
            elif not is_matched and conf >= 40:
                needs_review = True

            results.append({
                "faceIndex": idx,
                "matched": is_matched,
                "hallTicket": ht if is_matched else None,
                "studentName": match_res.get("studentName") if is_matched else "Unidentified Student",
                "studentId": match_res.get("studentId") if is_matched else None,
                "confidencePct": conf,
                "distance": match_res.get("distance", 1.0),
                "boundingBox": box,
                "livenessScore": liveness,
                "needsReview": needs_review,
                "status": "present" if (is_matched and not needs_review) else ("review_needed" if needs_review else "unmatched")
            })

        return results

# Singleton instance for application-wide fast matching
face_service = FaceRecognitionService()
