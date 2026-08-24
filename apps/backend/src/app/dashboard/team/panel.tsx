"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  userId: string;
  teamspace: { id: string; name: string; plan: string } | null;
  members: { userId: string; email: string; role: string; joinedAt: string }[];
}

export function TeamPanel({ userId, teamspace, members }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Props["members"][number] | null>(null);
  const [removing, setRemoving] = useState(false);
  const isOwner = members.some((m) => m.userId === userId && m.role === "owner");

  async function invite(e: FormEvent) {
    e.preventDefault();
    if (!teamspace || !email.trim()) return;
    setInviting(true);
    const res = await fetch(`/api/v2/team/${teamspace.id}/members`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });
    setInviting(false);
    if (res.ok) {
      toast.success("Member added");
      setEmail("");
      router.refresh();
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.message ?? "Could not add member");
    }
  }

  async function removeMember(memberUserId: string) {
    if (!teamspace) return;
    setRemoving(true);
    const res = await fetch(`/api/v2/team/${teamspace.id}/members?userId=${memberUserId}`, {
      method: "DELETE",
    });
    setRemoving(false);
    if (res.ok) {
      setRemoveTarget(null);
      toast.success("Member removed");
      router.refresh();
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.message ?? "Could not remove member");
    }
  }

  async function createTeam(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    const res = await fetch("/api/v2/team", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setCreating(false);
    if (res.ok) {
      toast.success("Teamspace created");
      setName("");
      router.refresh();
    } else {
      toast.error("Failed to create teamspace");
    }
  }

  if (!teamspace) {
    return (
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>No teamspace yet</CardTitle>
          <CardDescription>Create one to manage members and policies.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={createTeam} className="flex gap-2">
            <Input
              placeholder="Teamspace name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Button type="submit" disabled={creating}>
              {creating ? "Creating…" : "Create"}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{teamspace.name}</CardTitle>
            <CardDescription className="mt-1">
              <Badge variant="secondary" className="capitalize">
                {teamspace.plan}
              </Badge>
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isOwner && (
          <form onSubmit={invite} className="flex flex-col gap-1.5">
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="teammate@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Button type="submit" disabled={inviting}>
                {inviting ? "Adding…" : "Add member"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              They must already have a TwinMCP account.
            </p>
          </form>
        )}
        <div>
          <h3 className="text-sm font-medium mb-3">Members</h3>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead className="w-24">Role</TableHead>
                  <TableHead className="w-32">Joined</TableHead>
                  {isOwner && <TableHead className="w-12"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.userId}>
                    <TableCell>
                      {m.email}
                      {m.userId === userId && (
                        <span className="text-xs text-muted-foreground ml-2">(you)</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.role === "owner" ? "default" : "secondary"}>{m.role}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(m.joinedAt).toLocaleDateString()}
                    </TableCell>
                    {isOwner && (
                      <TableCell>
                        {m.role !== "owner" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setRemoveTarget(m)}
                            aria-label={`Remove ${m.email}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <Dialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove this member?</DialogTitle>
              <DialogDescription>
                <code className="font-mono">{removeTarget?.email}</code> will immediately lose
                access to this teamspace.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRemoveTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => removeTarget && removeMember(removeTarget.userId)}
                disabled={removing}
              >
                {removing ? "Removing…" : "Remove member"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
