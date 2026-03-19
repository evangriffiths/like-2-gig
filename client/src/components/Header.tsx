import { NavLink } from "react-router-dom";
import { useSyncContext } from "../contexts/SyncContext";

const tabs = [
  { to: "/artists", label: "Artists" },
  { to: "/gigs", label: "Gigs" },
  { to: "/notifications", label: "Alerts" },
];

function SyncIndicator() {
  const { syncJob, isActive, startSync } = useSyncContext();

  let statusText: string;
  let dotColor: string;

  if (!syncJob || syncJob.status === "idle") {
    statusText = "Never synced";
    dotColor = "bg-gray-500";
  } else if (syncJob.status === "syncing_artists") {
    statusText = "Syncing artists";
    dotColor = "bg-blue-500 animate-pulse";
  } else if (syncJob.status === "syncing_gigs") {
    statusText = `Gigs (${syncJob.gigsSynced}/${syncJob.gigsTotal})`;
    dotColor = "bg-blue-500 animate-pulse";
  } else if (syncJob.status === "completed") {
    const date = syncJob.completedAt ? new Date(syncJob.completedAt).toLocaleDateString() : "";
    statusText = date;
    dotColor = "bg-green-500";
  } else {
    statusText = "Failed";
    dotColor = "bg-amber-500";
  }

  const needsApproval = syncJob?.status === "failed" &&
    syncJob.errorMessage?.includes("not registered for this application");

  return (
    <div className="flex items-center gap-1.5">
      <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${dotColor}`} />
      <span className="text-xs text-gray-400">{statusText}</span>
      {needsApproval && (
        <span className="text-xs text-amber-400">Ask owner to add you</span>
      )}
      <button
        onClick={startSync}
        disabled={isActive}
        className="shrink-0 rounded bg-gray-800 px-2 py-0.5 text-xs font-medium text-gray-300 hover:bg-gray-700 hover:text-white disabled:opacity-50"
      >
        {isActive ? "..." : "Sync"}
      </button>
    </div>
  );
}

export function Header() {
  return (
    <header className="border-b border-gray-800 bg-gray-950">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-2">
        <nav className="flex items-center gap-3">
          <NavLink to="/artists" className="text-sm font-bold text-white">L2G</NavLink>
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `text-sm font-medium ${isActive ? "text-green-400" : "text-gray-400 hover:text-white"}`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
        <SyncIndicator />
      </div>
    </header>
  );
}
