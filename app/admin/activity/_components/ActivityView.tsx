"use client";

import { useState, useMemo, useEffect } from "react";
import Image        from "next/image";
import { Activity, LogIn, Clock } from "lucide-react";
import Pagination from "@/app/admin/_components/Pagination";

const PER_PAGE = 25;

interface LoginLog {
  id:         string;
  userId:     string;
  shopId:     string | null;
  loginTime:  string;
  logoutTime: string | null;
  lastSeen:   string;
  duration:   number;
  userName:   string;
  userEmail:  string;
  userImage:  string | null;
}

interface ActivityLog {
  id:        string;
  userId:    string;
  shopId:    string | null;
  action:    string;
  entity:    string | null;
  details:   string | null;
  path:      string;
  createdAt: string;
  userName:  string;
  userEmail: string;
  userImage: string | null;
}

interface Props {
  loginLogs:    LoginLog[];
  activityLogs: ActivityLog[];
}

type Tab = "login" | "actions";

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "?";
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-KE", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtDuration(seconds: number) {
  if (!seconds || seconds <= 0) return "—";
  if (seconds < 60)   return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function ActionBadge({ action }: { action: string }) {
  const upper = action.toUpperCase();
  const map: Record<string, string> = {
    CREATE: "bg-green-100 text-green-700 border-green-200",
    UPDATE: "bg-blue-100 text-blue-700 border-blue-200",
    DELETE: "bg-red-100 text-red-700 border-red-200",
    READ:   "bg-gray-100 text-gray-600 border-gray-200",
    LOGIN:  "bg-indigo-100 text-indigo-700 border-indigo-200",
    LOGOUT: "bg-orange-100 text-orange-700 border-orange-200",
  };
  // Find matching key prefix
  const matchedKey = Object.keys(map).find(k => upper.includes(k));
  const cls = matchedKey ? map[matchedKey] : "bg-gray-100 text-gray-600 border-gray-200";
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border uppercase ${cls}`}>
      {action}
    </span>
  );
}

function Avatar({ image, name }: { image: string | null; name: string }) {
  return (
    <div className="w-8 h-8 rounded-full overflow-hidden bg-indigo-100 shrink-0 relative">
      {image ? (
        <Image src={image} alt={name} fill sizes="32px" className="object-cover" />
      ) : (
        <span className="flex h-full items-center justify-center text-indigo-700 font-bold text-xs">
          {initials(name)}
        </span>
      )}
    </div>
  );
}

export default function ActivityView({ loginLogs, activityLogs }: Props) {
  const [tab,          setTab]          = useState<Tab>("login");
  const [loginPage,    setLoginPage]    = useState(1);
  const [activityPage, setActivityPage] = useState(1);

  // Reset pages on tab change
  useEffect(() => { setLoginPage(1); setActivityPage(1); }, [tab]);

  const paginatedLogin    = useMemo(
    () => loginLogs.slice((loginPage - 1) * PER_PAGE, loginPage * PER_PAGE),
    [loginLogs, loginPage]
  );
  const paginatedActivity = useMemo(
    () => activityLogs.slice((activityPage - 1) * PER_PAGE, activityPage * PER_PAGE),
    [activityLogs, activityPage]
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Activity</h1>
        <p className="text-sm text-gray-500 mt-0.5">Login history and action audit trail</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-white rounded-xl border border-gray-200 shadow-sm w-fit">
        {[
          { key: "login",   label: "Login Activity", icon: LogIn    },
          { key: "actions", label: "Action Logs",    icon: Activity },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as Tab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              tab === t.key
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            <t.icon size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Login Activity */}
      {tab === "login" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                  <th className="text-left px-5 py-3 font-medium">User</th>
                  <th className="text-left px-3 py-3 font-medium">Login Time</th>
                  <th className="text-left px-3 py-3 font-medium">Logout Time</th>
                  <th className="text-left px-3 py-3 font-medium">Duration</th>
                  <th className="text-left px-3 py-3 font-medium">Last Seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loginLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-gray-400 text-sm">No login records</td>
                  </tr>
                )}
                {paginatedLogin.map(l => (
                  <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar image={l.userImage} name={l.userName} />
                        <div>
                          <p className="font-medium text-gray-800 text-xs">{l.userName}</p>
                          <p className="text-gray-400 text-[0.65rem] truncate max-w-[160px]">{l.userEmail}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">{fmtDateTime(l.loginTime)}</td>
                    <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">
                      {l.logoutTime ? fmtDateTime(l.logoutTime) : (
                        <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-1 text-xs text-gray-600 font-medium">
                        <Clock size={11} className="text-gray-400" />
                        {fmtDuration(l.duration)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-400 whitespace-nowrap">{fmtDateTime(l.lastSeen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={loginPage}
            totalPages={Math.ceil(loginLogs.length / PER_PAGE)}
            total={loginLogs.length}
            perPage={PER_PAGE}
            label="sessions"
            onPage={setLoginPage}
          />
        </div>
      )}

      {/* Action Logs */}
      {tab === "actions" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                  <th className="text-left px-5 py-3 font-medium">User</th>
                  <th className="text-left px-3 py-3 font-medium">Action</th>
                  <th className="text-left px-3 py-3 font-medium">Entity</th>
                  <th className="text-left px-3 py-3 font-medium">Path</th>
                  <th className="text-left px-3 py-3 font-medium">Shop</th>
                  <th className="text-left px-3 py-3 font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {activityLogs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-gray-400 text-sm">No activity records</td>
                  </tr>
                )}
                {paginatedActivity.map(l => (
                  <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar image={l.userImage} name={l.userName} />
                        <div>
                          <p className="font-medium text-gray-800 text-xs">{l.userName}</p>
                          <p className="text-gray-400 text-[0.65rem] truncate max-w-[120px]">{l.userEmail}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <ActionBadge action={l.action} />
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-600 font-medium">{l.entity || "—"}</td>
                    <td className="px-3 py-3 text-xs font-mono text-gray-500 max-w-[160px] truncate">{l.path}</td>
                    <td className="px-3 py-3 text-xs text-gray-400 font-mono">
                      {l.shopId ? l.shopId.slice(-6).toUpperCase() : "—"}
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-400 whitespace-nowrap">{fmtDateTime(l.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={activityPage}
            totalPages={Math.ceil(activityLogs.length / PER_PAGE)}
            total={activityLogs.length}
            perPage={PER_PAGE}
            label="actions"
            onPage={setActivityPage}
          />
        </div>
      )}
    </div>
  );
}
