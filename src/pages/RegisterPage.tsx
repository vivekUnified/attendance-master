/**
 * Guided registration workflow: password verification -> face capture ->
 * user details -> duplicate validation -> save user + initial attendance.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CameraView } from '../components/CameraView';
import { StatusBanner } from '../components/StatusBanner';
import { useCamera } from '../hooks/useCamera';
import { useFaceDetection } from '../hooks/useFaceDetection';
import { registrationService, DuplicateUserError, InvalidPasswordError } from '../services/registrationService';
import type { AttendanceRecord, User, UserType } from '../types';

type Step = 'password' | 'face' | 'details' | 'success';

export function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('password');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [faceEmbedding, setFaceEmbedding] = useState<number[] | null>(null);

  const [idCardNumber, setIdCardNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [userType, setUserType] = useState<UserType>('employee');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [result, setResult] = useState<{ user: User; attendance: AttendanceRecord } | null>(null);

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    const valid = await registrationService.verifyPassword(password);
    if (!valid) {
      setPasswordError('Incorrect password. Please try again.');
      return;
    }
    setStep('face');
  }

  async function handleSubmitDetails(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!faceEmbedding) {
      setFormError('A face sample is required.');
      return;
    }
    setSubmitting(true);
    try {
      const registration = await registrationService.register({
        password,
        idCardNumber,
        fullName,
        userType,
        faceEmbedding,
      });
      setResult(registration);
      setStep('success');
    } catch (err) {
      if (err instanceof DuplicateUserError) {
        setFormError(err.message);
      } else if (err instanceof InvalidPasswordError) {
        setFormError(err.message);
        setStep('password');
      } else {
        setFormError(err instanceof Error ? err.message : 'Registration failed.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Register Employee / Student</h1>
        <p className="text-sm text-slate-400">Follow the steps below to register a new user.</p>
      </div>

      <StepIndicator step={step} />

      {step === 'password' && (
        <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-3 rounded-2xl bg-slate-900 p-5">
          <label className="text-sm font-medium text-slate-200" htmlFor="reg-password">
            Registration password
          </label>
          <input
            id="reg-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none"
            placeholder="Enter password"
            autoFocus
          />
          <p className="text-xs text-slate-500">
            Development default is <code>123456</code>. Configurable in Settings.
          </p>
          {passwordError && <StatusBanner kind="error">{passwordError}</StatusBanner>}
          <button
            type="submit"
            className="rounded-lg bg-cyan-600 px-4 py-2 font-medium text-white hover:bg-cyan-500"
          >
            Continue
          </button>
        </form>
      )}

      {step === 'face' && (
        <FaceCaptureStep
          onCaptured={(embedding) => {
            setFaceEmbedding(embedding);
            setStep('details');
          }}
        />
      )}

      {step === 'details' && (
        <form onSubmit={handleSubmitDetails} className="flex flex-col gap-3 rounded-2xl bg-slate-900 p-5">
          <Field label="ID card number" htmlFor="id-card">
            <input
              id="id-card"
              value={idCardNumber}
              onChange={(e) => setIdCardNumber(e.target.value)}
              required
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none"
              placeholder="e.g. EMP-1024"
            />
          </Field>
          <Field label="Full name" htmlFor="full-name">
            <input
              id="full-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none"
              placeholder="e.g. Jane Doe"
            />
          </Field>
          <Field label="User type" htmlFor="user-type">
            <select
              id="user-type"
              value={userType}
              onChange={(e) => setUserType(e.target.value as UserType)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none"
            >
              <option value="employee">Employee</option>
              <option value="student">Student</option>
            </select>
          </Field>

          {formError && <StatusBanner kind="error">{formError}</StatusBanner>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep('face')}
              className="rounded-lg bg-slate-800 px-4 py-2 font-medium text-slate-200 hover:bg-slate-700"
            >
              Retake photo
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-cyan-600 px-4 py-2 font-medium text-white hover:bg-cyan-500 disabled:opacity-60"
            >
              {submitting ? 'Saving…' : 'Complete registration'}
            </button>
          </div>
        </form>
      )}

      {step === 'success' && result && (
        <div className="flex flex-col gap-3 rounded-2xl bg-slate-900 p-5">
          <StatusBanner kind="success">Registration successful!</StatusBanner>
          <dl className="grid grid-cols-2 gap-2 text-sm text-slate-200">
            <dt className="text-slate-400">ID card number</dt>
            <dd>{result.user.idCardNumber}</dd>
            <dt className="text-slate-400">Full name</dt>
            <dd>{result.user.fullName}</dd>
            <dt className="text-slate-400">Type</dt>
            <dd className="capitalize">{result.user.userType}</dd>
            <dt className="text-slate-400">Attendance status</dt>
            <dd className="capitalize">{result.attendance.status}</dd>
            <dt className="text-slate-400">Timestamp</dt>
            <dd>{new Date(result.attendance.timestamp).toLocaleString()}</dd>
          </dl>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="rounded-lg bg-cyan-600 px-4 py-2 font-medium text-white hover:bg-cyan-500"
            >
              Go to attendance
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('password');
                setPassword('');
                setIdCardNumber('');
                setFullName('');
                setFaceEmbedding(null);
                setResult(null);
              }}
              className="rounded-lg bg-slate-800 px-4 py-2 font-medium text-slate-200 hover:bg-slate-700"
            >
              Register another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function FaceCaptureStep({ onCaptured, disabled = false }: {
  onCaptured: (embedding: number[]) => void;
  disabled?: boolean;
}) {
  const camera = useCamera();
  const { result, samples, modelReady, modelError } = useFaceDetection(camera.videoRef, camera.ready);
  const [captureError, setCaptureError] = useState<string | null>(null);

  function handleCapture() {
    setCaptureError(null);
    if (!result) {
      setCaptureError('No frame available yet. Please wait a moment.');
      return;
    }
    if (result.quality === 'no-face') {
      setCaptureError('No face detected. Please look at the camera.');
      return;
    }
    if (result.quality === 'multiple-faces') {
      setCaptureError('Multiple faces detected. Only one person can be registered at a time.');
      return;
    }
    if (result.quality === 'low-quality') {
      setCaptureError('Move closer to the camera for a clearer capture.');
      return;
    }
    if (!result.embedding) {
      setCaptureError('Could not capture a usable face sample. Please try again.');
      return;
    }
    if (samples.length < 5) {
      setCaptureError('Hold still until five clear, consistent face samples are ready.');
      return;
    }
    const average = result.embedding.map((_, index) =>
      samples.reduce((sum, sample) => sum + sample[index], 0) / samples.length,
    );
    onCaptured(average);
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-slate-900 p-5">
      <CameraView camera={camera} detection={result} />
      {modelError && <StatusBanner kind="error">Face model failed to load: {modelError}</StatusBanner>}
      {!modelReady && !modelError && <StatusBanner kind="info">Loading face recognition model…</StatusBanner>}
      <p className="text-sm text-slate-300">
        Keep your whole face visible and look straight at the camera. Stable samples: {samples.length}/5.
      </p>
      {captureError && <StatusBanner kind="error">{captureError}</StatusBanner>}
      <button
        type="button"
        onClick={handleCapture}
        disabled={disabled || !modelReady || !camera.ready || !!modelError || samples.length < 5}
        className="rounded-lg bg-cyan-600 px-4 py-2 font-medium text-white hover:bg-cyan-500 disabled:opacity-60"
      >
        Capture face
      </button>
    </div>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'password', label: 'Password' },
    { key: 'face', label: 'Face capture' },
    { key: 'details', label: 'Details' },
    { key: 'success', label: 'Done' },
  ];
  const activeIndex = steps.findIndex((s) => s.key === step);

  return (
    <ol className="flex gap-2 text-xs font-medium text-slate-400">
      {steps.map((s, i) => (
        <li
          key={s.key}
          className={`flex-1 rounded-full px-2 py-1 text-center ${
            i <= activeIndex ? 'bg-cyan-600/30 text-cyan-200' : 'bg-slate-800'
          }`}
        >
          {s.label}
        </li>
      ))}
    </ol>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium text-slate-200">
        {label}
      </label>
      {children}
    </div>
  );
}
