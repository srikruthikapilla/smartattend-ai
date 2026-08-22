import React, { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { useAttendance } from "../../context/AttendanceContext";
import {
  RefreshCw,
  Clock,
  Users,
  ShieldCheck,
  Maximize2,
  Minimize2,
  Sparkles,
  MapPin,
  Copy,
  Check,
  ExternalLink,
  QrCode,
  Smartphone
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

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const kioskCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isKioskMode, setIsKioskMode] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Compute full clickable Check-in URL
  const checkinUrl = activeSession
    ? (qrToken && qrToken.startsWith("http")
      ? qrToken
      : `${window.location.origin}/checkin?token=${encodeURIComponent(qrToken || activeSession.sessionId || "live")}`)
    : "";

  const handleCopyLink = () => {
    if (!checkinUrl) return;
    navigator.clipboard.writeText(checkinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Render Standard QR Canvas (responsive ~240px)
  useEffect(() => {
    if (!canvasRef.current || !checkinUrl) return;

    QRCode.toCanvas(
      canvasRef.current,
      checkinUrl,
      {
        width: 220,
        margin: 1.5,
        color: {
          dark: "#0f172a",
          light: "#ffffff",
        },
      },
      (err) => {
        if (err) console.error("QR Canvas error:", err);
      }
    );
  }, [checkinUrl]);

  // Render Kiosk Mode Fullscreen QR Canvas (~420px)
  useEffect(() => {
    if (isKioskMode && kioskCanvasRef.current && checkinUrl) {
      QRCode.toCanvas(
        kioskCanvasRef.current,
        checkinUrl,
        {
          width: 380,
          margin: 2,
          color: {
            dark: "#0f172a",
            light: "#ffffff",
          },
        },
        (err) => {
          if (err) console.error("Kiosk QR Canvas error:", err);
        }
      );
    }
  }, [checkinUrl, isKioskMode]);

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
          Start an Innovation Centre session to display the live dynamic QR code and check-in portal.
        </p>
      </div>
    );
  }

  const sessionRecords = attendanceRecords.filter(
    (r) => r.sessionId === activeSession.sessionId
  );
  const presentCount = sessionRecords.filter((r) => r.status === "present").length;
  const lateCount = sessionRecords.filter((r) => r.status === "late").length;
  const rotationProgress = (rotationCountdown / 60) * 100;
  const mins = Math.floor(sessionCountdown / 60);
  const secs = sessionCountdown % 60;

  return (
    <div className="w-full flex flex-col items-center">
      {/* Fullscreen Projector Kiosk Modal */}
      {isKioskMode && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-2xl p-6 sm:p-10 flex flex-col justify-between items-center text-white overflow-hidden animate-fadeIn">
          {/* Top Bar */}
          <div className="w-full max-w-5xl flex justify-between items-center border-b border-slate-800 pb-4">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-teal-400 font-heading">
                SBIT INNOVATION CENTRE • LIVE PROJECTOR KIOSK
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-0.5 font-heading">
                {activeSession.sessionTitle || "Innovation Centre Prototype Session"}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Faculty: {activeSession.facultyName || "Faculty Member"} • Room: {activeSession.room || "Innovation Centre"}
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
                <span className="hidden sm:inline">Exit Kiosk</span>
              </button>
            </div>
          </div>

          {/* Center Large QR */}
          <div className="flex flex-col items-center justify-center space-y-4 my-auto">
            <div className="p-4 sm:p-6 bg-white rounded-3xl shadow-2xl shadow-teal-500/20 border-4 border-teal-500/40">
              <canvas ref={kioskCanvasRef} className="max-w-full h-auto rounded-xl" />
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
                  <RefreshCw className="w-3 h-3 animate-spin" /> Dynamic Refresh
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
              Scan with Google Lens / Phone Camera to open the AI facial recognition check-in page.
            </p>
          </div>
        </div>
      )}

      {/* Standard Compact QR Widget */}
      <div className="w-full flex flex-col items-center space-y-4">
        {/* Header Controls */}
        <div className="w-full flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-700 dark:text-teal-400 text-[11px] font-bold">
            <RefreshCw className="w-3 h-3 animate-spin text-teal-600 dark:text-teal-400 flex-shrink-0" />
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
        <div className="p-3 bg-white rounded-2xl shadow-md border border-slate-200 dark:border-slate-700 flex items-center justify-center">
          <canvas ref={canvasRef} className="rounded-lg max-w-full h-auto block" />
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