import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export function LoginPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch("/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated) navigate("/artists", { replace: true });
        else setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [navigate]);

  if (checking) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950">
      <div className="text-center">
        <h1 className="mb-2 text-4xl font-bold text-white">Like2Gig</h1>
        <p className="mb-8 text-gray-400">
          Find gigs for artists in your Liked Songs
        </p>
        <a
          href="/auth/login"
          className="rounded-full bg-green-500 px-8 py-3 font-semibold text-black transition hover:bg-green-400"
        >
          Connect with Spotify
        </a>
      </div>
    </div>
  );
}
