/**
 * Home screen: live camera preview, real-time face detection, identity
 * matching against registered users, and attendance marking with clear
 * status feedback for every outcome (identified, unknown, duplicate,
 * multiple faces, low quality).
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CameraView } from '../components/CameraView';
import { StatusBanner } from '../components/StatusBanner';
import { useCamera } from '../hooks/useCamera';
import { useFaceDetection } from '../hooks/useFaceDetection';
import { faceMatchService } from '../services/faceMatchService';
import { attendanceService } from '../services/attendanceService';
import type { User } from '../types';

type ScanState =
  | { kind: 'idle' }
  | { kind: 'no-face' }
  | { kind: 'multiple-faces' }
  | { kind: 'low-quality' }
  | { kind: 'matching' }
  | { kind: 'unknown' }
  | { kind: 'marked'; user: User; similarity: number }
  | { kind: 'duplicate'; user: User }
  | { kind: 'error'; message: string };

const MATCH_INTERVAL_MS = 650;
const COOLDOWN_MS = 6000;

export function HomePage() {
  const camera = useCamera();
  const { result, modelReady, modelError } = useFaceDetection(camera.videoRef, camera.ready);
  const [state, setState] = useState<ScanState>({ kind: 'idle' });
  const lastMatchAt = useRef(0);
  const cooldownUntil = useRef(0);
  const matchingRef = useRef(false);

  useEffect(() => {
    if (!result) return;
    const now = performance.now();

    if (now < cooldownUntil.current) return;

    if (result.quality === 'no-face') {
      setState({ kind: 'no-face' });
      return;
    }
    if (result.quality === 'multiple-faces') {
      setState({ kind: 'multiple-faces' });
      return;
    }
    if (result.quality === 'low-quality') {
      setState({ kind: 'low-quality' });
      return;
    }
    if (!result.embedding) return;
    if (matchingRef.current || now - lastMatchAt.current < MATCH_INTERVAL_MS) return;

    lastMatchAt.current = now;
    matchingRef.current = true;
    setState({ kind: 'matching' });

    faceMatchService
      .identify(result.embedding)
      .then(async (match) => {
        if (!match.user) {
          setState({ kind: 'unknown' });
          return;
        }
        const { record, duplicate } = await attendanceService.markAttendance({
          user: match.user,
          source: 'face-recognition',
          confidence: match.similarity,
        });
        cooldownUntil.current = performance.now() + COOLDOWN_MS;
        if (duplicate) {
          setState({ kind: 'duplicate', user: match.user });
        } else {
          setState({ kind: 'marked', user: match.user, similarity: match.similarity });
        }
        void record;
      })
      .catch((err) => {
        setState({ kind: 'error', message: err instanceof Error ? err.message : 'Recognition failed' });
      })
      .finally(() => {
        matchingRef.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Live Attendance</h1>
        <p className="text-sm text-slate-400">
          Look at the camera to be recognized and have your attendance marked automatically.
        </p>
      </div>

      <CameraView camera={camera} detection={result} />

      {modelError && <StatusBanner kind="error">Face model failed to load: {modelError}</StatusBanner>}
      {!modelReady && !modelError && <StatusBanner kind="info">Loading face recognition model…</StatusBanner>}

      {modelReady && <ScanStatus state={state} />}

      <div className="flex gap-3 text-sm">
        <Link to="/register" className="rounded-lg bg-slate-800 px-4 py-2 font-medium text-slate-100 hover:bg-slate-700">
          Register a new user
        </Link>
        <Link to="/history" className="rounded-lg bg-slate-800 px-4 py-2 font-medium text-slate-100 hover:bg-slate-700">
          View history
        </Link>
      </div>
    </div>
  );
}

function ScanStatus({ state }: { state: ScanState }) {
  switch (state.kind) {
    case 'idle':
      return <StatusBanner kind="info">Position your face in the camera frame.</StatusBanner>;
    case 'no-face':
      return <StatusBanner kind="info">No face detected. Please look at the camera.</StatusBanner>;
    case 'multiple-faces':
      return <StatusBanner kind="warning">Multiple faces detected. Only one person at a time, please.</StatusBanner>;
    case 'low-quality':
      return <StatusBanner kind="warning">Move a little closer so your face is clearly visible.</StatusBanner>;
    case 'matching':
      return <StatusBanner kind="info">Identifying…</StatusBanner>;
    case 'unknown':
      return (
        <StatusBanner kind="warning">
          Face not recognized. If you are not registered yet, please register first.
        </StatusBanner>
      );
    case 'marked':
      return (
        <StatusBanner kind="success">
          ✅ Welcome, {state.user.fullName} ({state.user.idCardNumber}). Attendance marked just now.{' '}
          <span className="text-xs opacity-75">match {Math.round(state.similarity * 100)}%</span>
        </StatusBanner>
      );
    case 'duplicate':
      return (
        <StatusBanner kind="warning">
          {state.user.fullName} has already been marked present today. Duplicate entry ignored.
        </StatusBanner>
      );
    case 'error':
      return <StatusBanner kind="error">{state.message}</StatusBanner>;
    default:
      return null;
  }
}
