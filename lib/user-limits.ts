import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  Timestamp,
  getCountFromServer
} from 'firebase/firestore';
import { db as _db } from './firebase';
import { getPlanConfig, getSuggestedUpgrade, isUnlimited } from './plan-config';
const db = _db!;

interface LimitInfo {
  current: number;
  max: number;
  remaining: number;
}

export interface UserLimitsResponse {
  plan: string;
  limits: {
    mcpServers: LimitInfo;
    requestsPerDay: LimitInfo;
  };
  canCreateMcpServer: boolean;
  canMakeRequest: boolean;
  hasPrivateServers: boolean;
  suggestedUpgrade: string | null;
  subscriptionStatus?: string;
}

export async function canCreateMcpServer(userId: string): Promise<{
  allowed: boolean;
  currentCount?: number;
  limit?: number;
  message?: string;
  plan?: string;
  suggestedUpgrade?: string | null;
}> {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return { allowed: false, message: 'Utilisateur non trouvé' };
    }

    const userData = userSnap.data();
    const plan = userData.plan || 'free';
    const planConfig = getPlanConfig(plan);

    const currentCount = await countActiveMcpServers(userId);
    const limit = planConfig.mcpServers;
    const allowed = isUnlimited(limit) || currentCount < limit;

    return {
      allowed,
      currentCount,
      limit,
      plan,
      suggestedUpgrade: !allowed ? 'professional' : null
    };
  } catch (error) {
    console.error('Error checking MCP server creation limits:', error);
    return { allowed: false, message: 'Erreur lors de la vérification des limites' };
  }
}

export async function countActiveMcpServers(userId: string): Promise<number> {
  try {
    const serversRef = collection(db, 'mcp_servers');
    const q = query(serversRef, where('userId', '==', userId), where('active', '==', true));
    const querySnapshot = await getDocs(q);
    return querySnapshot.size;
  } catch (error) {
    console.error('Error counting active MCP servers:', error);
    throw error;
  }
}

export async function countDailyRequests(userId: string): Promise<number> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfDay = Timestamp.fromDate(today);

    const requestsRef = collection(db, 'api_requests');
    const q = query(
      requestsRef, 
      where('userId', '==', userId), 
      where('createdAt', '>=', startOfDay)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.size;
  } catch (error) {
    console.error('Error counting daily requests:', error);
    return 0;
  }
}

export async function canMakeRequest(userId: string): Promise<{
  allowed: boolean;
  currentCount?: number;
  limit?: number;
  message?: string;
  plan?: string;
  suggestedUpgrade?: string | null;
}> {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return { allowed: false, message: 'Utilisateur non trouvé' };
    }

    const userData = userSnap.data();
    const plan = userData.plan || 'free';
    const planConfig = getPlanConfig(plan);

    const currentCount = await countDailyRequests(userId);
    const limit = planConfig.requestsPerDay;
    const allowed = isUnlimited(limit) || currentCount < limit;

    return {
      allowed,
      currentCount,
      limit,
      plan,
      suggestedUpgrade: !allowed ? 'professional' : null
    };
  } catch (error) {
    console.error('Error checking request limits:', error);
    return { allowed: false, message: 'Erreur lors de la vérification des limites' };
  }
}

export async function getUserLimits(userId: string): Promise<UserLimitsResponse> {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      throw new Error('User not found');
    }

    const userData = userSnap.data();
    const plan = userData.plan || 'free';
    const planConfig = getPlanConfig(plan);
    const suggestedUpgrade = getSuggestedUpgrade(plan);

    const mcpServersCount = await countActiveMcpServers(userId);
    const dailyRequestsCount = await countDailyRequests(userId);

    const mcpServersRemaining = isUnlimited(planConfig.mcpServers) 
      ? Infinity 
      : Math.max(0, planConfig.mcpServers - mcpServersCount);
    const requestsRemaining = isUnlimited(planConfig.requestsPerDay) 
      ? Infinity 
      : Math.max(0, planConfig.requestsPerDay - dailyRequestsCount);

    const limits = {
      mcpServers: {
        current: mcpServersCount,
        max: planConfig.mcpServers,
        remaining: mcpServersRemaining
      },
      requestsPerDay: {
        current: dailyRequestsCount,
        max: planConfig.requestsPerDay,
        remaining: requestsRemaining
      }
    };

    const canCreateServer = isUnlimited(planConfig.mcpServers) || mcpServersCount < planConfig.mcpServers;
    const canRequest = isUnlimited(planConfig.requestsPerDay) || dailyRequestsCount < planConfig.requestsPerDay;

    return {
      plan,
      limits,
      canCreateMcpServer: canCreateServer,
      canMakeRequest: canRequest,
      hasPrivateServers: planConfig.privateServers,
      suggestedUpgrade: suggestedUpgrade ? String(suggestedUpgrade) : null,
      subscriptionStatus: userData.subscriptionStatus || 'active'
    };
  } catch (error) {
    console.error('Error getting user limits:', error);
    throw error;
  }
}

export async function recordApiRequest(userId: string, endpoint: string): Promise<void> {
  try {
    const requestsRef = collection(db, 'api_requests');
    const { addDoc } = await import('firebase/firestore');
    await addDoc(requestsRef, {
      userId,
      endpoint,
      createdAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Error recording API request:', error);
  }
}

export async function updateUserMcpServersCount(userId: string, newCount: number): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      mcpServersCount: newCount,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Error updating user MCP servers count:', error);
    throw error;
  }
}

// ============================================
// LEGACY COMPATIBILITY ALIASES
// Ces fonctions maintiennent la compatibilité avec l'ancien code
// ============================================

export const canCreateAgent = canCreateMcpServer;
export const countActiveAgents = countActiveMcpServers;
export const updateUserAgentsCount = updateUserMcpServersCount;
