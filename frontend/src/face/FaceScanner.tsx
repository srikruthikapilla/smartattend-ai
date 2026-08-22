import { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import { faceapi, loadFaceModels } from "./faceApiLoader";

interface FaceScannerProps {
  onDescriptorCaptured: (descriptor: number[]) => void;
  captureEnabled: boolean;
}

export default function FaceScanner({
  onDescriptorCaptured,
  captureEnabled,
}: FaceScannerProps) {
  const webcamRef = useRef<Webcam>(null);
  const [modelsReady, setModelsReady] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      await loadFaceModels();
      setModelsReady(true);
      setLoading(false);
    }

    init();
  }, []);

  async function captureFace() {
    const video = webcamRef.current?.video;

    if (!video || video.readyState < 2) {
      alert("Camera not ready.");
      return;
    }

    const detection = await faceapi
      .detectSingleFace(
        video,
        new faceapi.TinyFaceDetectorOptions()
      )
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      alert("No face detected.");
      return;
    }

    onDescriptorCaptured(Array.from(detection.descriptor));
  }

  useEffect(() => {
    if (!captureEnabled || !modelsReady) return;

    captureFace();
  }, [captureEnabled, modelsReady]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="overflow-hidden rounded-full border-4 border-purple-500 w-64 h-64">
        <Webcam
          ref={webcamRef}
          audio={false}
          mirrored
          screenshotFormat="image/jpeg"
          videoConstraints={{
            width: 640,
            height: 480,
            facingMode: "user",
          }}
          className="w-full h-full object-cover"
        />
      </div>

      {loading && (
        <p className="text-sm text-gray-500">
          Loading AI Models...
        </p>
      )}
    </div>
  );
}