import React, { useEffect, useState, useMemo } from "react";
import QRCode from "qrcode";
import { useAttendance } from "../../context/AttendanceContext";
import {
  RefreshCw,
  Clock,
  ShieldCheck,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  ExternalLink,
  MapPin
} from "lucide-react";

export const QRGenerator: React.FC = () => {
  const {
    activeSession,
    qrToken,
    rotationCountdown,
    sessionCountdown,
    attendanceRecords,
    geofence,
  } = useAttendance();

  const [isKioskMode, setIsKioskMode] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [standardQrUrl, setStandardQrUrl] = useState<string>("");
  const [kioskQrUrl, setKioskQrUrl] = useState<string>("");

  // Compute full clickable Check-in URL
  const checkinUrl = useMemo(() => {
    if (!activeSession) return "";
    if (qrToken && qrToken.startsWith("http")) return qrToken;
    const tokenParam = encodeURIComponent(qrToken || activeSession.sessionId || "live");
    return `${window.location.origin}/checkin?token=${tokenParam}`;
  }, [activeSession, qrToken]);

  const handleCopyLink = () => {
    if (!checkinUrl) return;
    navigator.clipboard.writeText(checkinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Close kiosk on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isKioskMode) {
        setIsKioskMode(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isKioskMode]);

  // Pre-generate flicker-free QR image Data URLs whenever checkinUrl changes
  useEffect(() => {
    if (!checkinUrl) {
      setStandardQrUrl("");
      setKioskQrUrl("");
      return;
    }

    let isMounted = true;

    // Compact standard widget (~240px)
    QRCode.toDataURL(checkinUrl, {
      width: 240,
      margin: 1.5,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (isMounted) setStandardQrUrl(url);
      })
      .catch((err) => console.error("Standard QR generation error:", err));

    // Projector Kiosk high-resolution (~480px)
    QRCode.toDataURL(checkinUrl, {
      width: 480,
      margin: 2,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (isMounted) setKioskQrUrl(url);
      })
      .catch((err) => console.error("Kiosk QR generation error:", err));

    return () => {
      isMounted = false;
    };
  }, [checkinUrl]);

  if (!activeSession) {
    return (
      <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-700/60 w-12 h-12 mx-auto flex items-center justify-center mb-3 text-slate-400">
          <Clock className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">
          No Active Attendance Session
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Start an attendance session to display the live dynamic QR code and check-in portal.
        </p>
      </div>
    );
  }

  const sessionRecords = attendanceRecords.filter(
    (r) => r.sessionId === activeSession.sessionId
  );
  const presentCount = sessionRecords.filter((r) => r.status === "present").length;
  const lateCount = sessionRecords.filter((r) => r.status === "late").length;
  const rotationProgress = Math.max(0, Math.min(100, (rotationCountdown / 60) * 100));
  const mins = Math.floor(sessionCountdown / 60);
  const secs = sessionCountdown % 60;

  return (
    <div className="w-full flex flex-col items-center">
      {/* Fullscreen Projector Kiosk Modal (Solid dark background, flicker-free image layer) */}
      {isKioskMode && (
        <div className="fixed inset-0 z-50 bg-slate-950 p-6 sm:p-10 flex flex-col justify-between items-center text-white overflow-hidden select-none">
          {/* Top Bar */}
          <div className="w-full max-w-5xl flex justify-between items-center border-b border-slate-800 pb-4">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-teal-400 font-heading">
                CAMPUS LIVE PROJECTOR KIOSK
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-0.5 font-heading">
                {activeSession.sessionTitle || "Classroom Lecture Session"}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Faculty: {activeSession.facultyName || "Faculty Member"} • Room: {activeSession.room || "Campus Hall"}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-3xl sm:text-4xl font-mono font-black text-amber-400">
                  {mins.toString().padStart(2, "0")}:{secs.toString().padStart(2, "0")}
                </div>
                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Remaining</div>
              </div>
              <button
                type="button"
                onClick={() => setIsKioskMode(false)}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition flex items-center gap-1.5"
              >
                <Minimize2 className="w-4 h-4" />
                <span className="hidden sm:inline">Exit Kiosk (Esc)</span>
              </button>
            </div>
          </div>

          {/* Center Large QR (Hardware-accelerated, zero-flicker static image) */}
          <div className="flex flex-col items-center justify-center space-y-4 my-auto">
            <div
              className="p-4 sm:p-6 bg-white rounded-3xl shadow-2xl shadow-teal-500/20 border-4 border-teal-500/40 transition-none"
              style={{ transform: "translateZ(0)", willChange: "transform" }}
            >
              {kioskQrUrl ? (
                <img
                  src={kioskQrUrl}
                  alt="Live Attendance QR Code"
                  className="w-[280px] sm:w-[380px] h-[280px] sm:h-[380px] rounded-xl object-contain block select-none pointer-events-none"
                  style={{ imageRendering: "pixelated" }}
                />
              ) : (
                <div className="w-[280px] sm:w-[380px] h-[280px] sm:h-[380px] flex items-center justify-center">
                  <RefreshCw className="w-10 h-10 text-teal-500 animate-spin" />
                </div>
              )}
            </div>

            {/* Direct Link Banner */}
            <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl p-3 flex items-center justify-between gap-2 text-xs">
              <div className="truncate flex-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Direct Check-in URL:</span>
                <span className="text-teal-300 font-mono font-medium truncate block">{checkinUrl}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-2.5 py-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 font-bold transition flex items-center gap-1 text-xs"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
                <a
                  href={checkinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  title="Open in new tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Countdown bar */}
            <div className="w-full max-w-sm space-y-1.5">
              <div className="flex justify-between text-xs text-slate-300 font-bold">
                <span className="flex items-center gap-1 text-teal-400 font-mono">
                  <RefreshCw className="w-3 h-3 text-teal-400" /> Dynamic Rotation
                </span>
                <span className="font-mono">{rotationCountdown}s remaining</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
                <div
                  className="h-full bg-gradient-to-r from-teal-400 to-emerald-400 rounded-full transition-all duration-1000"
                  style={{ width: `${rotationProgress}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold text-teal-400 bg-teal-950/60 px-4 py-1.5 rounded-full border border-teal-800/60">
              <ShieldCheck className="w-4 h-4 text-teal-400" />
              <span>Anti-Screenshot & Dynamic Geofence Verification Active</span>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="w-full max-w-5xl flex justify-between items-center bg-slate-900/80 p-4 rounded-2xl border border-slate-800 text-xs">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-xl font-bold text-teal-400">{presentCount}</span>
                <p className="text-[10px] text-slate-400 uppercase font-bold">Present</p>
              </div>
              <div>
                <span className="text-xl font-bold text-amber-400">{lateCount}</span>
                <p className="text-[10px] text-slate-400 uppercase font-bold">Late</p>
              </div>
              <div>
                <span className="text-xl font-bold text-blue-400">{geofence.radiusMeters}m</span>
                <p className="text-[10px] text-slate-400 uppercase font-bold">GPS Zone</p>
              </div>
            </div>
            <p className="text-slate-400 hidden sm:block">
              Scan with Phone Camera or Google Lens to open the student facial check-in portal.
            </p>
          </div>
        </div>
      )}

      {/* Standard Compact QR Widget */}
      <div className="w-full flex flex-col items-center space-y-4">
        {/* Header Controls */}
        <div className="w-full flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-700 dark:text-teal-400 text-[11px] font-bold">
            <RefreshCw className="w-3 h-3 text-teal-600 dark:text-teal-400 flex-shrink-0" />
            <span>Dynamic QR ({rotationCountdown}s)</span>
          </div>

          <button
            type="button"
            onClick={() => setIsKioskMode(true)}
            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-bold border border-slate-200 dark:border-slate-700 transition flex items-center gap-1 font-heading"
          >
            <Maximize2 className="w-3 h-3" />
            <span>Projector View</span>
          </button>
        </div>

        {/* QR Code Canvas */}
        <div
          className="p-3 bg-white rounded-2xl shadow-md border border-slate-200 dark:border-slate-700 flex items-center justify-center"
          style={{ transform: "translateZ(0)" }}
        >
          {standardQrUrl ? (
            <img
              src={standardQrUrl}
              alt="Attendance QR Code"
              className="w-[220px] h-[220px] rounded-lg object-contain block select-none pointer-events-none"
              style={{ imageRendering: "pixelated" }}
            />
          ) : (
            <div className="w-[220px] h-[220px] flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-teal-500 animate-spin" />
            </div>
          )}
        </div>

        {/* Rotation Countdown Progress */}
        <div className="w-full space-y-1">
          <div className="flex justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
            <span>Anti-Screenshot Refresh</span>
            <span className="font-mono text-teal-600 dark:text-teal-400">{rotationCountdown}s</span>
          </div>
          <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-500 rounded-full transition-all duration-1000"
              style={{ width: `${rotationProgress}%` }}
            />
          </div>
        </div>

        {/* Badge */}
        <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-teal-600 dark:text-teal-400">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Dynamic QR & GPS Geofence Active</span>
        </div>
      </div>
    </div>
  );
};