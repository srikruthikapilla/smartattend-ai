import * as faceapi from "face-api.js";

let modelsLoaded = false;

export async function loadFaceModels() {
  if (modelsLoaded) return;

  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
    faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
    faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
  ]);

  modelsLoaded = true;
  console.log("Tiny:", faceapi.nets.tinyFaceDetector.isLoaded);
console.log("Landmark:", faceapi.nets.faceLandmark68Net.isLoaded);
console.log("Recognition:", faceapi.nets.faceRecognitionNet.isLoaded);

  console.log("✅ Face models loaded successfully");
}

export { faceapi };