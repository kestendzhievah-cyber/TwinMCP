"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Trash2, Users } from "lucide-react";
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
          <form onSubmit={createTeam} className="space-y-2">
            <Label htmlFor="teamspace-name">Name</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="teamspace-name"
                placeholder="Teamspace name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <Button type="submit" disabled={creating} className="shrink-0">
                {creating ? "Creating…" : "Create"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {/* Ruled header: hairline icon square + the teamspace name; head-count and plan seal right. */}
      <CardHeader className="border-b border-border px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center border border-border text-muted-foreground">
              <Users className="h-4 w-4" />
            </span>
            {teamspace.name}
          </CardTitle>
          <div className="flex items-center gap-3">
            <span className="smallcaps tracking-sc lining text-xs text-muted-foreground">
              {members.length} member{members.length === 1 ? "" : "s"}
            </span>
            <Badge
              variant={teamspace.plan === "free" ? "secondary" : "success"}
              className="capitalize"
            >
              {teamspace.plan}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isOwner && (
          <form onSubmit={invite} className="space-y-2 border-b border-border px-6 py-5">
            <Label htmlFor="invite-email">Add a member</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="invite-email"
                type="email"
                placeholder="teammate@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Button type="submit" disabled={inviting} className="shrink-0">
                {inviting ? "Adding…" : "Add member"}
              </Button>
            </div>
            <p className="text-xs italic text-muted-foreground">
              They must already have a TwinMCP account.
            </p>
          </form>
        )}
        <div>
          <h3 className="smallcaps tracking-sc px-6 pb-2 pt-5 text-sm font-medium">Members</h3>
          {/* Ledger: small-caps header on a firmer rule, hairline rows, flush to the card edges. */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Email</TableHead>
                <TableHead className="w-28">Role</TableHead>
                <TableHead className="w-36">Joined</TableHead>
                {isOwner && <TableHead className="w-16 pr-6"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.userId}>
                  <TableCell className="pl-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="break-all">{m.email}</span>
                      {m.userId === userId && <Badge variant="brand">you</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={m.role === "owner" ? "default" : "secondary"}>{m.role}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(m.joinedAt)}</TableCell>
                  {isOwner && (
                    <TableCell className="pr-6 text-right">
                      {m.role !== "owner" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setRemoveTarget(m)}
                          aria-label={`Remove ${m.email}`}
                          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Dialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove this member?</DialogTitle>
              <DialogDescription>
                <code className="font-mono not-italic">{removeTarget?.email}</code> will immediately
                lose access to this teamspace.
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
