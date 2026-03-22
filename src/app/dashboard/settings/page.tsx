"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Check, Eye, EyeOff, Key, Lock, Save } from "lucide-react";

interface SettingsData {
  openRouterApiKey: string | null;
  hasOpenRouterKey: boolean;
  defaultFromName: string;
  maxDailyGlobalEmails: number;
  warmingEnabled: boolean;
  webmailEngagementEnabled: boolean;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);

  // Form fields
  const [openRouterKey, setOpenRouterKey] = useState("");
  const [defaultFromName, setDefaultFromName] = useState("Team");
  const [maxDailyEmails, setMaxDailyEmails] = useState(500);
  const [warmingEnabled, setWarmingEnabled] = useState(true);
  const [webmailEnabled, setWebmailEnabled] = useState(true);

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);

  // UI state
  const [showOpenRouter, setShowOpenRouter] = useState(false);
  const [revealedKeys, setRevealedKeys] = useState<SettingsData | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    const res = await fetch("/api/settings");
    if (res.status === 401) {
      window.location.href = "/login";
      return;
    }
    const data = await res.json();
    setSettings(data);
    setDefaultFromName(data.defaultFromName);
    setMaxDailyEmails(data.maxDailyGlobalEmails);
    setWarmingEnabled(data.warmingEnabled);
    setWebmailEnabled(data.webmailEngagementEnabled);
    setLoading(false);
  }

  async function saveField(field: string, value: unknown) {
    setSaving(field);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    await fetchSettings();
    setSaving(null);
    setSaved(field);
    setTimeout(() => setSaved(null), 2000);

    if (field === "openRouterApiKey") setOpenRouterKey("");
    setRevealedKeys(null);
  }

  async function toggleReveal() {
    if (!showOpenRouter && !revealedKeys) {
      const res = await fetch("/api/settings?reveal=true");
      if (res.ok) {
        setRevealedKeys(await res.json());
      }
    }
    setShowOpenRouter(!showOpenRouter);
  }

  async function changePassword() {
    setPasswordError("");
    if (newPassword !== confirmNewPassword) {
      setPasswordError("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters");
      return;
    }
    setPasswordSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPasswordError(data.error || "Failed to change password");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setPasswordSaved(true);
      setTimeout(() => setPasswordSaved(false), 3000);
    } catch {
      setPasswordError("Network error");
    } finally {
      setPasswordSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="Configure API keys and global settings"
      />

      <div className="grid gap-6">
        {/* OpenRouter API Key */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  OpenRouter API Key
                </CardTitle>
                <CardDescription>
                  Required for AI-powered email content generation
                </CardDescription>
              </div>
              {settings?.hasOpenRouterKey && (
                <Badge variant="success">Connected</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showOpenRouter ? "text" : "password"}
                  placeholder={settings?.hasOpenRouterKey ? "Enter new key to update" : "sk-or-xxxxxxxxxxxxxxxx"}
                  value={openRouterKey}
                  onChange={(e) => setOpenRouterKey(e.target.value)}
                />
                <button
                  type="button"
                  onClick={toggleReveal}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground"
                >
                  {showOpenRouter ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button
                onClick={() => saveField("openRouterApiKey", openRouterKey)}
                disabled={!openRouterKey || saving === "openRouterApiKey"}
              >
                {saved === "openRouterApiKey" ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-1" />
                    Save
                  </>
                )}
              </Button>
            </div>
            {settings?.hasOpenRouterKey && (
              <p className="text-xs text-muted-foreground mt-2 font-mono break-all">
                Current: {showOpenRouter && revealedKeys?.openRouterApiKey ? revealedKeys.openRouterApiKey : settings.openRouterApiKey}
              </p>
            )}
          </CardContent>
        </Card>

        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle>General Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Default From Name</label>
              <div className="flex gap-2">
                <Input
                  value={defaultFromName}
                  onChange={(e) => setDefaultFromName(e.target.value)}
                  className="max-w-xs"
                />
                <Button
                  variant="outline"
                  onClick={() => saveField("defaultFromName", defaultFromName)}
                  disabled={saving === "defaultFromName"}
                >
                  {saved === "defaultFromName" ? <Check className="h-4 w-4" /> : "Update"}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Max Daily Global Emails</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={maxDailyEmails}
                  onChange={(e) => setMaxDailyEmails(parseInt(e.target.value) || 0)}
                  className="max-w-xs"
                />
                <Button
                  variant="outline"
                  onClick={() => saveField("maxDailyGlobalEmails", maxDailyEmails)}
                  disabled={saving === "maxDailyGlobalEmails"}
                >
                  {saved === "maxDailyGlobalEmails" ? <Check className="h-4 w-4" /> : "Update"}
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">Warming Enabled</p>
                <p className="text-sm text-muted-foreground">
                  Master switch for all warming operations
                </p>
              </div>
              <Button
                variant={warmingEnabled ? "default" : "outline"}
                onClick={() => {
                  const newValue = !warmingEnabled;
                  setWarmingEnabled(newValue);
                  saveField("warmingEnabled", newValue);
                }}
              >
                {warmingEnabled ? "Enabled" : "Disabled"}
              </Button>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">Webmail Engagement</p>
                <p className="text-sm text-muted-foreground">
                  Automatically engage with warming emails via connected accounts
                </p>
              </div>
              <Button
                variant={webmailEnabled ? "default" : "outline"}
                onClick={() => {
                  const newValue = !webmailEnabled;
                  setWebmailEnabled(newValue);
                  saveField("webmailEngagementEnabled", newValue);
                }}
              >
                {webmailEnabled ? "Enabled" : "Disabled"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Change Password
            </CardTitle>
            <CardDescription>
              Update your admin account password
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {passwordError && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                {passwordError}
              </div>
            )}
            {passwordSaved && (
              <div className="rounded-md bg-emerald-500/10 border border-emerald-500/20 p-3 text-sm text-emerald-600">
                Password changed successfully
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Current Password</label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">New Password</label>
              <Input
                type="password"
                placeholder="Min 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Confirm New Password</label>
              <Input
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <Button
              onClick={changePassword}
              disabled={!currentPassword || !newPassword || !confirmNewPassword || passwordSaving}
            >
              {passwordSaving ? "Changing..." : passwordSaved ? <><Check className="h-4 w-4 mr-1" />Changed</> : "Change Password"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
