import { useEffect, useRef } from "react";
import Webcam from "react-webcam";
import { faceapi, loadFaceModels } from "../../face/faceApiLoader";

export default function FaceCamera() {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    async function start() {
      await loadFaceModels();

      console.log("✅ Models Loaded");

      interval = setInterval(async () => {
        const video = webcamRef.current?.video;

        if (!video || video.readyState !== 4) return;

        const detections = await faceapi
          .detectAllFaces(
            video,
            new faceapi.TinyFaceDetectorOptions()
          )
          .withFaceLandmarks();
          const face = await faceapi
  .detectSingleFace(
    video,
    new faceapi.TinyFaceDetectorOptions()
  )
  .withFaceLandmarks()
  .withFaceDescriptor();

if (face) {
  console.log("Descriptor Length:", face.descriptor.length);
}

        const canvas = canvasRef.current;
        if (!canvas) return;

        const displaySize = {
          width: video.videoWidth,
          height: video.videoHeight,
        };

        faceapi.matchDimensions(canvas, displaySize);

        const resized = faceapi.resizeResults(detections, displaySize);

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        faceapi.draw.drawDetections(canvas, resized);
        faceapi.draw.drawFaceLandmarks(canvas, resized);
      }, 200);
    }

    start();

    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        position: "relative",
        width: 720,
        margin: "auto",
      }}
    >
      <Webcam
        ref={webcamRef}
        audio={false}
        width={720}
        height={560}
        mirrored
      />

      <canvas
        ref={canvasRef}
        width={720}
        height={560}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
        }}
      />
    </div>
  );
}