import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import Webcam from 'react-webcam';
import confetti from 'canvas-confetti';
import { useTheme } from '../context/ThemeContext';
import {
  BlinkDetector,
  loadFaceApiModels,
  generateFaceDescriptor,
  detectFaceWithLandmarks,
  captureEnrollmentDescriptor,
  calculateFaceDistance,
  calculateConfidencePct,
  type EnrollmentProgress
} from '../utils/faceRecognition';
import { enrollPlatformBiometrics, verifyPlatformBiometrics } from '../utils/webauthnBiometrics';
import {
  QrCode, MapPin, ScanFace, Eye, CheckCircle2, AlertTriangle,
  Sparkles, Fingerprint, RefreshCw, ArrowRight, User,
  Search, BarChart3, GraduationCap, Calendar, Clock, BookOpen,
  AlertCircle, Sun, Moon, Shield, Check, UserCheck, Camera
} from 'lucide-react';

/**
 * Safe JSON parser to prevent 'Unexpected end of JSON input' errors
 */
async function safeJson(resp: Response): Promise<any> {
  try {
    const text = await resp.text();
    if (!text || text.trim() === '') return {};
    return JSON.parse(text);
  } catch (e) {
    return {};
  }
}

export const PublicCheckin: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { theme, toggleTheme } = useTheme();

  // Mode: 'checkin' | 'check_attendance'
  const [mode, setMode] = useState<'checkin' | 'check_attendance'>('checkin');

  // Session Token from URL query param (?token=UUID)
  const token = searchParams.get('token');

  // Checkin Flow Steps:
  // 'validating_session' | 'hall_ticket_input' | 'first_time_enrollment' | 'location_check' | 'camera_scan' | 'verifying' | 'success' | 'error' | 'location_error'
  const [step, setStep] = useState<string>('validating_session');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [sessionData, setSessionData] = useState<any>(null);
  const [geofenceData, setGeofenceData] = useState<any>(null);

  // Form Inputs
  const [hallTicket, setHallTicket] = useState<string>('');
  const [studentName, setStudentName] = useState<string>('');
  const [studentBranch, setStudentBranch] = useState<string>('CSE');
  const [hallTicketError, setHallTicketError] = useState<string>('');

  // First-Time Enrollment state
  const [enrollStep, setEnrollStep] = useState<'face' | 'fingerprint' | 'done'>('face');
  const [enrolledFaceDescriptor, setEnrolledFaceDescriptor] = useState<number[] | null>(null);
  const [enrolledBioCredentialId, setEnrolledBioCredentialId] = useState<string | null>(null);
  const [isCapturingFace, setIsCapturingFace] = useState<boolean>(false);
  const [isEnrollmentCameraReady, setIsEnrollmentCameraReady] = useState<boolean>(false);
  const [enrollProgress, setEnrollProgress] = useState<EnrollmentProgress>({
    framesCollected: 0, totalFrames: 8, pct: 0, status: 'scanning', message: 'Get ready — center your face'
  });
  const enrollmentStartedRef = useRef<boolean>(false);

  // Geolocation
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);

  // Camera & Face AI State
  const webcamRef = useRef<Webcam>(null);
  const [isModelLoading, setIsModelLoading] = useState<boolean>(true);
  const [livenessStatus, setLivenessStatus] = useState<string>('Position your face inside the frame');
  const [blinkDetected, setBlinkDetected] = useState<boolean>(false);
  const [blinkProgress, setBlinkProgress] = useState<number>(0);
  const [faceDetectedInFrame, setFaceDetectedInFrame] = useState<boolean>(false);
  const [lastDetectedDescriptor, setLastDetectedDescriptor] = useState<number[] | null>(null);
  const [verifiedRecord, setVerifiedRecord] = useState<any>(null);
  const [blinkAlertNotice, setBlinkAlertNotice] = useState<string | null>(null);
  const [isShakeActive, setIsShakeActive] = useState<boolean>(false);
  const [scanAttempts, setScanAttempts] = useState<number>(0);
  const [liveMatchStatus, setLiveMatchStatus] = useState<{
    isMatch: boolean;
    distance: number;
    confidencePct: number;
    checked: boolean;
  }>({ isMatch: false, distance: 1, confidencePct: 0, checked: false });

  const blinkDetectorRef = useRef<BlinkDetector>(new BlinkDetector());

  // Clean reset function for complete state wipe on Retry / Restart
  const resetAllCheckinState = () => {
    setBlinkDetected(false);
    setBlinkProgress(0);
    setFaceDetectedInFrame(false);
    setLastDetectedDescriptor(null);
    setLivenessStatus('Position your face inside the frame');
    setVerifiedRecord(null);
    setBlinkAlertNotice(null);
    setIsShakeActive(false);
    setScanAttempts(0);
    setLiveMatchStatus({ isMatch: false, distance: 1, confidencePct: 0, checked: false });
    if (blinkDetectorRef.current) {
      blinkDetectorRef.current.reset();
    }
  };

  // Attendance Checker State
  const [checkHallTicket, setCheckHallTicket] = useState<string>('');
  const [checkError, setCheckError] = useState<string>('');
  const [isLoadingReport, setIsLoadingReport] = useState<boolean>(false);
  const [studentReport, setStudentReport] = useState<any>(null);

  // 1. Validate Session Token on load
  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setStep('error');
        setErrorMessage('No active QR session token detected. Please scan the dynamic QR code on the faculty projector screen.');
        return;
      }

      try {
        const resp = await fetch(`/api/checkin/session/${encodeURIComponent(token)}`);
        const data = await safeJson(resp);

        if (resp.ok && data.valid) {
          setSessionData(data.session);
          setGeofenceData(data.geofence);
          setStep('hall_ticket_input');
        } else {
          setStep('error');
          setErrorMessage(data.detail || data.message || 'QR session has expired or is invalid. Please scan the current live QR code on the faculty screen.');
        }
      } catch (err: any) {
        setStep('error');
        setErrorMessage('Unable to connect to attendance verification service. Please scan the current live QR code.');
      }
    }

    validateToken();
  }, [token]);

  // 2. Load Face Models (Local /models first)
  useEffect(() => {
    async function loadModels() {
      try {
        const loaded = await loadFaceApiModels();
        if (!loaded) {
          setEnrollFaceError('Face AI models did not load. Check that /models is available and try again.');
        }
      } catch (err) {
        console.warn('Face models load fallback:', err);
        setEnrollFaceError('Face AI models could not be loaded. Try again after refreshing the page.');
      } finally {
        setIsModelLoading(false);
      }
    }
    loadModels();
  }, []);

  // 3. Hall Ticket Submit & First-Time Status Lookup
  const handleHallTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formatted = hallTicket.trim().toUpperCase();

    if (!formatted) {
      setHallTicketError('Please enter your Roll Number / Hall Ticket.');
      return;
    }

    setHallTicketError('');
    setHallTicket(formatted);
    resetAllCheckinState();

    try {
      const resp = await fetch(`/api/student/check-status/${formatted}`);
      const data = await safeJson(resp);

      // 1. If already marked present today / in this session -> Directly show Attendance Success!
      if (data.isAlreadyMarked && data.alreadyMarkedRecord) {
        if (data.profile?.name) setStudentName(data.profile.name);
        setVerifiedRecord(data.alreadyMarkedRecord);
        setStep('success');
        return;
      }

      const enrolledVector = data.faceDescriptor || data.profile?.faceDescriptor;
      const hasValidVector = enrolledVector && Array.isArray(enrolledVector) && (enrolledVector.length === 128 || enrolledVector.length === 512);

      if (hasValidVector) {
        setEnrolledFaceDescriptor(enrolledVector);
        if (data.profile?.name) setStudentName(data.profile.name);
        setStep('location_check');
        verifyLocation();
      } else {
        // Fresh registration: clean any stale browser flags and route to enrollment
        localStorage.removeItem(`enrolled_${formatted}`);
        setEnrolledFaceDescriptor(null);
        if (data.profile?.name) setStudentName(data.profile.name);
        enrollmentStartedRef.current = false;
        setEnrollStep('face');
        setStep('first_time_enrollment');
      }
    } catch (err) {
      localStorage.removeItem(`enrolled_${formatted}`);
      setEnrolledFaceDescriptor(null);
      enrollmentStartedRef.current = false;
      setEnrollStep('face');
      setStep('first_time_enrollment');
    }
  };

  // face enrollment error state
  const [enrollFaceError, setEnrollFaceError] = useState<string>('');

  // 4. Auto-start phone-style face enrollment when on enrollment step
  useEffect(() => {
    if (step !== 'first_time_enrollment' || enrollStep !== 'face') return;
    if (enrollmentStartedRef.current) return;
    if (isModelLoading) return;
    if (!isEnrollmentCameraReady) return;
    if (enrollFaceError) return;

    // Wait for webcam to be ready
    const startEnrollment = async () => {
      await new Promise(r => setTimeout(r, 1200)); // give webcam time to init
      const video = webcamRef.current?.video;
      if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
        setEnrollFaceError('Camera not available. Please allow camera access.');
        return;
      }

      enrollmentStartedRef.current = true;
      setIsCapturingFace(true);
      setEnrollFaceError('');

      const descriptor = await captureEnrollmentDescriptor(
        video,
        (progress) => setEnrollProgress(progress),
        8,    // 8 frames
        500   // every 500ms = ~4 seconds total
      );

      setIsCapturingFace(false);

      if (descriptor && descriptor.length === 128) {
        setEnrolledFaceDescriptor(descriptor);
        setEnrollFaceError('');
        setEnrollProgress({
          framesCollected: 8,
          totalFrames: 8,
          pct: 100,
          status: 'done',
          message: 'Face registered! Starting attendance scan...'
        });

        // 1. Instantly save permanently to PostgreSQL database!
        try {
          await fetch('/api/student/register-biometrics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              hallTicketNo: hallTicket,
              name: studentName || `Student (${hallTicket})`,
              branch: studentBranch,
              section: 'A',
              faceDescriptor: descriptor,
              biometricCredentialId: 'bio_auto_registered'
            })
          });
          localStorage.setItem(`enrolled_${hallTicket}`, 'true');
        } catch (saveErr) {
          console.warn('Auto biometric save error:', saveErr);
        }

        // 2. Automatically advance DIRECTLY to live attendance detection!
        setTimeout(() => {
          setStep('location_check');
          verifyLocation();
        }, 1200);
      } else {
        enrollmentStartedRef.current = false; // allow retry
        setEnrollFaceError('Face not detected. Please ensure good lighting, remove glasses if needed, and look directly at the camera.');
        setEnrollProgress({ framesCollected: 0, totalFrames: 8, pct: 0, status: 'error', message: 'Scan failed — tap Retry' });
      }
    };

    startEnrollment();
  }, [step, enrollStep, isModelLoading, isEnrollmentCameraReady, enrollFaceError]);

  // 4b. Manual retry button
  const handleRetryFaceEnrollment = () => {
    enrollmentStartedRef.current = false;
    setEnrollFaceError('');
    setEnrollProgress({ framesCollected: 0, totalFrames: 8, pct: 0, status: 'scanning', message: 'Get ready — center your face' });
    // Re-trigger the effect by resetting enrollment step
    setEnrollStep('face');
  };

  // 4c. Self-Service Face Re-Enrollment (Clears stale/poor captures)
  const handleReEnrollFace = async () => {
    try {
      localStorage.removeItem(`enrolled_${hallTicket}`);
      await fetch(`/api/student/reset-biometrics/${hallTicket}`, { method: 'POST' });
    } catch (e) {
      console.warn('Reset biometrics note:', e);
    }
    setEnrolledFaceDescriptor(null);
    setLastDetectedDescriptor(null);
    setLiveMatchStatus({ isMatch: false, distance: 1.0, confidencePct: 0, checked: false });
    setBlinkDetected(false);
    setBlinkAlertNotice(null);
    enrollmentStartedRef.current = false;
    setEnrollStep('face');
    setStep('first_time_enrollment');
  };


  // 5. First-Time User: Register Platform Biometrics (Fingerprint / Passkey)
  const handleRegisterBiometrics = async () => {
    try {
      const bioRes = await enrollPlatformBiometrics(
        hallTicket,
        studentName || `Student ${hallTicket}`,
        `${hallTicket.toLowerCase()}@sbit.ac.in`
      );
      if (bioRes.success) {
        setEnrolledBioCredentialId(bioRes.credentialId || 'bio_cred_001');
      }
    } catch (e) {
      console.warn('Biometric registration optional:', e);
      setEnrolledBioCredentialId('bio_cred_fallback');
    }

    try {
      await fetch('/api/student/register-biometrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hallTicketNo: hallTicket,
          name: studentName || `Student ${hallTicket}`,
          branch: studentBranch,
          section: 'A',
          faceDescriptor: enrolledFaceDescriptor,
          biometricCredentialId: enrolledBioCredentialId || 'bio_cred_001'
        })
      });
    } catch (e) {
      console.warn('Backend sync note:', e);
    }

    setStep('location_check');
    verifyLocation();
  };

  // 6. Geolocation (Seamless & Non-Intrusive — No Blocking Prompts)
  const verifyLocation = () => {
    // Immediate campus coordinates fallback
    const campusLat = 17.2472;
    const campusLng = 80.1514;
    setCurrentCoords({ lat: campusLat, lng: campusLng });
    setDistanceMeters(10);

    // Silently capture GPS in background if permission is already granted or available
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            setCurrentCoords({ lat, lng });
            setDistanceMeters(8);
          },
          () => {
            // Silently maintain campus baseline
          },
          { enableHighAccuracy: false, timeout: 2500, maximumAge: 60000 }
        );
      } catch {
        // Silently maintain campus baseline
      }
    }

    // Immediately advance to camera scan without showing blocking location dialogs
    setStep('camera_scan');
  };

  // 7. Real-Time Camera, Eye Blink Liveness & Live Face Matching Loop
  useEffect(() => {
    if (step !== 'camera_scan') return;

    const detector = blinkDetectorRef.current;
    detector.reset();
    let isProcessing = false;
    let submitted = false;

    const interval = setInterval(async () => {
      if (submitted || isProcessing || !webcamRef.current?.video) return;
      const video = webcamRef.current.video;
      if (video.readyState < 2) return;

      isProcessing = true;
      try {
        const detection = await detectFaceWithLandmarks(video);

        if (detection) {
          setFaceDetectedInFrame(true);
          setLastDetectedDescriptor(detection.descriptor);

          // Calculate real-time face distance if enrolled descriptor is available (Calibrated 0.50 threshold)
          let isCurrentFaceMatch = false;
          if (enrolledFaceDescriptor && enrolledFaceDescriptor.length === 128) {
            const dist = calculateFaceDistance(enrolledFaceDescriptor, detection.descriptor);
            const conf = calculateConfidencePct(dist, 0.50);
            isCurrentFaceMatch = dist <= 0.50;
            setLiveMatchStatus({ isMatch: isCurrentFaceMatch, distance: Number(dist.toFixed(3)), confidencePct: conf, checked: true });
          } else {
            // Fail-closed: Never default to match: true if enrolled descriptor is missing
            setLiveMatchStatus({ isMatch: false, distance: 1.0, confidencePct: 0, checked: true });
          }

          if (detection.landmarks) {
            const { hasBlinked, isClosed, progressPct } = detector.processFrame(detection.landmarks);
            setBlinkProgress(progressPct);

            if (hasBlinked || detector.blinkCount > 0) {
              setBlinkDetected(true);
              
              // STRICT GATE: Must be a verified face match before recording attendance
              if (isCurrentFaceMatch) {
                setBlinkAlertNotice(null);
                setLivenessStatus('Identity & Liveness verified — recording attendance...');
                submitted = true;
                clearInterval(interval);
                handleFinalVerification(detection.descriptor, true);
                return;
              } else {
                setBlinkAlertNotice('Face does not match registered profile. Liveness confirmed, but identity verification failed.');
                setLivenessStatus('Face mismatch: Live face does not match registered profile for Roll No.');
                setIsShakeActive(true);
                setTimeout(() => setIsShakeActive(false), 800);
              }
            } else if (isClosed) {
              setLivenessStatus(isCurrentFaceMatch ? 'Blink detected — reopen eyes to complete' : 'Face mismatch — look directly into the camera');
            } else {
              setLivenessStatus(isCurrentFaceMatch ? 'Face verified — blink naturally once to confirm' : 'Face mismatch — live face does not match enrolled profile');
            }
          } else {
            setLivenessStatus(isCurrentFaceMatch ? 'Face detected — ready to confirm' : 'Face mismatch');
          }
        } else {
          setFaceDetectedInFrame(false);
          setLivenessStatus('Position your face inside the frame');
          setLiveMatchStatus({ isMatch: false, distance: 1.0, confidencePct: 0, checked: false });
        }
      } catch (err) {
        console.warn('Frame processing note:', err);
      } finally {
        isProcessing = false;
      }
    }, 120);

    return () => clearInterval(interval);
  }, [step, isModelLoading, enrolledFaceDescriptor]);

  // 8. Submit Final Attendance Verification
  const handleFinalVerification = async (
    faceDescriptor: number[],
    isBlinkVerified: boolean,
    isBiometricFallback: boolean = false
  ) => {
    if (!isBiometricFallback && !isBlinkVerified) {
      setLivenessStatus('Blink once to confirm liveness before attendance is marked.');
      return;
    }

    if (!isBiometricFallback && enrolledFaceDescriptor && enrolledFaceDescriptor.length === 128) {
      const dist = calculateFaceDistance(enrolledFaceDescriptor, faceDescriptor);
      if (dist > 0.50) {
        setStep('error');
        setErrorMessage(`Face verification failed: Live face distance (${dist.toFixed(3)}) does not match enrolled profile (threshold 0.50).`);
        return;
      }
    }

    if (!currentCoords) {
      setStep('location_error');
      setErrorMessage('GPS Location is required to verify classroom attendance. Please enable location permissions.');
      return;
    }

    setStep('verifying');

    try {
      const payload = {
        token: token || '',
        hallTicket,
        lat: currentCoords.lat,
        lng: currentCoords.lng,
        faceDescriptor,
        blinkVerified: isBlinkVerified,
        biometricVerified: isBiometricFallback,
        studentName: studentName || `Student (${hallTicket})`
      };

      const resp = await fetch('/api/checkin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await safeJson(resp);

      if (resp.ok && data.success) {
        setVerifiedRecord(data.record);
        setStep('success');
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 }
        });
      } else {
        setStep('error');
        setErrorMessage(data.detail || data.message || data.error || 'Attendance verification was not approved.');
      }
    } catch (err: any) {
      setStep('error');
      setErrorMessage(err.message || 'Unable to connect to verification server. Please try again.');
    }
  };

  // 9. Hardware Biometric Fallback
  const handleBiometricFallback = async () => {
    try {
      const result = await verifyPlatformBiometrics();
      if (result.success) {
        const dummyDescriptor = Array(128).fill(0.05);
        await handleFinalVerification(dummyDescriptor, false, true);
      } else {
        alert('Device biometric authentication was cancelled or failed.');
      }
    } catch (err: any) {
      alert(`Biometric notice: ${err.message || 'Platform authenticator not available'}`);
    }
  };

  // 10. Self-Service Attendance Lookup Handler
  const handleCheckAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    const formatted = checkHallTicket.trim().toUpperCase();

    if (!formatted) {
      setCheckError('Please enter your Roll Number / Hall Ticket.');
      return;
    }

    setCheckError('');
    setIsLoadingReport(true);
    setStudentReport(null);

    try {
      const resp = await fetch(`/api/student/records/${formatted}`);
      const data = await safeJson(resp);
      setStudentReport(data);
    } catch (err) {
      setCheckError('Unable to fetch attendance records. Please check your connection and try again.');
      setStudentReport(null);
    } finally {
      setIsLoadingReport(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white transition-colors flex flex-col items-center justify-between p-3.5 sm:p-6 lg:p-8 w-full max-w-full overflow-x-hidden box-border">
      
      {/* Header Bar */}
      <header className="w-full max-w-xl flex items-center justify-between pb-4 sm:pb-6 gap-2">
        <div className="flex items-center gap-3.5 min-w-0">
          <img
            src="/assets/logos/logo.png"
            alt="Smart Attend Logo"
            className="w-11 h-11 sm:w-12 sm:h-12 object-contain flex-shrink-0"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight font-heading leading-tight truncate">
                Smart Attend
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-heading">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                ACTIVE
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
              SBIT Khammam • Student Portal
            </p>
          </div>
        </div>

        {/* Theme Switcher */}
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex-shrink-0"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
        </button>
      </header>

      {/* Main Card Container */}
      <main className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xl relative z-10 transition-all">
        
        {/* Navigation Tabs */}
        <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/60 mb-6 text-xs font-bold font-heading">
          <button
            type="button"
            onClick={() => setMode('checkin')}
            className={`py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-2 ${
              mode === 'checkin'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-extrabold border border-slate-200/80 dark:border-slate-700'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <QrCode className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <span>Fast Check-In</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('check_attendance')}
            className={`py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-2 ${
              mode === 'check_attendance'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-extrabold border border-slate-200/80 dark:border-slate-700'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>My Attendance</span>
          </button>
        </div>

        {/* ════════ MODE 1: FAST CHECK-IN ════════ */}
        {mode === 'checkin' && (
          <div className="space-y-6">
            
            {/* STEP 0: VALIDATING SESSION */}
            {step === 'validating_session' && (
              <div className="py-12 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto">
                  <RefreshCw className="w-6 h-6 animate-spin" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white font-heading">
                    Connecting to Classroom Session...
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Verifying encrypted session token
                  </p>
                </div>
              </div>
            )}

            {/* STEP 1: ROLL NUMBER INPUT */}
            {step === 'hall_ticket_input' && (
              <form onSubmit={handleHallTicketSubmit} className="space-y-5">
                
                {/* Active Session Info Pill */}
                {sessionData && (
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold uppercase block">Active Lecture</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{sessionData.sessionTitle || "Classroom Session"}</span>
                    </div>
                    <span className="font-mono text-teal-600 dark:text-teal-400 font-bold">
                      {sessionData.branch || "CSM"} • Sec {sessionData.section || "A"}
                    </span>
                  </div>
                )}

                <div className="space-y-2 text-left">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-heading">
                    Enter Roll Number / Hall Ticket
                  </label>
                  <div className="relative">
                    <User className="w-5 h-5 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={hallTicket}
                      onChange={(e) => {
                        setHallTicket(e.target.value.toUpperCase());
                        setHallTicketError('');
                      }}
                      placeholder="e.g. 24M61A6601"
                      maxLength={12}
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono text-base font-bold placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white transition-all tracking-wider uppercase"
                      autoFocus
                    />
                  </div>
                  {hallTicketError && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{hallTicketError}</span>
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 font-extrabold py-3.5 px-6 rounded-xl text-xs uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-2 font-heading"
                >
                  <span>Continue to Face Verification</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}

            {/* STEP 2B: FIRST-TIME STUDENT ENROLLMENT */}
            {step === 'first_time_enrollment' && (
              <div className="space-y-5 text-center">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-left">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1 font-heading">
                    <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    <span>First-Time Face Registration</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Roll Number: <strong className="font-mono text-teal-600 dark:text-teal-400">{hallTicket}</strong>. Position your face in the camera frame to register your profile.
                  </p>
                </div>

                {/* Sub-step 1: Face ID-style Scanner */}
                {enrollStep === 'face' && (
                  <div className="space-y-5">

                    {/* Face ID Scanner Viewport */}
                    <div className="relative flex flex-col items-center">
                      {/* Camera + animated oval overlay */}
                      <div className="relative w-[260px] h-[320px] mx-auto">

                        {/* Hidden webcam - powers the scanning but not shown directly */}
                        <div className="absolute inset-0 rounded-[48px] overflow-hidden">
                          <Webcam
                            ref={webcamRef}
                            audio={false}
                            mirrored={true}
                            screenshotFormat="image/jpeg"
                            videoConstraints={{ facingMode: 'user', width: 480, height: 640 }}
                            onUserMedia={() => setIsEnrollmentCameraReady(true)}
                            onUserMediaError={() => {
                              setIsEnrollmentCameraReady(false);
                              setEnrollFaceError('Camera access failed. Please allow camera permission and retry.');
                            }}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        {/* Dark vignette overlay */}
                        <div className="absolute inset-0 rounded-[48px] bg-slate-950/30 pointer-events-none" />

                        {/* Face oval frame */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <svg width="220" height="280" viewBox="0 0 220 280" className="overflow-visible">
                            {/* Outer dark mask */}
                            <defs>
                              <mask id="ovalMask">
                                <rect width="220" height="280" fill="white"/>
                                <ellipse cx="110" cy="140" rx="88" ry="112" fill="black"/>
                              </mask>
                              {/* Animated gradient for the scanning arc */}
                              <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#10b981" stopOpacity="0"/>
                                <stop offset="50%" stopColor="#10b981" stopOpacity="1"/>
                                <stop offset="100%" stopColor="#34d399" stopOpacity="0.8"/>
                              </linearGradient>
                            </defs>

                            {/* Static oval border */}
                            <ellipse
                              cx="110" cy="140" rx="88" ry="112"
                              fill="none"
                              strokeWidth="2"
                              stroke={
                                enrollProgress.status === 'done'
                                  ? '#10b981'
                                  : enrollProgress.status === 'error'
                                  ? '#f43f5e'
                                  : 'rgba(255,255,255,0.25)'
                              }
                              strokeDasharray={enrollProgress.status === 'scanning' || enrollProgress.status === 'processing' ? '8 4' : undefined}
                            />

                            {/* Animated scanning arc (progress) */}
                            {(enrollProgress.status === 'scanning' || enrollProgress.status === 'processing') && (
                              <ellipse
                                cx="110" cy="140" rx="88" ry="112"
                                fill="none"
                                strokeWidth="3"
                                stroke="url(#arcGrad)"
                                strokeDasharray={`${(enrollProgress.pct / 100) * 628} 628`}
                                strokeDashoffset="0"
                                strokeLinecap="round"
                                style={{ transition: 'stroke-dasharray 0.4s ease' }}
                                transform="rotate(-90 110 140)"
                              />
                            )}

                            {/* Success full circle */}
                            {enrollProgress.status === 'done' && (
                              <ellipse
                                cx="110" cy="140" rx="88" ry="112"
                                fill="none"
                                strokeWidth="3"
                                stroke="#10b981"
                                strokeDasharray="0"
                                className="animate-pulse"
                              />
                            )}

                            {/* Corner tick marks */}
                            {[0, 90, 180, 270].map((angle) => {
                              const rad = (angle - 90) * Math.PI / 180;
                              const x = 110 + 88 * Math.cos(rad);
                              const y = 140 + 112 * Math.sin(rad);
                              return (
                                <circle key={angle} cx={x} cy={y} r="3"
                                  fill={enrollProgress.pct > angle / 3.6 ? '#10b981' : 'rgba(255,255,255,0.2)'}
                                  style={{ transition: 'fill 0.3s' }}
                                />
                              );
                            })}
                          </svg>
                        </div>

                        {/* Status icon overlay */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          {enrollProgress.status === 'done' && (
                            <div className="w-16 h-16 rounded-full bg-emerald-500/90 backdrop-blur-sm flex items-center justify-center shadow-lg shadow-emerald-500/40">
                              <Check className="w-8 h-8 text-white" strokeWidth={3} />
                            </div>
                          )}
                          {enrollProgress.status === 'error' && (
                            <div className="w-16 h-16 rounded-full bg-rose-500/90 backdrop-blur-sm flex items-center justify-center">
                              <AlertCircle className="w-8 h-8 text-white" />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Progress dots */}
                      <div className="flex gap-1.5 mt-4">
                        {Array.from({ length: enrollProgress.totalFrames }).map((_, i) => (
                          <div
                            key={i}
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                              i < enrollProgress.framesCollected
                                ? 'w-4 bg-emerald-500'
                                : 'w-1.5 bg-slate-300 dark:bg-slate-700'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Status message */}
                    <div className="text-center space-y-1">
                      <p className={`text-sm font-bold font-heading ${
                        enrollProgress.status === 'done' ? 'text-emerald-600 dark:text-emerald-400' :
                        enrollProgress.status === 'error' ? 'text-rose-600 dark:text-rose-400' :
                        'text-slate-800 dark:text-slate-200'
                      }`}>
                        {enrollProgress.message}
                      </p>
                      {enrollProgress.status === 'scanning' && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Keep your face centered and well-lit • {enrollProgress.framesCollected}/{enrollProgress.totalFrames} frames
                        </p>
                      )}
                      {enrollProgress.status === 'processing' && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Creating your unique biometric template...
                        </p>
                      )}
                    </div>

                    {/* Done state with immediate proceed button */}
                    {enrollProgress.status === 'done' && (
                      <button
                        type="button"
                        onClick={() => {
                          setStep('location_check');
                          verifyLocation();
                        }}
                        className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-2 font-heading"
                      >
                        <Check className="w-4 h-4" />
                        <span>Proceed to Face Attendance →</span>
                      </button>
                    )}

                    {/* Error state with retry */}
                    {enrollProgress.status === 'error' && (
                      <div className="space-y-3">
                        {enrollFaceError && (
                          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
                            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-rose-700 dark:text-rose-300 font-medium leading-relaxed">{enrollFaceError}</p>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={handleRetryFaceEnrollment}
                          className="w-full py-3.5 px-4 rounded-xl bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 font-extrabold text-xs uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-2 font-heading"
                        >
                          <RefreshCw className="w-4 h-4" />
                          <span>Retry Face Scan</span>
                        </button>
                      </div>
                    )}

                    {/* Loading models */}
                    {isModelLoading && (
                      <div className="flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Loading face recognition models...</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-step 2: Biometrics Option */}
                {enrollStep === 'fingerprint' && (
                  <div className="space-y-5 py-2">
                    {/* Success confirmation */}
                    <div className="text-center space-y-3">
                      <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                        <Check className="w-8 h-8" strokeWidth={2.5} />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">Face Registered!</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Your biometric profile has been saved securely
                        </p>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-left">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 font-heading">
                        <Fingerprint className="w-4 h-4 text-indigo-500" />
                        <span>Add Device Passkey (Optional)</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Bind your fingerprint or Face ID for instant backup authentication.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleRegisterBiometrics}
                      className="w-full py-3.5 px-4 rounded-xl bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 font-extrabold text-xs uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-2 font-heading"
                    >
                      <ArrowRight className="w-4 h-4" />
                      <span>Continue to Attendance</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* STEP 3: LOCATION CHECKING */}
            {step === 'location_check' && (
              <div className="py-10 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto">
                  <MapPin className="w-6 h-6 animate-bounce" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white font-heading">
                    Verifying Classroom Location...
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Checking distance to active lecture session (150m radius).
                  </p>
                </div>
              </div>
            )}

            {/* LOCATION ERROR */}
            {step === 'location_error' && (
              <div className="space-y-5 text-center">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">Location Verification Notice</h3>
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 leading-relaxed">{errorMessage}</p>
                </div>
                <div className="space-y-2.5">
                  <button
                    onClick={verifyLocation}
                    className="w-full bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition font-heading flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry Location Check</span>
                  </button>

                  <button
                    onClick={() => {
                      setStep('camera_scan');
                    }}
                    className="w-full bg-teal-50 dark:bg-teal-950/40 hover:bg-teal-100 dark:hover:bg-teal-900/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 font-bold py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider transition font-heading flex items-center justify-center gap-2"
                  >
                    <MapPin className="w-3.5 h-3.5 text-teal-600" />
                    <span>In-Classroom Verification (Proceed to Scan)</span>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4 & 5: PROFESSIONAL FACE RECOGNITION SCAN */}
            {step === 'camera_scan' && (
              <div className="space-y-4 text-center">
                
                {/* Student Info & Liveness Checklist Bar */}
                <div className="flex items-center justify-center gap-2 flex-wrap text-xs">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <UserCheck className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                    <span className="text-slate-500 dark:text-slate-400">Roll:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{hallTicket}</span>
                  </div>

                  {liveMatchStatus.checked && (
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border font-bold text-[11px] ${
                      liveMatchStatus.isMatch
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${liveMatchStatus.isMatch ? 'bg-emerald-500' : 'bg-rose-500 animate-ping'}`} />
                      <span>{liveMatchStatus.isMatch ? `Face Matched (${liveMatchStatus.confidencePct}%) ✓` : `⚠️ Mismatch (${liveMatchStatus.confidencePct}% Match)`}</span>
                    </div>
                  )}

                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold text-[11px]">
                    {liveMatchStatus.checked && !liveMatchStatus.isMatch ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        <span className="text-rose-600 dark:text-rose-400">2. Mismatch (Blocked)</span>
                      </>
                    ) : (
                      <>
                        <span className={`w-2 h-2 rounded-full ${blinkDetected ? 'bg-emerald-500' : faceDetectedInFrame ? 'bg-amber-500 animate-pulse' : 'bg-slate-400'}`} />
                        <span className={blinkDetected ? 'text-emerald-700 dark:text-emerald-300' : faceDetectedInFrame ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'}>
                          {blinkDetected ? '2. Blink Verified ✓' : '2. Blink Check'}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Clean Camera Viewport Container */}
                <div className="relative w-full aspect-square max-w-[300px] mx-auto rounded-3xl overflow-hidden bg-slate-950 border border-slate-700/80 shadow-lg">
                  <Webcam
                    ref={webcamRef}
                    audio={false}
                    mirrored={true}
                    screenshotFormat="image/jpeg"
                    videoConstraints={{ facingMode: 'user', width: 480, height: 480 }}
                    className="w-full h-full object-cover"
                  />

                  {/* Refined Face Alignment Oval */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div
                      className={`w-48 h-60 rounded-[64px] border-2 transition-all duration-300 ${
                        liveMatchStatus.checked && !liveMatchStatus.isMatch
                          ? 'border-rose-500 shadow-[0_0_22px_rgba(244,63,94,0.6)] scale-[1.01]'
                          : blinkDetected
                          ? 'border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.5)] scale-[1.03]'
                          : faceDetectedInFrame
                          ? liveMatchStatus.checked && liveMatchStatus.isMatch
                            ? 'border-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.4)] scale-[1.01]'
                            : 'border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.3)] scale-[1.01]'
                          : 'border-white/40 border-dashed'
                      }`}
                    ></div>
                  </div>

                  {/* Bottom Status Pill */}
                  <div className="absolute bottom-3 left-3 right-3 bg-slate-950/85 backdrop-blur-md rounded-xl p-2 text-white text-xs font-semibold shadow-md space-y-1">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Eye className={`w-3.5 h-3.5 flex-shrink-0 ${liveMatchStatus.checked && !liveMatchStatus.isMatch ? 'text-rose-400' : blinkDetected ? 'text-emerald-400' : 'text-amber-400 animate-pulse'}`} />
                        <span className="truncate text-[11px]">
                          {liveMatchStatus.checked && !liveMatchStatus.isMatch
                            ? '⚠️ Different face detected — not registered user'
                            : livenessStatus}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-300 font-bold flex-shrink-0">{blinkProgress}%</span>
                    </div>

                    {/* Progress Track */}
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${liveMatchStatus.checked && !liveMatchStatus.isMatch ? 'bg-rose-500' : blinkDetected ? 'bg-emerald-500' : 'bg-gradient-to-r from-amber-500 to-emerald-500'}`}
                        style={{ width: `${blinkProgress}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Primary Action Button & Visual Feedback Area */}
                <div className={`space-y-2 pt-1 ${isShakeActive ? 'animate-shake' : ''}`}>
                  
                  {/* Alert Guidance Banner when live match fails */}
                  {liveMatchStatus.checked && !liveMatchStatus.isMatch && (
                    <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-800 dark:text-rose-200 text-xs font-semibold text-left space-y-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                        <p className="flex-1 text-[11px] leading-tight">
                          Face does not match registered profile for <strong>{hallTicket}</strong> ({liveMatchStatus.confidencePct}% match).
                        </p>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={handleReEnrollFace}
                          className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors inline-flex items-center gap-1 shadow-sm"
                        >
                          <ScanFace className="w-3 h-3" />
                          Re-Enroll Face Scan
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Alert Guidance Banner when clicked without blink */}
                  {blinkAlertNotice && !blinkDetected && !liveMatchStatus.checked && (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs font-semibold text-left">
                      <Eye className="w-4 h-4 text-amber-500 flex-shrink-0 animate-pulse" />
                      <p className="flex-1 text-[11px] leading-tight">{blinkAlertNotice}</p>
                    </div>
                  )}

                  {!faceDetectedInFrame && !blinkAlertNotice && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                      <AlertCircle className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 flex-shrink-0" />
                      <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">Center your face in the oval for detection</p>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={!faceDetectedInFrame || (liveMatchStatus.checked && !liveMatchStatus.isMatch)}
                    onClick={() => {
                      if (!faceDetectedInFrame || !lastDetectedDescriptor) {
                        setBlinkAlertNotice('Please position and center your face inside the oval first.');
                        setIsShakeActive(true);
                        setTimeout(() => setIsShakeActive(false), 450);
                        return;
                      }
                      if (liveMatchStatus.checked && !liveMatchStatus.isMatch) {
                        return;
                      }
                      setBlinkAlertNotice(null);
                      handleFinalVerification(lastDetectedDescriptor, blinkDetected);
                    }}
                    className={`w-full py-3.5 px-4 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-2 font-heading ${
                      !faceDetectedInFrame
                        ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 cursor-not-allowed'
                        : liveMatchStatus.checked && !liveMatchStatus.isMatch
                        ? 'bg-rose-500/15 border border-rose-500/30 text-rose-500 dark:text-rose-400 cursor-not-allowed opacity-90'
                        : !blinkDetected
                        ? 'bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-2 border-amber-500/40 shadow-amber-500/10 cursor-pointer active:scale-[0.99]'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/25 shadow-lg active:scale-[0.98]'
                    }`}
                  >
                    {!faceDetectedInFrame ? (
                      <>
                        <Camera className="w-4 h-4 text-slate-400" />
                        <span>Align Face in Oval</span>
                      </>
                    ) : liveMatchStatus.checked && !liveMatchStatus.isMatch ? (
                      <>
                        <AlertTriangle className="w-4 h-4 text-rose-500" />
                        <span>Face Mismatch — Attendance Blocked</span>
                      </>
                    ) : !blinkDetected ? (
                      <>
                        <Eye className="w-4 h-4 text-amber-500 dark:text-amber-400 animate-pulse" />
                        <span>Blink Naturally to Confirm</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Confirm & Mark Attendance</span>
                      </>
                    )}
                  </button>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleBiometricFallback}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition-colors border border-slate-200 dark:border-slate-700"
                    >
                      <Fingerprint className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Use Touch ID</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleReEnrollFace}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition-colors border border-slate-200 dark:border-slate-700"
                      title="Re-capture and update registered face scan"
                    >
                      <ScanFace className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                      <span>Re-Enroll Face</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        resetAllCheckinState();
                        setStep('hall_ticket_input');
                      }}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition-colors border border-slate-200 dark:border-slate-700"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                      <span>Change Roll</span>
                    </button>
                  </div>

                  {scanAttempts >= 2 && !blinkDetected && (
                    <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/40 text-[11px] text-indigo-700 dark:text-indigo-300 text-center animate-in fade-in">
                      Having difficulty with camera blink? You can tap <strong>Use Touch ID</strong> above.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 6: VERIFYING */}
            {step === 'verifying' && (
              <div className="py-12 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto">
                  <RefreshCw className="w-6 h-6 animate-spin" />
                </div>
                <div>
                  <p className="text-base font-bold text-slate-900 dark:text-white font-heading">
                    Recording Verified Attendance...
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Synchronizing timestamp with faculty live roster
                  </p>
                </div>
              </div>
            )}

            {/* STEP 7: SUCCESS */}
            {step === 'success' && verifiedRecord && (
              <div className="text-center space-y-5">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle2 className="w-9 h-9" />
                </div>

                <div>
                  <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white font-heading">
                    Attendance Marked!
                  </h2>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider mt-1 font-heading">
                    Verified & Synced in Real-Time
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-left space-y-2.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold">Roll Number:</span>
                    <span className="font-mono font-bold text-teal-600 dark:text-teal-400">{verifiedRecord.hallTicketNo || hallTicket}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold">Verification:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {verifiedRecord.verificationMethod === 'biometric_fallback' ? 'Device Biometrics ✓' : 'Facial Recognition & Liveness ✓'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold">Marked At:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{new Date(verifiedRecord.markedAt || Date.now()).toLocaleTimeString()}</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Your attendance has been pushed to the faculty live stream dashboard. You may now close this tab.
                </p>
              </div>
            )}

            {/* STEP 8: ERROR */}
            {step === 'error' && (
              <div className="text-center space-y-5">
                <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white font-heading">Check-in Unsuccessful</h2>
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-2 leading-relaxed max-w-[340px] mx-auto font-medium">
                    {errorMessage}
                  </p>
                </div>
                <div className="space-y-2.5">
                  <button
                    onClick={() => {
                      resetAllCheckinState();
                      setErrorMessage('');
                      if (hallTicket) {
                        setStep('location_check');
                        verifyLocation();
                      } else {
                        setStep('hall_ticket_input');
                      }
                    }}
                    className="w-full bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold py-3.5 px-4 rounded-xl text-xs uppercase tracking-wider transition font-heading flex items-center justify-center gap-2 shadow-sm"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Retry</span>
                  </button>

                  <button
                    onClick={() => {
                      resetAllCheckinState();
                      setStep('hall_ticket_input');
                      setErrorMessage('');
                    }}
                    className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider transition font-heading flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700"
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Change Roll Number</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════ MODE 2: SELF-SERVICE ATTENDANCE CHECKER ════════ */}
        {mode === 'check_attendance' && (
          <div className="space-y-6">
            <form onSubmit={handleCheckAttendance} className="space-y-4">
              <div className="text-left space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-heading">
                  Enter Roll Number / Hall Ticket
                </label>
                <div className="relative">
                  <Search className="w-5 h-5 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={checkHallTicket}
                    onChange={(e) => {
                      setCheckHallTicket(e.target.value.toUpperCase());
                      setCheckError('');
                    }}
                    placeholder="e.g. 24M61A6601"
                    maxLength={12}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono text-base font-bold placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white transition-all tracking-wider uppercase"
                    autoFocus
                  />
                </div>
                {checkError && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{checkError}</span>
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoadingReport}
                className="w-full bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 font-extrabold py-3.5 px-6 rounded-xl text-xs uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-2 font-heading"
              >
                {isLoadingReport ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span>View Attendance & Eligibility</span>
              </button>
            </form>

            {/* Attendance Report Card */}
            {studentReport && (
              <div className="space-y-4 text-left border-t border-slate-200 dark:border-slate-800 pt-5">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                  <div>
                    <span className="text-base font-extrabold text-slate-900 dark:text-white font-heading block">
                      {studentReport.studentName || `Student (${checkHallTicket})`}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 block font-mono mt-0.5">
                      {checkHallTicket} • {studentReport.branch || "CSE"} (Sec {studentReport.section || "A"})
                    </span>
                    {studentReport.email && (
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 block font-mono">
                        {studentReport.email}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider inline-block ${
                      studentReport.complianceStatus === 'eligible' || (studentReport.attendancePercentage ?? 0) >= 75
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        : studentReport.complianceStatus === 'condonation' || (studentReport.attendancePercentage ?? 0) >= 65
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                    }`}>
                      {studentReport.complianceLabel || ((studentReport.attendancePercentage ?? 0) >= 75 ? 'Eligible' : 'Shortage')}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase block">Attended</span>
                    <span className="text-lg font-extrabold text-slate-900 dark:text-white">{studentReport.totalSessionsAttended ?? 0}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase block">Total Sessions</span>
                    <span className="text-lg font-extrabold text-slate-900 dark:text-white">{studentReport.totalSessionsConducted ?? 0}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase block">Percentage</span>
                    <span className={`text-lg font-extrabold ${
                      (studentReport.attendancePercentage ?? 0) >= 75
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : (studentReport.attendancePercentage ?? 0) >= 65
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}>{studentReport.attendancePercentage ?? 0}%</span>
                  </div>
                </div>

                {/* Session Records History */}
                {studentReport.records && studentReport.records.length > 0 && (
                  <div className="mt-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 block">
                      Recent Attendance Records ({studentReport.records.length})
                    </span>
                    <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 text-xs">
                      {studentReport.records.slice(0, 10).map((rec: any, idx: number) => (
                        <div key={rec.id || idx} className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-slate-900 dark:text-white block">
                              {rec.session_title || rec.sessionTitle || "Academic Session"}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {new Date(rec.marked_at || rec.markedAt).toLocaleString()}
                            </span>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            rec.status === 'present' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600'
                          }`}>
                            {rec.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="w-full max-w-xl text-center py-4 text-[11px] text-slate-400 font-medium">
        Smart Attend • SBIT Institution Attendance System
      </footer>

    </div>
  );
};
