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

type LoginMode = "password" | "voice";

export default function LoginPage() {
  const router = useRouter();
  const { show } = useToast();
  const transport = useMemo(() => createTransport(), []);
  const client = useMemo(() => createGrpcClient(AudioModelService as any, transport) as any, [transport]);

  const [loginMode, setLoginMode] = useState<LoginMode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [voiceVerificationResult, setVoiceVerificationResult] = useState<{
    verified: boolean;
    percentage: number;
  } | null>(null);

  // Extract username from email
  const getUsername = useCallback((emailOrUsername: string) => {
    return emailOrUsername.includes("@") ? emailOrUsername.split("@")[0] : emailOrUsername;
  }, []);

  // Handle password login
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    const newErrors: { email?: string; password?: string } = {};
    if (!email) newErrors.email = "Email is required";
    if (!password) newErrors.password = "Password is required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setIsLoading(false);
      return;
    }

    try {
      const username = getUsername(email);
      const res = await client.loginUser({ username, password } as any);
      if (res?.success) {
        if (typeof window !== "undefined") {
          try { localStorage.setItem("voicing_token", res.token ?? ""); } catch { }
        }
        show({ type: "success", title: "Signed in", message: res.message || "Welcome back!" });
        router.push("/dashboard");
      } else {
        show({ type: "error", title: "Sign in failed", message: res?.message || "Invalid credentials" });
      }
    } catch (err: any) {
      show({ type: "error", title: "Network error", message: err?.message ?? "Request failed" });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle voice verification
  const handleVoiceRecorded = useCallback(async (samples: Float32Array, sampleRate: number) => {
    if (!email.trim()) {
      show({ type: "error", title: "Username required", message: "Please enter your username or email first" });
      return;
    }

    setIsLoading(true);
    setVoiceVerificationResult(null);

    try {
      const username = getUsername(email);

      // Call verifyUser with audio samples
      const res = await client.verifyUser({
        userId: username,
        audioSamples: Array.from(samples),
        sampleRate: sampleRate,
      } as any);

      if (res?.success && res?.verified) {
        setVoiceVerificationResult({
          verified: true,
          percentage: res.percentage || 0,
        });

        show({
          type: "success",
          title: "Voice verified!",
          message: `Match: ${Math.round(res.percentage || 0)}%`
        });

        // Complete login after successful voice verification
        // The backend should issue a token for voice-verified users
        // For now, we'll use a simplified flow - you may need to adjust based on your backend
        const loginRes = await client.loginUser({
          username,
          password: `voice_verified_${Date.now()}` // Placeholder - adjust based on your auth flow
        } as any);

        if (loginRes?.token) {
          if (typeof window !== "undefined") {
            try { localStorage.setItem("voicing_token", loginRes.token ?? ""); } catch { }
          }
          router.push("/dashboard");
        } else {
          // Voice verified but no token - this might be expected depending on your flow
          show({ type: "info", title: "Voice verified", message: "Your voice was verified successfully!" });
        }
      } else {
        setVoiceVerificationResult({
          verified: false,
          percentage: res?.percentage || 0,
        });

        show({
          type: "error",
          title: "Voice not verified",
          message: res?.errorMessage || `Match: ${Math.round(res?.percentage || 0)}%. Please try again or use password.`
        });
      }
    } catch (err: any) {
      const errorMessage = err?.message ?? "Verification failed";
      if (errorMessage.includes("not found") || errorMessage.includes("no embeddings")) {
        show({
          type: "warning",
          title: "Voice not enrolled",
          message: "You haven't set up voice login yet. Please use password login or enroll your voice."
        });
      } else {
        show({ type: "error", title: "Verification error", message: errorMessage });
      }
    } finally {
      setIsLoading(false);
    }
  }, [email, client, getUsername, show, router]);

  // Handle voice recording error
  const handleVoiceError = useCallback((error: string) => {
    show({ type: "error", title: "Recording error", message: error });
  }, [show]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-0 via-neutral-50 to-brand-50/30 flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-mesh opacity-5" />

      <div className="relative w-full max-w-md mx-auto p-6">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-3 group mb-6">
            <span className="text-2xl font-semibold text-neutral-800">Voicing</span>
          </Link>
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">Welcome back</h1>
          <p className="text-neutral-600">Sign in to your account to continue</p>
        </div>

        <div className="glass rounded-2xl p-8 border border-neutral-200/60">
          {/* Login Mode Toggle */}
          <div className="flex rounded-xl bg-neutral-100 p-1 mb-6">
            <button
              type="button"
              onClick={() => setLoginMode("password")}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${loginMode === "password"
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-600 hover:text-neutral-900"
                }`}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => setLoginMode("voice")}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ${loginMode === "voice"
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-600 hover:text-neutral-900"
                }`}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
              Voice Login
            </button>
          </div>

          {/* Password Login Form */}
          {loginMode === "password" && (
            <form onSubmit={handlePasswordSubmit} className="space-y-6">
              <Input
                label="Email or username"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                error={errors.email}
                variant="glass"
                autoComplete="username"
                required
                disabled={isLoading}
              />

              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                error={errors.password}
                variant="glass"
                autoComplete="current-password"
                required
                disabled={isLoading}
              />

              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-brand-500 border-neutral-300 rounded focus:ring-brand-500/20 focus:ring-2"
                  />
                  <span className="text-sm text-neutral-600">Remember me</span>
                </label>
                <Link href="/forgot-password" className="text-sm text-brand-600 hover:text-brand-700 transition-colors">
                  Forgot password?
                </Link>
              </div>

              <Button
                variant="glass"
                type="submit"
                fullWidth
                size="lg"
                loading={isLoading}
                className="shadow-glow hover:shadow-glow-lg"
              >
                Sign In
              </Button>
            </form>
          )}

          {/* Voice Login Form */}
          {loginMode === "voice" && (
            <div className="space-y-6">
              <Input
                label="Email or username"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                error={errors.email}
                variant="glass"
                autoComplete="username"
                required
                disabled={isLoading}
              />

              <div className="py-4">
                <VoiceLoginRecorder
                  onRecorded={handleVoiceRecorded}
                  onError={handleVoiceError}
                  disabled={!email.trim() || isLoading}
                  maxDurationMs={5000}
                />
              </div>

              {/* Verification Result */}
              {voiceVerificationResult && (
                <div className={`rounded-xl p-4 ${voiceVerificationResult.verified
                    ? "bg-success-50 border border-success-200"
                    : "bg-error-50 border border-error-200"
                  }`}>
                  <div className="flex items-center gap-3">
                    {voiceVerificationResult.verified ? (
                      <svg className="w-5 h-5 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-error-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                    <div>
                      <p className={`text-sm font-medium ${voiceVerificationResult.verified ? "text-success-800" : "text-error-800"
                        }`}>
                        {voiceVerificationResult.verified ? "Voice verified!" : "Voice not matched"}
                      </p>
                      <p className={`text-xs ${voiceVerificationResult.verified ? "text-success-600" : "text-error-600"
                        }`}>
                        Match: {Math.round(voiceVerificationResult.percentage)}%
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <p className="text-xs text-center text-neutral-500">
                Hold the button and speak clearly for 2-5 seconds
              </p>
            </div>
          )}

          <div className="my-8 flex items-center">
            <div className="flex-1 border-t border-neutral-200" />
            <span className="px-4 text-sm text-neutral-500">or</span>
            <div className="flex-1 border-t border-neutral-200" />
          </div>

          <p className="mt-8 text-center text-sm text-neutral-600">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-medium text-brand-600 hover:text-brand-700 transition-colors">
              Sign up for free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
