"use client";

import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import Input from "@/components/Input";
import VoiceLoginRecorder from "@/components/VoiceLoginRecorder";
import { useToast } from "@/components/Toast";
import { createTransport } from "@/lib/grpc/transport";
import { createGrpcClient } from "@/lib/grpc/client";
import { AudioModelService } from "@/gen/org/example/voicingbackend/audiomodel/audiomodel_pb";

type RegistrationStep = "form" | "voice-enrollment" | "complete";

export default function RegisterPage() {
  const router = useRouter();
  const { show } = useToast();
  const transport = useMemo(() => createTransport(), []);
  const client = useMemo(() => createGrpcClient(AudioModelService as any, transport) as any, [transport]);

  const [step, setStep] = useState<RegistrationStep>("form");
  const [registeredUser, setRegisteredUser] = useState<{ userId: string; token: string } | null>(null);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    terms: false,
    newsletter: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [enrollmentStatus, setEnrollmentStatus] = useState<"idle" | "enrolling" | "success" | "error">("idle");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    const checked = type === "checkbox" ? (e.target as HTMLInputElement).checked : undefined;

    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    // Basic validation
    const newErrors: { [key: string]: string } = {};
    if (!formData.firstName) newErrors.firstName = "First name is required";
    if (!formData.lastName) newErrors.lastName = "Last name is required";
    if (!formData.email) newErrors.email = "Email is required";
    if (!formData.password) newErrors.password = "Password is required";
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = "Passwords don't match";
    if (!formData.terms) newErrors.terms = "You must accept the terms";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setIsLoading(false);
      return;
    }

    try {
      const username = formData.email.split("@")[0] || formData.firstName || "user";
      const req = {
        username,
        email: formData.email,
        password: formData.password,
        fullName: `${formData.firstName} ${formData.lastName}`.trim(),
      } as any;

      const res = await client.registerUser(req);
      if (res.success) {
        // Save user info for voice enrollment
        setRegisteredUser({
          userId: res.userId || username,
          token: res.token || "",
        });

        // Store token if provided
        if (res.token && typeof window !== "undefined") {
          try { localStorage.setItem("voicing_token", res.token); } catch { }
        }

        show({ type: "success", title: "Account created!", message: "Now let's set up your voice login." });
        setStep("voice-enrollment");
      } else {
        show({ type: "error", title: "Could not register", message: res.message || "Please try again." });
      }
    } catch (err: any) {
      show({ type: "error", title: "Network error", message: err?.message ?? "Request failed" });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle voice enrollment
  const handleVoiceEnrollment = useCallback(async (samples: Float32Array, sampleRate: number) => {
    if (!registeredUser) {
      show({ type: "error", title: "Error", message: "User information not found" });
      return;
    }

    setEnrollmentStatus("enrolling");

    try {
      const res = await client.enrolUserVoice({
        userId: registeredUser.userId,
        audioId: `enrollment_${Date.now()}`,
        audioSamples: Array.from(samples),
        sampleRate: sampleRate,
        storeFormat: 0, // WAV
      } as any);

      if (res?.success) {
        setEnrollmentStatus("success");
        show({
          type: "success",
          title: "Voice enrolled!",
          message: `Your voice has been saved. ${res.chunksStored || 0} voice segments recorded.`
        });
        setStep("complete");
      } else {
        setEnrollmentStatus("error");
        show({
          type: "error",
          title: "Enrollment failed",
          message: res?.errorMessage || "Could not save your voice. Please try again."
        });
      }
    } catch (err: any) {
      setEnrollmentStatus("error");
      show({ type: "error", title: "Enrollment error", message: err?.message ?? "Failed to enroll voice" });
    }
  }, [registeredUser, client, show]);

  // Handle voice recording error
  const handleVoiceError = useCallback((error: string) => {
    show({ type: "error", title: "Recording error", message: error });
    setEnrollmentStatus("error");
  }, [show]);

  // Skip voice enrollment
  const handleSkipEnrollment = () => {
    show({ type: "info", title: "Skipped", message: "You can set up voice login later in settings." });
    router.push("/dashboard");
  };

  // Go to dashboard
  const handleContinueToDashboard = () => {
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-0 via-neutral-50 to-brand-50/30 flex items-center justify-center relative overflow-hidden py-12">
      <div className="absolute inset-0 bg-mesh opacity-5" />

      <div className="relative w-full max-w-lg mx-auto p-6">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-3 group mb-6">
            <span className="text-2xl font-semibold text-neutral-800">Voicing</span>
          </Link>

          {step === "form" && (
            <>
              <h1 className="text-3xl font-bold text-neutral-900 mb-2">Create your account</h1>
              <p className="text-neutral-600">Start your free trial and transform your audio today</p>
            </>
          )}

          {step === "voice-enrollment" && (
            <>
              <h1 className="text-3xl font-bold text-neutral-900 mb-2">Set up Voice Login</h1>
              <p className="text-neutral-600">Record your voice to enable quick login</p>
            </>
          )}

          {step === "complete" && (
            <>
              <h1 className="text-3xl font-bold text-neutral-900 mb-2">You&apos;re all set!</h1>
              <p className="text-neutral-600">Your account is ready with voice login enabled</p>
            </>
          )}
        </div>

        {/* Progress indicator */}
        {step !== "form" && (
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="w-3 h-3 rounded-full bg-brand-500" />
            <div className={`w-12 h-0.5 ${step !== "form" ? "bg-brand-500" : "bg-neutral-200"}`} />
            <div className={`w-3 h-3 rounded-full ${step === "voice-enrollment" || step === "complete" ? "bg-brand-500" : "bg-neutral-200"}`} />
            <div className={`w-12 h-0.5 ${step === "complete" ? "bg-brand-500" : "bg-neutral-200"}`} />
            <div className={`w-3 h-3 rounded-full ${step === "complete" ? "bg-brand-500" : "bg-neutral-200"}`} />
          </div>
        )}

        <div className="glass rounded-2xl p-8 border border-neutral-200/60">
          {/* Step 1: Registration Form */}
          {step === "form" && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="First name"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="John"
                  autoComplete="given-name"
                  error={errors.firstName}
                  variant="glass"
                  required
                  disabled={isLoading}
                />
                <Input
                  label="Last name"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Doe"
                  autoComplete="family-name"
                  error={errors.lastName}
                  variant="glass"
                  required
                  disabled={isLoading}
                />
              </div>

              <Input
                label="Email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="john@example.com"
                autoComplete="email"
                error={errors.email}
                variant="glass"
                required
                disabled={isLoading}
              />

              <Input
                label="Password"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Create a strong password"
                autoComplete="new-password"
                error={errors.password}
                variant="glass"
                helper="Must be at least 8 characters with uppercase, lowercase, and number"
                required
                disabled={isLoading}
              />

              <Input
                label="Confirm password"
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm your password"
                autoComplete="new-password"
                error={errors.confirmPassword}
                variant="glass"
                required
                disabled={isLoading}
              />

              <div className="space-y-4">
                <label className="flex items-start space-x-3">
                  <input
                    type="checkbox"
                    name="terms"
                    checked={formData.terms}
                    onChange={handleChange}
                    className="mt-1 w-4 h-4 text-brand-500 border-neutral-300 rounded focus:ring-brand-500/20 focus:ring-2"
                    disabled={isLoading}
                  />
                  <span className="text-sm text-neutral-600">
                    I agree to the{" "}
                    <Link href="/terms" className="text-brand-600 hover:text-brand-700 underline transition-colors">
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link href="/privacy" className="text-brand-600 hover:text-brand-700 underline transition-colors">
                      Privacy Policy
                    </Link>
                    <span className="text-accent-500 ml-1">*</span>
                  </span>
                </label>
                {errors.terms && (
                  <p className="text-sm text-error-600 flex items-center gap-1">
                    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {errors.terms}
                  </p>
                )}

                <label className="flex items-start space-x-3">
                  <input
                    type="checkbox"
                    name="newsletter"
                    checked={formData.newsletter}
                    onChange={handleChange}
                    className="mt-1 w-4 h-4 text-brand-500 border-neutral-300 rounded focus:ring-brand-500/20 focus:ring-2"
                    disabled={isLoading}
                  />
                  <span className="text-sm text-neutral-600">
                    Send me product updates and tips to improve my audio content
                  </span>
                </label>
              </div>

              <Button
                variant="glass"
                type="submit"
                fullWidth
                size="lg"
                loading={isLoading}
                className="shadow-glow hover:shadow-glow-lg"
              >
                Create Account
              </Button>
            </form>
          )}

          {/* Step 2: Voice Enrollment */}
          {step === "voice-enrollment" && (
            <div className="space-y-8">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-brand-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-brand-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                  </svg>
                </div>
                <h2 className="text-lg font-medium text-neutral-900 mb-2">Record your voice</h2>
                <p className="text-sm text-neutral-600 mb-6">
                  Hold the button and speak naturally for 3-5 seconds. This will be used to verify your identity when you log in.
                </p>
              </div>

              <VoiceLoginRecorder
                onRecorded={handleVoiceEnrollment}
                onError={handleVoiceError}
                disabled={enrollmentStatus === "enrolling"}
                maxDurationMs={6000}
              />

              {enrollmentStatus === "enrolling" && (
                <div className="text-center">
                  <div className="animate-pulse text-brand-600 font-medium">
                    Processing your voice...
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={handleSkipEnrollment}
                  fullWidth
                  disabled={enrollmentStatus === "enrolling"}
                >
                  Skip for now
                </Button>
              </div>

              <p className="text-xs text-center text-neutral-500">
                You can always set up or update your voice login in account settings
              </p>
            </div>
          )}

          {/* Step 3: Complete */}
          {step === "complete" && (
            <div className="space-y-8 text-center">
              <div className="w-20 h-20 mx-auto rounded-full bg-success-100 flex items-center justify-center">
                <svg className="w-10 h-10 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-neutral-900 mb-2">Account ready!</h2>
                <p className="text-neutral-600">
                  Your account has been created and voice login is enabled. You can now sign in using your voice.
                </p>
              </div>

              <div className="bg-neutral-50 rounded-xl p-4 text-left">
                <h3 className="font-medium text-neutral-900 mb-2">What&apos;s next?</h3>
                <ul className="space-y-2 text-sm text-neutral-600">
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-success-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Use voice or password to sign in anytime
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-success-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Explore audio processing features
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-success-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Update voice enrollment in settings
                  </li>
                </ul>
              </div>

              <Button
                variant="glass"
                onClick={handleContinueToDashboard}
                fullWidth
                size="lg"
                className="shadow-glow hover:shadow-glow-lg"
              >
                Go to Dashboard
              </Button>
            </div>
          )}

          {step === "form" && (
            <>
              <div className="my-8 flex items-center">
                <div className="flex-1 border-t border-neutral-200" />
                <span className="px-4 text-sm text-neutral-500">or</span>
                <div className="flex-1 border-t border-neutral-200" />
              </div>

              <p className="mt-8 text-center text-sm text-neutral-600">
                Already have an account?{" "}
                <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700 transition-colors">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
