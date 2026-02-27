interface SpotifyLinkProps {
  type: "artist" | "track";
  id: string;
}

export function SpotifyLink({ type, id }: SpotifyLinkProps) {
  return (
    <a
      href={`https://open.spotify.com/${type}/${id}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="shrink-0 rounded p-1 text-gray-600 transition hover:text-green-500"
      title={`Open in Spotify`}
    >
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3.5 w-3.5"
      >
        <path d="M6 3.5H3.5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V10" />
        <path d="M9.5 2.5h4v4" />
        <path d="M13.5 2.5 7.5 8.5" />
      </svg>
    </a>
  );
}
