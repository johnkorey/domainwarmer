"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Check, Eye, EyeOff, Key, Save } from "lucide-react";

interface SettingsData {
  mailgunApiKey: string | null;
  openRouterApiKey: string | null;
  webhookSigningKey: string | null;
  hasMailgunKey: boolean;
  hasOpenRouterKey: boolean;
  hasWebhookKey: boolean;
  defaultFromName: string;
  maxDailyGlobalEmails: number;
  warmingEnabled: boolean;
  webmailEngagementEnabled: boolean;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);

  // Form fields
  const [mailgunKey, setMailgunKey] = useState("");
  const [openRouterKey, setOpenRouterKey] = useState("");
  const [webhookKey, setWebhookKey] = useState("");
  const [defaultFromName, setDefaultFromName] = useState("Team");
  const [maxDailyEmails, setMaxDailyEmails] = useState(500);
  const [warmingEnabled, setWarmingEnabled] = useState(true);
  const [webmailEnabled, setWebmailEnabled] = useState(true);

  // UI state
  const [showMailgun, setShowMailgun] = useState(false);
  const [showOpenRouter, setShowOpenRouter] = useState(false);
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

    // Clear input fields after saving API keys
    if (field === "mailgunApiKey") setMailgunKey("");
    if (field === "openRouterApiKey") setOpenRouterKey("");
    if (field === "webhookSigningKey") setWebhookKey("");
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
        {/* Mailgun API Key */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  Mailgun API Key
                </CardTitle>
                <CardDescription>
                  Required for sending emails and managing domains
                </CardDescription>
              </div>
              {settings?.hasMailgunKey && (
                <Badge variant="success">Connected</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showMailgun ? "text" : "password"}
                  placeholder={settings?.hasMailgunKey ? "Enter new key to update" : "key-xxxxxxxxxxxxxxxx"}
                  value={mailgunKey}
                  onChange={(e) => setMailgunKey(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowMailgun(!showMailgun)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground"
                >
                  {showMailgun ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button
                onClick={() => saveField("mailgunApiKey", mailgunKey)}
                disabled={!mailgunKey || saving === "mailgunApiKey"}
              >
                {saved === "mailgunApiKey" ? (
                  <Check className="h-4 w-4" />
                ) : saving === "mailgunApiKey" ? (
                  "Validating..."
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-1" />
                    Save
                  </>
                )}
              </Button>
            </div>
            {settings?.mailgunApiKey && (
              <p className="text-xs text-muted-foreground mt-2">
                Current: {settings.mailgunApiKey}
              </p>
            )}
          </CardContent>
        </Card>

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
                  Required for AI-powered email content generation (uses Claude Sonnet)
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
                  onClick={() => setShowOpenRouter(!showOpenRouter)}
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
            {settings?.openRouterApiKey && (
              <p className="text-xs text-muted-foreground mt-2">
                Current: {settings.openRouterApiKey}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Webhook Signing Key */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              Mailgun Webhook Signing Key
            </CardTitle>
            <CardDescription>
              Optional. Used to verify incoming Mailgun webhook events.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder={settings?.hasWebhookKey ? "Enter new key to update" : "Webhook signing key"}
                value={webhookKey}
                onChange={(e) => setWebhookKey(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={() => saveField("webhookSigningKey", webhookKey)}
                disabled={!webhookKey || saving === "webhookSigningKey"}
              >
                {saved === "webhookSigningKey" ? <Check className="h-4 w-4" /> : <><Save className="h-4 w-4 mr-1" />Save</>}
              </Button>
            </div>
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
                  Automatically engage with warming emails via connected webmail accounts
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
      </div>
    </>
  );
}
