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
import { db } from './firebase';
import { getPlanConfig, getSuggestedUpgrade } from './plan-config';

interface LimitInfo {
  current: number;
  max: number;
  remaining: number;
}

export interface UserLimitsResponse {
  plan: string;
  limits: {
    agents: LimitInfo;
    conversations: LimitInfo;
  };
  canCreateAgent: boolean;
  suggestedUpgrade: string | null;
  subscriptionStatus?: string;
}

export async function canCreateAgent(userId: string): Promise<{
  allowed: boolean;
  currentCount?: number;
  limit?: number;
  message?: string;
  plan?: string;
  maxAllowed?: number;
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

    const currentCount = await countActiveAgents(userId);
    const limit = planConfig.agents;
    const allowed = limit === -1 || currentCount < limit;

    return {
      allowed,
      currentCount,
      limit,
      plan,
      maxAllowed: limit,
      suggestedUpgrade: !allowed ? 'PRO' : null
    };
  } catch (error) {
    console.error('Error checking agent creation limits:', error);
    return { allowed: false, message: 'Erreur lors de la vérification des limites' };
  }
}

export async function countActiveAgents(userId: string): Promise<number> {
  try {
    const agentsRef = collection(db, 'agents');
    const q = query(agentsRef, where('userId', '==', userId), where('active', '==', true));
    const querySnapshot = await getDocs(q);
    return querySnapshot.size;
  } catch (error) {
    console.error('Error counting active agents:', error);
    throw error;
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

    const currentCount = await countActiveAgents(userId);
    const agentsRemaining = planConfig.agents === -1 ? Infinity : Math.max(0, planConfig.agents - currentCount);
    const conversationsRemaining = planConfig.conversations === -1 ? Infinity : planConfig.conversations;

    const limits = {
      agents: {
        current: currentCount,
        max: planConfig.agents,
        remaining: agentsRemaining
      },
      conversations: {
        current: 0, // TODO: implement conversation counting
        max: planConfig.conversations,
        remaining: conversationsRemaining
      }
    };

    const canCreateAgent = planConfig.agents === -1 || currentCount < planConfig.agents;

    return {
      plan,
      limits,
      canCreateAgent,
      suggestedUpgrade: suggestedUpgrade ? String(suggestedUpgrade) : null,
      subscriptionStatus: userData.subscriptionStatus || 'active'
    };
  } catch (error) {
    console.error('Error getting user limits:', error);
    throw error;
  }
}

export async function updateUserAgentsCount(userId: string, newCount: number): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      agentsCount: newCount,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Error updating user agents count:', error);
    throw error;
  }
}
