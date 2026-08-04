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
} from "lucide-react";

import { Modal } from "../common/Modal";

import { useAuth } from "../../context/AuthContext";

import {
  generateFaceDescriptor,
} from "../../utils/faceRecognition";

import {
  loadFaceModels,
} from "../../face/faceApiLoader";

interface FaceEnrollmentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step =
  | "front"
  | "left"
  | "right"
  | "complete";

export default function FaceEnrollmentModal({
  isOpen,
  onClose,
}: FaceEnrollmentModalProps) {

  const {
    currentUser,
    enrollStudentFace,
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

      }

      catch (err) {

        console.error(err);

        alert(
          "Unable to load Face AI Models."
        );

      }

    }

    init();

  }, []);

  if (!currentUser) {

    return null;

  }

  function averageDescriptors(
    list: number[][]
  ) {

    const avg =
      new Array(128).fill(0);

    for (const descriptor of list) {

      for (
        let i = 0;
        i < 128;
        i++
      ) {

        avg[i] += descriptor[i];

      }

    }

    return avg.map(
      value => value / list.length
    );

  }

  function normalizeDescriptor(
    descriptor: number[]
  ) {

    const magnitude =
      Math.sqrt(

        descriptor.reduce(

          (sum, value) =>
            sum + value * value,

          0

        )

      );

    return descriptor.map(

      value =>
        value / magnitude

    );

  }
    const handleCapturePose = async () => {

    if (!modelsLoaded) {

      alert("AI models are still loading.");

      return;

    }

    setCapturing(true);

    try {

      const video = webcamRef.current?.video;

      if (!video || video.readyState !== 4) {

        alert("Camera is not ready.");

        return;

      }

      const descriptor =
        await generateFaceDescriptor(video);

      if (!descriptor) {

        alert(
          "No face detected.\n\nPlease:\n• Keep your face inside the frame\n• Face the camera\n• Ensure proper lighting."
        );

        return;

      }

      const updatedDescriptors = [
        ...descriptors,
        descriptor,
      ];

      setDescriptors(updatedDescriptors);

      if (step === "front") {

        setStep("left");

        return;

      }

      if (step === "left") {

        setStep("right");

        return;

      }

      // Third capture

      const averagedDescriptor =
        averageDescriptors(
          updatedDescriptors
        );

      const finalDescriptor =
        normalizeDescriptor(
          averagedDescriptor
        );

      enrollStudentFace(
        currentUser.uid,
        finalDescriptor
      );

      setStep("complete");

    } catch (error) {

      console.error(error);

      alert(
        "Face enrollment failed. Please try again."
      );

    } finally {

      setCapturing(false);

    }

  };

  const handleReset = () => {

    setDescriptors([]);

    setCapturing(false);

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
      : "Turn Slightly Right";

  const stepText =
    step === "front"
      ? "Step 1 / 3"
      : step === "left"
      ? "Step 2 / 3"
      : step === "right"
      ? "Step 3 / 3"
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
                {step !== "complete" ? (

          <div className="space-y-5">

            <div className="relative rounded-2xl overflow-hidden border-2 border-purple-600/40 bg-slate-950 p-8">

              <div className="relative w-52 h-52 mx-auto rounded-full overflow-hidden border-4 border-dashed border-purple-400 bg-slate-900">

                {capturing ? (

                  <div className="absolute inset-0 flex flex-col items-center justify-center">

                    <Scan className="w-12 h-12 animate-spin text-purple-400" />

                    <p className="mt-3 text-xs text-purple-300">

                      Extracting Face Descriptor...

                    </p>

                  </div>

                ) : (

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

                )}

                <div className="absolute inset-3 rounded-full border-2 border-purple-400/30"></div>

              </div>

              <div className="mt-6 text-center">

                <h2 className="text-xl font-bold text-white">

                  {instruction}

                </h2>

                <p className="mt-2 text-sm text-slate-400">

                  Keep your face centered inside the circle and
                  remain still while capturing.

                </p>

              </div>

              <button
                onClick={handleCapturePose}
                disabled={!modelsLoaded || capturing}
                className="mt-6 w-full rounded-xl bg-purple-600 py-3 font-bold text-white transition hover:bg-purple-500 disabled:opacity-50"
              >

                {!modelsLoaded ? (

                  <span className="flex items-center justify-center gap-2">

                    <RefreshCw className="w-4 h-4 animate-spin"/>

                    Loading AI Models...

                  </span>

                ) : capturing ? (

                  <span className="flex items-center justify-center gap-2">

                    <RefreshCw className="w-4 h-4 animate-spin"/>

                    Processing...

                  </span>

                ) : (

                  <span className="flex items-center justify-center gap-2">

                    <Camera className="w-4 h-4"/>

                    Capture

                    {step === "front"
                      ? " (1/3)"
                      : step === "left"
                      ? " (2/3)"
                      : " (3/3)"}

                  </span>

                )}

              </button>

            </div>

          </div>

        ) : (

          <div className="rounded-2xl border border-emerald-700 bg-emerald-950/60 p-6 text-center">

            <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-400"/>

            <h2 className="mt-4 text-2xl font-bold text-white">

              Face Enrollment Complete

            </h2>

            <p className="mt-2 text-sm text-emerald-300">

              Your biometric template has been securely saved.

            </p>

            <div className="mt-6 grid grid-cols-3 gap-3">

              <div className="rounded-lg bg-slate-900 p-4">

                <p className="text-xs text-slate-400">

                  Poses

                </p>

                <p className="mt-1 text-lg font-bold text-white">

                  3

                </p>

              </div>

              <div className="rounded-lg bg-slate-900 p-4">

                <p className="text-xs text-slate-400">

                  Descriptor

                </p>

                <p className="mt-1 text-lg font-bold text-white">

                  128D

                </p>

              </div>

              <div className="rounded-lg bg-slate-900 p-4">

                <p className="text-xs text-slate-400">

                  Status

                </p>

                <p className="mt-1 text-lg font-bold text-emerald-400">

                  Saved

                </p>

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