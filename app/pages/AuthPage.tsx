import { useState } from "react";
import { Panel } from "~/components/Panel";
import {
  useLogin,
  useSignup,
  useRequestPasswordReset,
  useConfirmPasswordReset,
  useConfirmEmailVerification,
} from "~/hooks/useSession";

export function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetToken, setResetToken] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("resetToken") ?? "";
  });
  const [verifyToken, setVerifyToken] = useState(() => {
    if (typeof window === "undefined") return "";
    return (
      new URLSearchParams(window.location.search).get("verifyToken") ?? ""
    );
  });
  const [nextPassword, setNextPassword] = useState("");
  const login = useLogin();
  const signup = useSignup();
  const requestPasswordReset = useRequestPasswordReset();
  const confirmPasswordReset = useConfirmPasswordReset();
  const confirmEmailVerification = useConfirmEmailVerification();

  const currentMutation = mode === "login" ? login : signup;

  const handleSubmit = () => {
    if (mode === "login") {
      login.mutate({ email, password });
      return;
    }
    signup.mutate({ email, password, name });
  };

  const handleRequestReset = () => {
    if (!resetEmail.trim()) return;
    requestPasswordReset.mutate(resetEmail.trim());
  };

  const handleConfirmReset = () => {
    if (!resetToken.trim() || !nextPassword.trim()) return;
    confirmPasswordReset.mutate(
      { token: resetToken.trim(), password: nextPassword },
      {
        onSuccess: () => {
          setResetToken("");
          setNextPassword("");
        },
      }
    );
  };

  const handleConfirmEmailVerification = () => {
    if (!verifyToken.trim()) return;
    confirmEmailVerification.mutate(verifyToken.trim(), {
      onSuccess: () => {
        setVerifyToken("");
      },
    });
  };

  const inputClass =
    "w-full rounded-lg border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60";

  return (
    <div className="mx-auto max-w-xl">
      <Panel
        title="Authentication"
        subtitle="Login or create an account to get started."
      >
        <div className="mb-4 flex gap-2">
          {(["login", "signup"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                mode === value
                  ? "bg-amber-400 text-slate-950"
                  : "bg-white/5 text-slate-300"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {mode === "signup" ? (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className={inputClass}
            />
          ) : null}
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className={inputClass}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className={inputClass}
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={currentMutation.isPending}
            className="w-full rounded-xl bg-amber-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50"
          >
            {mode === "login" ? "Log In" : "Create Account"}
          </button>
          {currentMutation.error ? (
            <p className="text-sm text-rose-300">
              {currentMutation.error.message}
            </p>
          ) : null}
        </div>
        <div className="mt-6 grid gap-4 border-t border-white/10 pt-5 lg:grid-cols-3">
          <div className="space-y-3">
            <div className="text-sm font-medium text-white">
              Request Password Reset
            </div>
            <input
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              placeholder="Email"
              className={inputClass}
            />
            <button
              type="button"
              onClick={handleRequestReset}
              disabled={requestPasswordReset.isPending}
              className="w-full rounded-xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50"
            >
              Send Reset Link
            </button>
            {requestPasswordReset.error ? (
              <p className="text-sm text-rose-300">
                {requestPasswordReset.error.message}
              </p>
            ) : requestPasswordReset.isSuccess ? (
              <p className="text-sm text-emerald-300">
                If the account exists, a reset email job was queued.
              </p>
            ) : null}
          </div>
          <div className="space-y-3">
            <div className="text-sm font-medium text-white">
              Confirm Password Reset
            </div>
            <input
              value={resetToken}
              onChange={(e) => setResetToken(e.target.value)}
              placeholder="Reset token"
              className={inputClass}
            />
            <input
              type="password"
              value={nextPassword}
              onChange={(e) => setNextPassword(e.target.value)}
              placeholder="New password"
              className={inputClass}
            />
            <button
              type="button"
              onClick={handleConfirmReset}
              disabled={confirmPasswordReset.isPending}
              className="w-full rounded-xl bg-fuchsia-300 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50"
            >
              Reset Password
            </button>
            {confirmPasswordReset.error ? (
              <p className="text-sm text-rose-300">
                {confirmPasswordReset.error.message}
              </p>
            ) : confirmPasswordReset.isSuccess ? (
              <p className="text-sm text-emerald-300">
                Password updated. Log in with the new password.
              </p>
            ) : null}
          </div>
          <div className="space-y-3">
            <div className="text-sm font-medium text-white">Confirm Email</div>
            <input
              value={verifyToken}
              onChange={(e) => setVerifyToken(e.target.value)}
              placeholder="Verification token"
              className={inputClass}
            />
            <button
              type="button"
              onClick={handleConfirmEmailVerification}
              disabled={confirmEmailVerification.isPending}
              className="w-full rounded-xl bg-emerald-300 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50"
            >
              Verify Email
            </button>
            {confirmEmailVerification.error ? (
              <p className="text-sm text-rose-300">
                {confirmEmailVerification.error.message}
              </p>
            ) : confirmEmailVerification.isSuccess ? (
              <p className="text-sm text-emerald-300">
                Email verified. You can continue with the current session.
              </p>
            ) : null}
          </div>
        </div>
      </Panel>
    </div>
  );
}
