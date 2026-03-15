/**
 * DELETE /api/account/delete — RGPD Account Deletion (Architecture 08-Securite §6)
 *
 * Allows an authenticated user to permanently delete their account and all
 * associated data (conversations, API keys, usage logs, preferences, themes,
 * MCP configurations, OAuth tokens, etc.).
 *
 * This is a destructive, irreversible operation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUserId } from '@/lib/firebase-admin-auth';
import { AuthenticationError } from '@/lib/errors';
import { handleApiError } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) throw new AuthenticationError();

    // Require explicit confirmation in the request body
    let body: { confirm?: boolean } = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Request body with { "confirm": true } is required' },
        { status: 400 }
      );
    }

    if (body.confirm !== true) {
      return NextResponse.json(
        { error: 'You must send { "confirm": true } to delete your account' },
        { status: 400 }
      );
    }

    // Verify user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    logger.info('RGPD account deletion requested', { userId });

    // Delete all user data in dependency order within a transaction
    await prisma.$transaction(async (tx) => {
      // 1. Delete conversation-related data (messages, reactions, attachments, shares, exports)
      const conversations = await tx.conversation.findMany({
        where: { userId },
        select: { id: true },
      });
      const conversationIds = conversations.map((c) => c.id);

      if (conversationIds.length > 0) {
        await tx.conversationExport.deleteMany({ where: { conversationId: { in: conversationIds } } });
        await tx.conversationShare.deleteMany({ where: { createdBy: userId } });
        await tx.messageReaction.deleteMany({ where: { userId } });
        // Messages have attachments — delete attachments first
        const messages = await tx.message.findMany({
          where: { conversationId: { in: conversationIds } },
          select: { id: true },
        });
        const messageIds = messages.map((m) => m.id);
        if (messageIds.length > 0) {
          await tx.messageAttachment.deleteMany({ where: { messageId: { in: messageIds } } });
        }
        await tx.message.deleteMany({ where: { conversationId: { in: conversationIds } } });
        await tx.conversation.deleteMany({ where: { userId } });
      }

      // 2. Delete personalization data
      await tx.personalizationAnalytics.deleteMany({ where: { userId } });
      await tx.theme.deleteMany({ where: { createdBy: userId } });
      await tx.userPreferences.deleteMany({ where: { userId } });

      // 3. Delete API keys and usage logs
      await tx.usageLog.deleteMany({ where: { userId } });
      await tx.apiKey.deleteMany({ where: { userId } });

      // 4. Delete OAuth tokens and authorization data
      await tx.oAuthRefreshToken.deleteMany({ where: { userId } });
      await tx.oAuthAccessToken.deleteMany({ where: { userId } });
      await tx.oAuthAuthorizationCode.deleteMany({ where: { userId } });
      await tx.oAuthToken.deleteMany({ where: { userId } });

      // 5. Delete MCP configurations, external MCP servers, and MCP tool data
      await tx.mCPConfiguration.deleteMany({ where: { userId } });
      await tx.externalMcpUsageLog.deleteMany({
        where: { server: { ownerId: userId } },
      });
      await tx.externalMcpServer.deleteMany({ where: { ownerId: userId } });
      await tx.mcpToolUsageLog.deleteMany({ where: { userId } });
      await tx.mcpToolActivation.deleteMany({ where: { userId } });

      // 6. Delete billing data (explicitly, not relying on DB cascade)
      const profile = await tx.userProfile.findUnique({ where: { userId }, select: { id: true } });
      if (profile) {
        await tx.payment.deleteMany({ where: { userId: profile.id } });
        await tx.invoice.deleteMany({ where: { userId: profile.id } });
        await tx.credit.deleteMany({ where: { userId: profile.id } });
        await tx.subscription.deleteMany({ where: { userId: profile.id } });
        await tx.paymentMethod.deleteMany({ where: { userId: profile.id } });
      }
      await tx.billingAlert.deleteMany({ where: { userId } });

      // 7. Delete prompt execution history
      await tx.promptExecution.deleteMany({ where: { userId } });

      // 8. Delete user profile
      await tx.userProfile.deleteMany({ where: { userId } });

      // 9. Finally, delete the user record
      await tx.user.delete({ where: { id: userId } });
    });

    // Try to delete Firebase Auth user (best-effort)
    try {
      const { getFirebaseAdminAuth } = await import('@/lib/firebase-admin-auth');
      const adminAuth = await getFirebaseAdminAuth();
      if (adminAuth) {
        await adminAuth.deleteUser(userId);
      }
    } catch (firebaseError) {
      // Log but don't fail — DB data is already deleted
      logger.warn('Failed to delete Firebase Auth user (data already purged)', { userId });
    }

    logger.info('RGPD account deletion completed', { userId });

    return NextResponse.json({
      success: true,
      message: 'Account and all associated data have been permanently deleted',
    });
  } catch (error) {
    return handleApiError(error, 'AccountDelete');
  }
}
