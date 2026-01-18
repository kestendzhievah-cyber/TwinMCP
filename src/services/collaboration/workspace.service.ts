import { Pool } from 'pg';
import { nanoid } from 'nanoid';

export interface WorkspaceOptions {
  settings?: any;
  plan?: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  settings: any;
  plan: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: 'admin' | 'member' | 'viewer';
  permissions: string[];
  joinedAt: Date;
}

export interface WorkspaceInvitation {
  id: string;
  workspaceId: string;
  email: string;
  role: 'admin' | 'member' | 'viewer';
  token: string;
  invitedBy: string;
  expiresAt: Date;
  createdAt: Date;
}

export class WorkspaceService {
  constructor(private db: Pool) {}

  async createWorkspace(
    name: string,
    ownerId: string,
    options: WorkspaceOptions = {}
  ): Promise<Workspace> {
    const slug = this.generateSlug(name);
    
    const result = await this.db.query(
      `INSERT INTO workspaces (
        id, name, slug, owner_id, settings, plan, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING *`,
      [
        nanoid(),
        name,
        slug,
        ownerId,
        JSON.stringify(options.settings || {}),
        options.plan || 'free'
      ]
    );

    const workspace = result.rows[0];

    // Add owner as admin
    await this.addMember(workspace.id, ownerId, 'admin');

    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      ownerId: workspace.owner_id,
      settings: JSON.parse(workspace.settings),
      plan: workspace.plan,
      createdAt: workspace.created_at,
      updatedAt: workspace.updated_at
    };
  }

  async addMember(
    workspaceId: string,
    userId: string,
    role: 'admin' | 'member' | 'viewer'
  ): Promise<WorkspaceMember> {
    const permissions = this.getDefaultPermissions(role);

    const result = await this.db.query(
      `INSERT INTO workspace_members (
        id, workspace_id, user_id, role, permissions, joined_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *`,
      [nanoid(), workspaceId, userId, role, JSON.stringify(permissions)]
    );

    const member = result.rows[0];

    return {
      id: member.id,
      workspaceId: member.workspace_id,
      userId: member.user_id,
      role: member.role,
      permissions: JSON.parse(member.permissions),
      joinedAt: member.joined_at
    };
  }

  async inviteMember(
    workspaceId: string,
    email: string,
    role: 'admin' | 'member' | 'viewer',
    invitedBy: string
  ): Promise<WorkspaceInvitation> {
    const token = nanoid(32);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const result = await this.db.query(
      `INSERT INTO workspace_invitations (
        id, workspace_id, email, role, token, invited_by, expires_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *`,
      [nanoid(), workspaceId, email, role, token, invitedBy, expiresAt]
    );

    const invitation = result.rows[0];

    // TODO: Send invitation email via email service
    // await this.emailService.sendInvitation(email, invitation);

    return {
      id: invitation.id,
      workspaceId: invitation.workspace_id,
      email: invitation.email,
      role: invitation.role,
      token: invitation.token,
      invitedBy: invitation.invited_by,
      expiresAt: invitation.expires_at,
      createdAt: invitation.created_at
    };
  }

  async acceptInvitation(token: string, userId: string): Promise<void> {
    const result = await this.db.query(
      'SELECT * FROM workspace_invitations WHERE token = $1',
      [token]
    );

    if (result.rows.length === 0) {
      throw new Error('Invalid invitation token');
    }

    const invitation = result.rows[0];

    if (new Date(invitation.expires_at) < new Date()) {
      throw new Error('Invitation expired');
    }

    await this.addMember(invitation.workspace_id, userId, invitation.role);

    await this.db.query(
      'DELETE FROM workspace_invitations WHERE id = $1',
      [invitation.id]
    );
  }

  async getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    const result = await this.db.query(
      'SELECT * FROM workspace_members WHERE workspace_id = $1',
      [workspaceId]
    );

    return result.rows.map(row => ({
      id: row.id,
      workspaceId: row.workspace_id,
      userId: row.user_id,
      role: row.role,
      permissions: JSON.parse(row.permissions),
      joinedAt: row.joined_at
    }));
  }

  async getUserWorkspaces(userId: string): Promise<Workspace[]> {
    const result = await this.db.query(
      `SELECT w.* FROM workspaces w
       JOIN workspace_members wm ON w.id = wm.workspace_id
       WHERE wm.user_id = $1`,
      [userId]
    );

    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      ownerId: row.owner_id,
      settings: JSON.parse(row.settings),
      plan: row.plan,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  async removeMember(workspaceId: string, userId: string): Promise<void> {
    await this.db.query(
      'DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [workspaceId, userId]
    );
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      + '-' + nanoid(6);
  }

  private getDefaultPermissions(role: string): string[] {
    switch (role) {
      case 'admin':
        return ['read', 'write', 'delete', 'invite', 'manage'];
      case 'member':
        return ['read', 'write'];
      case 'viewer':
        return ['read'];
      default:
        return ['read'];
    }
  }
}
