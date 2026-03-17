import { NavLink } from "react-router-dom";
import { useSyncContext } from "../contexts/SyncContext";

const tabs = [
  { to: "/artists", label: "Artists" },
  { to: "/gigs", label: "Gigs" },
  { to: "/notifications", label: "Notifications" },
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
    statusText = `Syncing gigs (${syncJob.gigsSynced}/${syncJob.gigsTotal})`;
    dotColor = "bg-blue-500 animate-pulse";
  } else if (syncJob.status === "completed") {
    const date = syncJob.completedAt ? new Date(syncJob.completedAt).toLocaleString() : "";
    statusText = `Synced ${date}`;
    dotColor = "bg-green-500";
  } else {
    statusText = "Sync failed";
    dotColor = "bg-amber-500";
  }

  return (
    <div className="flex items-center gap-2">
      <span className={`inline-block h-2 w-2 rounded-full ${dotColor}`} />
      <span className="text-xs text-gray-400">{statusText}</span>
      <button
        onClick={startSync}
        disabled={isActive}
        className="rounded bg-gray-800 px-2.5 py-1 text-xs font-medium text-gray-300 hover:bg-gray-700 hover:text-white disabled:opacity-50"
      >
        {isActive ? "Syncing" : "Sync"}
      </button>
    </div>
  );
}

export function Header() {
  return (
    <header className="border-b border-gray-800 bg-gray-950">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <span className="text-lg font-bold text-white">Like2Gig</span>
          <nav className="flex gap-4">
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
        </div>
        <SyncIndicator />
      </div>
    </header>
  );
}
