"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Upload } from "lucide-react";

interface SeedAddress {
  id: string;
  email: string;
  accountId: string | null;
  isInternal: boolean;
  createdAt: string;
  account?: { email: string } | null;
}

export default function SeedsPage() {
  const [seeds, setSeeds] = useState<SeedAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [bulkInput, setBulkInput] = useState("");
  const [addMode, setAddMode] = useState<"single" | "bulk">("single");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchSeeds();
  }, []);

  async function fetchSeeds() {
    const res = await fetch("/api/seeds");
    if (res.status === 401) {
      window.location.href = "/login";
      return;
    }
    const data = await res.json();
    setSeeds(data);
    setLoading(false);
  }

  async function handleAdd() {
    setAdding(true);
    const emails =
      addMode === "single"
        ? [emailInput]
        : bulkInput.split("\n").filter((e) => e.trim());

    await fetch("/api/seeds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emails }),
    });

    setEmailInput("");
    setBulkInput("");
    setShowAdd(false);
    await fetchSeeds();
    setAdding(false);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/seeds?id=${id}`, { method: "DELETE" });
    fetchSeeds();
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
        title="Seed Addresses"
        description={`${seeds.length} seed address${seeds.length !== 1 ? "es" : ""} configured`}
        actions={
          <Button onClick={() => setShowAdd(!showAdd)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Seeds
          </Button>
        }
      />

      {showAdd && (
        <Card>
          <CardHeader>
            <CardTitle>Add Seed Addresses</CardTitle>
            <CardDescription>
              Seed addresses receive warming emails. Use real inboxes you control
              for best results.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={addMode === "single" ? "default" : "outline"}
                size="sm"
                onClick={() => setAddMode("single")}
              >
                Single
              </Button>
              <Button
                variant={addMode === "bulk" ? "default" : "outline"}
                size="sm"
                onClick={() => setAddMode("bulk")}
              >
                <Upload className="h-4 w-4 mr-1" />
                Bulk Import
              </Button>
            </div>

            {addMode === "single" ? (
              <div className="flex gap-2">
                <Input
                  placeholder="seed@example.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleAdd} disabled={adding || !emailInput}>
                  {adding ? "Adding..." : "Add"}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Textarea
                  placeholder="Enter one email per line:&#10;seed1@example.com&#10;seed2@example.com&#10;seed3@example.com"
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                  rows={6}
                />
                <Button onClick={handleAdd} disabled={adding || !bulkInput}>
                  {adding ? "Adding..." : `Add ${bulkInput.split("\n").filter((e) => e.trim()).length} Seeds`}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-4 font-medium">Email</th>
                  <th className="text-left p-4 font-medium">Linked Account</th>
                  <th className="text-left p-4 font-medium">Type</th>
                  <th className="text-left p-4 font-medium">Added</th>
                  <th className="text-right p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {seeds.map((seed) => (
                  <tr key={seed.id} className="border-b hover:bg-muted/30">
                    <td className="p-4 font-mono text-sm">{seed.email}</td>
                    <td className="p-4">
                      {seed.account ? (
                        <Badge variant="outline">{seed.account.email}</Badge>
                      ) : (
                        <span className="text-muted-foreground">Global</span>
                      )}
                    </td>
                    <td className="p-4">
                      <Badge variant={seed.isInternal ? "secondary" : "outline"}>
                        {seed.isInternal ? "Internal" : "External"}
                      </Badge>
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {new Date(seed.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(seed.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {seeds.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      No seed addresses added yet. Add some to start warming.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
