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

interface Props {
  userId: string;
  teamspace: { id: string; name: string; plan: string } | null;
  members: { userId: string; email: string; role: string; joinedAt: string }[];
}

export function TeamPanel({ userId, teamspace, members }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

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
      <CardContent>
        <h3 className="text-sm font-medium mb-3">Members</h3>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead className="w-24">Role</TableHead>
                <TableHead className="w-32">Joined</TableHead>
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
