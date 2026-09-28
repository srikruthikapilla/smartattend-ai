import * as faceapi from "face-api.js";
import { loadFaceApiModels } from "./faceRecognition";
export async function loadFaceModels() {
  if (!await loadFaceApiModels()) throw new Error("Face models could not be loaded.");
}
export { faceapi };
