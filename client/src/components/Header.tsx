import { NavLink } from "react-router-dom";

const tabs = [
  { to: "/artists", label: "Artists" },
  { to: "/gigs", label: "Gigs" },
];

export function Header() {
  return (
    <header className="border-b border-gray-800 bg-gray-950">
      <div className="mx-auto flex max-w-2xl items-center gap-6 px-4 py-3">
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
    </header>
  );
}
