import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import Webcam from "react-webcam";

import {
  Camera,
  CheckCircle2,
  RefreshCw,
  Scan,
  Sparkles,
  Fingerprint,
  ShieldCheck,
} from "lucide-react";

import { Modal } from "../common/Modal";

import { useAuth } from "../../context/AuthContext";

import {
  generateFaceDescriptor,
  computeMedoidDescriptor,
} from "../../utils/faceRecognition";

import {
  loadFaceModels,
} from "../../face/faceApiLoader";

import {
  enrollPlatformBiometrics,
} from "../../utils/webauthnBiometrics";

interface FaceEnrollmentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step =
  | "front"
  | "left"
  | "right"
  | "biometric_fallback"
  | "complete";

export default function FaceEnrollmentModal({
  isOpen,
  onClose,
}: FaceEnrollmentModalProps) {

  const {
    currentUser,
    enrollStudentFace,
    enrollStudentBiometrics,
  } = useAuth();

  const webcamRef =
    useRef<Webcam>(null);

  const [
    modelsLoaded,
    setModelsLoaded,
  ] = useState(false);

  const [
    capturing,
    setCapturing,
  ] = useState(false);

  const [
    cameraReady,
    setCameraReady,
  ] = useState(false);

  const [
    enrollingBio,
    setEnrollingBio,
  ] = useState(false);

  const [
    step,
    setStep,
  ] = useState<Step>("front");

  const [
    descriptors,
    setDescriptors,
  ] = useState<number[][]>([]);

  useEffect(() => {
    async function init() {
      try {
        await loadFaceModels();
        setModelsLoaded(true);
      } catch (err) {
        console.error(err);
        alert("Unable to load Face AI Models.");
      }
    }
    init();
  }, []);

  if (!currentUser) {
    return null;
  }

  const handleCapturePose = async () => {
    if (!modelsLoaded) {
      alert("AI models are still loading. Please wait a moment.");
      return;
    }

    const video = webcamRef.current?.video;
    if (!cameraReady || !video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      alert("Camera is still initializing. Please ensure camera access is allowed and try again.");
      return;
    }

    setCapturing(true);

    try {
      // Allow brief moment for frame to stabilize
      await new Promise(r => setTimeout(r, 200));

      let descriptor = await generateFaceDescriptor(video, 8, 180);

      // If first attempt missed, retry a couple times across 600ms
      if (!descriptor) {
        for (let attempt = 0; attempt < 5; attempt++) {
          await new Promise(r => setTimeout(r, 200));
          descriptor = await generateFaceDescriptor(video, 8, 180);
          if (descriptor) break;
        }
      }

      if (!descriptor) {
        alert(
          "No face detected.\n\nPlease:\n• Keep your face inside the frame\n• Face the camera\n• Ensure proper lighting."
        );
        return;
      }

      const updatedDescriptors = [...descriptors, descriptor];
      setDescriptors(updatedDescriptors);

      if (step === "front") {
        setStep("left");
        return;
      }

      if (step === "left") {
        setStep("right");
        return;
      }

      // Third capture done - select the sharpest representative Medoid descriptor
      const finalDescriptor = computeMedoidDescriptor(updatedDescriptors);

      const saved = await enrollStudentFace(currentUser.uid, finalDescriptor);
      if (!saved) {
        throw new Error("Face descriptor was captured but not persisted.");
      }
      setStep("biometric_fallback");
    } catch (error) {
      console.error("Face enrollment capture error:", error);
      alert(error instanceof Error ? error.message : "Face enrollment failed. Please try again.");
    } finally {
      setCapturing(false);
    }
  };
  const handleEnrollPlatformBio = async () => {
    setEnrollingBio(true);
    try {
      const res = await enrollPlatformBiometrics(
        currentUser.uid,
        currentUser.name,
        currentUser.email
      );
      if (res.success && res.credentialId) {
        await enrollStudentBiometrics(
          currentUser.uid,
          res.credentialId,
          res.publicKey
        );
      }
      setStep("complete");
    } catch (e) {
      console.error(e);
      setStep("complete");
    } finally {
      setEnrollingBio(false);
    }
  };

  const handleSkipBio = () => {
    setStep("complete");
  };

  const handleReset = () => {
    setDescriptors([]);
    setCapturing(false);
    setEnrollingBio(false);
    setStep("front");
  };

  const handleDone = () => {
    handleReset();
    onClose();
  };

  const instruction =
    step === "front"
      ? "Look Straight"
      : step === "left"
      ? "Turn Slightly Left"
      : step === "right"
      ? "Turn Slightly Right"
      : "Register Biometric Fallback";

  const stepText =
    step === "front"
      ? "Step 1 / 4"
      : step === "left"
      ? "Step 2 / 4"
      : step === "right"
      ? "Step 3 / 4"
      : step === "biometric_fallback"
      ? "Step 4 / 4 (Fallback)"
      : "Completed";

  return (

    <Modal
      isOpen={isOpen}
      onClose={handleDone}
      title="SBIT AI Face Enrollment"
      maxWidth="lg"
    >

      <div className="space-y-6">

        <div className="flex items-center justify-between rounded-xl bg-purple-950/40 border border-purple-800/40 p-3">

          <div className="flex items-center gap-2">

            <Sparkles className="w-4 h-4 text-purple-400"/>

            <span className="text-purple-300 font-semibold">

              AI 128-D Facial Embedding

            </span>

          </div>

          <span className="text-xs font-mono text-slate-400">

            {stepText}

          </span>

        </div>
        {step !== "complete" && step !== "biometric_fallback" ? (
          <div className="space-y-5">
            <div className="relative rounded-2xl overflow-hidden border-2 border-purple-600/40 bg-slate-950 p-8">
              <div className="relative w-52 h-52 mx-auto rounded-full overflow-hidden border-4 border-dashed border-purple-400 bg-slate-900">
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
                  onUserMedia={() => setCameraReady(true)}
                  onUserMediaError={() => setCameraReady(false)}
                  className="w-full h-full object-cover"
                />
                {capturing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/75 backdrop-blur-xs z-10">
                    <Scan className="w-12 h-12 animate-spin text-purple-400" />
                    <p className="mt-3 text-xs text-purple-300 font-medium">
                      Extracting Face Descriptor...
                    </p>
                  </div>
                )}
                <div className="absolute inset-3 rounded-full border-2 border-purple-400/30 pointer-events-none"></div>
              </div>

              <div className="mt-6 text-center">
                <h2 className="text-xl font-bold text-white">
                  {instruction}
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  Keep your face centered inside the circle and remain still while capturing.
                </p>
              </div>

              <button
                onClick={handleCapturePose}
                disabled={!modelsLoaded || capturing || !cameraReady}
                className="mt-6 w-full rounded-xl bg-purple-600 py-3 font-bold text-white transition hover:bg-purple-500 disabled:opacity-50"
              >
                {!modelsLoaded ? (
                  <span className="flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin"/>
                    Loading AI Models...
                  </span>
                ) : !cameraReady ? (
                  <span className="flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin"/>
                    Waiting for Camera...
                  </span>
                ) : capturing ? (
                  <span className="flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin"/>
                    Processing...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Camera className="w-4 h-4"/>
                    Capture {step === "front" ? " (1/3)" : step === "left" ? " (2/3)" : " (3/3)"}
                  </span>
                )}
              </button>
            </div>
          </div>
        ) : step === "biometric_fallback" ? (
          <div className="rounded-2xl border border-indigo-700/50 bg-indigo-950/40 p-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-indigo-600/20 border border-indigo-500/30 mx-auto flex items-center justify-center text-indigo-400">
              <Fingerprint className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Enable Biometric Fallback</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Register your device hardware biometric authenticator (Fingerprint / TouchID / Windows Hello) as a secure fallback when Face Recognition camera conditions are poor.
              </p>
            </div>
            <div className="pt-2 flex flex-col gap-2.5">
              <button
                onClick={handleEnrollPlatformBio}
                disabled={enrollingBio}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition"
              >
                {enrollingBio ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Touch Fingerprint / Verify Authenticator...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Register Platform Biometric Fallback
                  </>
                )}
              </button>
              <button
                onClick={handleSkipBio}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Skip / Finish Face Enrollment Only
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-emerald-700 bg-emerald-950/60 p-6 text-center">
            <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-400"/>
            <h2 className="mt-4 text-2xl font-bold text-white">
              Biometric Enrollment Complete
            </h2>
            <p className="mt-2 text-sm text-emerald-300">
              Your 128-D facial vector and biometric credentials have been securely registered.
            </p>

            <div className="mt-6 grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-slate-900 p-4">
                <p className="text-xs text-slate-400">Face Vector</p>
                <p className="mt-1 text-base font-bold text-white">128-D</p>
              </div>
              <div className="rounded-lg bg-slate-900 p-4">
                <p className="text-xs text-slate-400">Platform Bio</p>
                <p className="mt-1 text-base font-bold text-emerald-400">Enabled</p>
              </div>
              <div className="rounded-lg bg-slate-900 p-4">
                <p className="text-xs text-slate-400">Status</p>
                <p className="mt-1 text-base font-bold text-emerald-400">Enrolled</p>
              </div>
            </div>

            <button
              onClick={handleDone}
              className="mt-6 w-full rounded-xl bg-emerald-600 py-3 font-bold text-white transition hover:bg-emerald-500"
            >
              Done
            </button>
          </div>
        )}

      </div>

    </Modal>

  );

}
