import { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import { faceapi, loadFaceModels } from "../../face/faceApiLoader";
import { Users, UserCheck, AlertTriangle } from "lucide-react";

export default function FaceCamera() {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [faceCount, setFaceCount] = useState<number>(0);
  const [modelsReady, setModelsReady] = useState<boolean>(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    async function start() {
      await loadFaceModels();
      setModelsReady(true);

      interval = setInterval(async () => {
        const video = webcamRef.current?.video;

        if (!video || video.readyState !== 4) return;

        const detections = await faceapi
          .detectAllFaces(
            video,
            new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.38 })
          )
          .withFaceLandmarks()
          .withFaceDescriptors();

        setFaceCount(detections.length);

        const canvas = canvasRef.current;
        if (!canvas) return;

        const displaySize = {
          width: video.videoWidth || 720,
          height: video.videoHeight || 560,
        };

        faceapi.matchDimensions(canvas, displaySize);

        const resized = faceapi.resizeResults(detections, displaySize);

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw bounding box and landmarks
        faceapi.draw.drawDetections(canvas, resized);
        faceapi.draw.drawFaceLandmarks(canvas, resized);
      }, 150);
    }

    start();

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative max-w-[720px] mx-auto rounded-3xl overflow-hidden shadow-2xl bg-slate-950 border border-slate-800">
      {/* Top Status Bar */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2">
          {faceCount === 1 ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 backdrop-blur-md">
              <UserCheck className="w-4 h-4" />
              <span>1 Face Locked</span>
            </span>
          ) : faceCount > 1 ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-rose-500/25 text-rose-300 border border-rose-500/50 backdrop-blur-md animate-pulse">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>Multiple Faces ({faceCount}) — Only 1 Allowed</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-800/80 text-slate-300 border border-slate-700 backdrop-blur-md">
              <Users className="w-4 h-4" />
              <span>Searching for Face...</span>
            </span>
          )}
        </div>
      </div>

      <div className="relative w-full aspect-[4/3] max-h-[560px]">
        <Webcam
          ref={webcamRef}
          audio={false}
          width={720}
          height={560}
          mirrored
          className="w-full h-full object-cover"
        />

        {/* Mirrored Canvas so landmark points align accurately with the flipped video */}
        <canvas
          ref={canvasRef}
          width={720}
          height={560}
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
          style={{
            transform: "scaleX(-1)", // Synchronize with Webcam mirrored
          }}
        />
      </div>
    </div>
  );
}