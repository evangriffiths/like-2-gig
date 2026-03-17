import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Spinner } from "../components/Spinner";
import type { NotificationRule } from "../types";

const RADIUS_OPTIONS = [25, 50, 100, 200];

interface GeoResult {
  lat: number;
  lng: number;
  displayName: string;
}

function NotificationCard({
  rule,
  onDelete,
}: {
  rule: NotificationRule;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="rounded-lg bg-gray-900 p-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-medium text-white">{rule.label}</h3>
          <p className="mt-1 text-sm text-gray-400">
            {rule.locationName} — {rule.radiusKm} km
          </p>
          {(rule.dateFrom || rule.dateTo) && (
            <p className="text-sm text-gray-500">
              {rule.dateFrom && `From ${rule.dateFrom}`}
              {rule.dateFrom && rule.dateTo && " — "}
              {rule.dateTo && `To ${rule.dateTo}`}
            </p>
          )}
        </div>
        <button
          onClick={() => onDelete(rule.id)}
          className="text-gray-600 hover:text-red-400"
          title="Delete"
        >
          x
        </button>
      </div>
      <div className="mt-3 border-t border-gray-800 pt-2">
        {rule.lastSentAt ? (
          <p className="text-xs text-gray-500">
            Last notified: {new Date(rule.lastSentAt).toLocaleString()} — {rule.lastGigCount} gig
            {rule.lastGigCount !== 1 && "s"}
          </p>
        ) : (
          <p className="text-xs text-gray-600">No notifications sent yet</p>
        )}
      </div>
    </div>
  );
}

function AddNotificationForm({
  onSave,
  onCancel,
}: {
  onSave: (rule: {
    label: string;
    latitude: number;
    longitude: number;
    locationName: string;
    radiusKm: number;
    dateFrom?: string;
    dateTo?: string;
  }) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeoResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selected, setSelected] = useState<GeoResult | null>(null);
  const [radius, setRadius] = useState(50);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [label, setLabel] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const skipFetchRef = useRef(false);

  // Debounced geocode
  useEffect(() => {
    if (skipFetchRef.current) {
      skipFetchRef.current = false;
      return;
    }
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(query.trim())}`);
        if (!res.ok) return;
        const data = await res.json();
        setSuggestions(data.results);
        setShowSuggestions(true);
      } catch {}
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectSuggestion = (result: GeoResult) => {
    skipFetchRef.current = true;
    setQuery(result.displayName);
    setSelected(result);
    setShowSuggestions(false);
    setSuggestions([]);
    if (!label) setLabel(result.displayName.split(",")[0]);
  };

  const handleSave = () => {
    if (!selected || !label.trim()) return;
    onSave({
      label: label.trim(),
      latitude: selected.lat,
      longitude: selected.lng,
      locationName: selected.displayName,
      radiusKm: radius,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    });
  };

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900 p-4 space-y-3">
      <div>
        <label className="mb-1 block text-xs text-gray-500">Label</label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Glasgow gigs"
          className="w-full rounded bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-gray-600"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-gray-500">Location</label>
        <div className="flex gap-2">
          <div className="relative flex-1" ref={wrapperRef}>
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelected(null);
              }}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="Search location"
              className="w-full rounded bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-gray-600"
            />
            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full rounded bg-gray-800 shadow-lg">
                {suggestions.map((s, i) => (
                  <li
                    key={i}
                    onClick={() => selectSuggestion(s)}
                    className="cursor-pointer px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                  >
                    {s.displayName}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <select
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="rounded bg-gray-800 px-2 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-gray-600"
          >
            {RADIUS_OPTIONS.map((r) => (
              <option key={r} value={r}>{r} km</option>
            ))}
          </select>
        </div>
        {selected && (
          <p className="mt-1 text-xs text-green-500">Selected: {selected.displayName}</p>
        )}
      </div>

      <div className="flex gap-3">
        <div>
          <label className="mb-1 block text-xs text-gray-500">From date (optional)</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded bg-gray-800 px-2 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-gray-600"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">To date (optional)</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded bg-gray-800 px-2 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-gray-600"
          />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={!selected || !label.trim()}
          className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="rounded bg-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-600"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.status === 401) { navigate("/", { replace: true }); return; }
      if (!res.ok) return;
      const data = await res.json();
      setRules(data.rules);
    } catch {} finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const handleSave = async (rule: {
    label: string; latitude: number; longitude: number;
    locationName: string; radiusKm: number; dateFrom?: string; dateTo?: string;
  }) => {
    const res = await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rule),
    });
    if (res.ok) {
      const data = await res.json();
      setRules(data.rules);
      setShowForm(false);
    }
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/notifications/${id}`, { method: "DELETE" });
    if (res.ok) {
      const data = await res.json();
      setRules(data.rules);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white">Notifications</h1>
          {rules.length > 0 && !showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-500"
            >
              + Add
            </button>
          )}
        </div>

        {loading && <Spinner />}

        {showForm && (
          <div className="mb-6">
            <AddNotificationForm
              onSave={handleSave}
              onCancel={() => setShowForm(false)}
            />
          </div>
        )}

        {!loading && rules.length === 0 && !showForm && (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="mb-4 text-gray-400">
              Get emailed when new gigs appear near you
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="rounded-lg bg-green-600 px-6 py-3 font-medium text-white hover:bg-green-500"
            >
              Add a notification
            </button>
          </div>
        )}

        {rules.length > 0 && (
          <div className="space-y-3">
            {rules.map((rule) => (
              <NotificationCard key={rule.id} rule={rule} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
