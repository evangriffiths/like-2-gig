import { useState } from "react";
import { useNavigate } from "react-router-dom";

export function PasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/auth/site-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        navigate("/artists", { replace: true });
      } else {
        setError("Incorrect password");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950">
      <div className="text-center">
        <h1 className="mb-2 text-4xl font-bold text-white">Like2Gig</h1>
        <p className="mb-8 text-gray-400">Enter the site password to continue</p>
        <form onSubmit={handleSubmit} className="flex flex-col items-center gap-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            className="rounded bg-gray-800 px-4 py-2 text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-gray-600"
          />
          <button
            type="submit"
            disabled={submitting || !password}
            className="rounded-full bg-green-500 px-8 py-2 font-semibold text-black transition hover:bg-green-400 disabled:opacity-50"
          >
            {submitting ? "Checking" : "Continue"}
          </button>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </form>
      </div>
    </div>
  );
}
