"use client";

import { useSession } from "@/src/auth/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, Check, Link as LinkIcon, Unlink, User } from "lucide-react";

interface LinkedIdentity {
  id: number;
  provider: string;
  providerUserId: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

interface UserProfile {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ProfileData {
  user: UserProfile;
  linkedIdentities: LinkedIdentity[];
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "profile" | "accounts" | "settings"
  >("profile");
  const [linkingProvider, setLinkingProvider] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Form state
  const [displayName, setDisplayName] = useState("");
  const [settingsJson, setSettingsJson] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    } else if (status === "authenticated") {
      fetchProfile();
      fetchSettings();
    }
  }, [status]);

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/profile");
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setDisplayName(data.user.displayName || "");
      }
    } catch (error) {
      console.error("Failed to fetch profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/profile/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        setSettingsJson(JSON.stringify(data.settings, null, 2));
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    }
  };

  const updateProfile = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName }),
      });

      if (res.ok) {
        const data = await res.json();
        setProfile((prev) => (prev ? { ...prev, user: data.user } : null));
      }
    } catch (error) {
      console.error("Failed to update profile:", error);
    } finally {
      setSaving(false);
    }
  };

  const updateSettings = async () => {
    setSaving(true);
    try {
      const parsedSettings = JSON.parse(settingsJson);
      const res = await fetch("/api/profile/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: parsedSettings }),
      });

      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
      }
    } catch (error) {
      console.error("Failed to update settings:", error);
      alert("Invalid JSON format");
    } finally {
      setSaving(false);
    }
  };

  const handleLinkProvider = async (provider: "google" | "github") => {
    setLinkingProvider(provider);
    setLinkError(null);

    // Create a form and submit to trigger NextAuth
    const form = document.createElement("form");
    form.method = "POST";
    form.action = `/api/auth/signin/${provider}`;

    const callbackInput = document.createElement("input");
    callbackInput.type = "hidden";
    callbackInput.name = "callbackUrl";
    callbackInput.value = "/profile";
    form.appendChild(callbackInput);

    document.body.appendChild(form);
    form.submit();
  };

  const unlinkAccount = async (provider: string) => {
    if (!confirm(`Unlink ${provider} account?`)) return;

    try {
      const res = await fetch(`/api/profile/link/${provider}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchProfile();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to unlink account");
      }
    } catch (error) {
      console.error("Failed to unlink account:", error);
    }
  };

  if (loading || status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Failed to load profile</p>
      </div>
    );
  }

  const hasGoogle = profile.linkedIdentities.some(
    (i) => i.provider === "google"
  );
  const hasGitHub = profile.linkedIdentities.some(
    (i) => i.provider === "github"
  );

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Profile & Settings</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your account, linked identities, and preferences
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
          <button
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "profile"
                ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            }`}
            onClick={() => setActiveTab("profile")}
          >
            Profile
          </button>
          <button
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "accounts"
                ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            }`}
            onClick={() => setActiveTab("accounts")}
          >
            Linked Accounts
          </button>
          <button
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "settings"
                ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            }`}
            onClick={() => setActiveTab("settings")}
          >
            Settings
          </button>
        </div>
      </div>

      {/* Profile Tab */}
      {activeTab === "profile" && (
        <div className="space-y-6">
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
            <h2 className="text-xl font-semibold mb-4">Profile Information</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Update your display name and profile picture
            </p>

            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                  {profile.user.avatarUrl ? (
                    <img
                      src={profile.user.avatarUrl}
                      alt="Avatar"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <User className="h-10 w-10 text-gray-400" />
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    User ID
                  </p>
                  <p className="font-mono text-xs text-gray-500">
                    {profile.user.id}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm"
                  value={profile.user.email || "Not provided"}
                  disabled
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="displayName">
                  Display Name
                </label>
                <input
                  id="displayName"
                  type="text"
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your name"
                />
              </div>

              <button
                onClick={updateProfile}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Linked Accounts Tab */}
      {activeTab === "accounts" && (
        <div className="space-y-6">
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
            <h2 className="text-xl font-semibold mb-4">Linked Accounts</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Connect multiple OAuth providers to your account
            </p>

            <div className="space-y-4">
              {profile.linkedIdentities.map((identity) => (
                <div
                  key={identity.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                      {identity.avatarUrl ? (
                        <img
                          src={identity.avatarUrl}
                          alt="Avatar"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-sm font-medium">
                          {identity.provider === "google" ? "G" : "GH"}
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium capitalize">
                          {identity.provider}
                        </p>
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900 px-2 py-0.5 text-xs text-green-700 dark:text-green-300">
                          <Check className="h-3 w-3" />
                          Linked
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {identity.email || identity.displayName || "No email"}
                      </p>
                    </div>
                  </div>

                  {profile.linkedIdentities.length > 1 && (
                    <button
                      onClick={() => unlinkAccount(identity.provider)}
                      className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                    >
                      <Unlink className="h-4 w-4" />
                      Unlink
                    </button>
                  )}
                </div>
              ))}

              <div className="pt-4 space-y-2">
                <p className="text-sm font-medium">Add more accounts</p>
                <div className="flex gap-2">
                  {!hasGoogle && (
                    <button
                      onClick={() => handleLinkProvider("google")}
                      className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                    >
                      <LinkIcon className="h-4 w-4" />
                      Link Google
                    </button>
                  )}
                  {!hasGitHub && (
                    <button
                      onClick={() => handleLinkProvider("github")}
                      className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                    >
                      <LinkIcon className="h-4 w-4" />
                      Link GitHub
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === "settings" && (
        <div className="space-y-6">
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
            <h2 className="text-xl font-semibold mb-4">User Settings</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Custom settings stored as JSON (advanced)
            </p>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="settingsJson">
                  Settings JSON
                </label>
                <textarea
                  id="settingsJson"
                  className="min-h-[200px] w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 font-mono text-sm"
                  value={settingsJson}
                  onChange={(e) => setSettingsJson(e.target.value)}
                  placeholder='{"theme": "dark", "notifications": true}'
                />
              </div>

              <button
                onClick={updateSettings}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
