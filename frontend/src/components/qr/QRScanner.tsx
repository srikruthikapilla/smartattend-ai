import React, { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { useAttendance } from "../../context/AttendanceContext";

interface QRScannerProps {
  studentId: string;
}

export const QRScanner: React.FC<QRScannerProps> = ({ studentId }) => {
  const { recordAttendanceQR } = useAttendance();

  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  const [scanResult, setScanResult] = useState("");

  useEffect(() => {
    if (scannerRef.current) return;

    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      {
        fps: 10,
        qrbox: {
          width: 250,
          height: 250,
        },
      },
      false
    );

    scanner.render(
      (decodedText) => {
        setScanResult(decodedText);

        recordAttendanceQR(studentId);

        scanner.clear();
      },
      () => {
        // Ignore scan errors
      }
    );

    scannerRef.current = scanner;

    return () => {
      scanner
        .clear()
        .catch(() => {});
    };
  }, [studentId]);

  return (
    <div className="glass-panel p-6 rounded-xl">

      <h2 className="text-2xl font-bold mb-5">
        Scan Attendance QR
      </h2>

      <div
        id="qr-reader"
        className="rounded-xl overflow-hidden"
      />

      {scanResult && (
        <div className="mt-5 p-4 rounded-lg bg-green-900/30 border border-green-700">

          <div className="text-green-400 font-bold">
            QR Detected Successfully
          </div>

          <div className="text-sm mt-2 break-all">
            {scanResult}
          </div>

        </div>
      )}

    </div>
  );
};

export default QRScanner;