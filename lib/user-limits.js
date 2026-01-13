"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canCreateAgent = canCreateAgent;
exports.countActiveAgents = countActiveAgents;
exports.getUserLimits = getUserLimits;
exports.updateUserAgentsCount = updateUserAgentsCount;
const firestore_1 = require("firebase/firestore");
const firebase_1 = require("./firebase");
const plan_config_1 = require("./plan-config");
async function canCreateAgent(userId) {
    try {
        const userRef = (0, firestore_1.doc)(firebase_1.db, 'users', userId);
        const userSnap = await (0, firestore_1.getDoc)(userRef);
        if (!userSnap.exists()) {
            return { allowed: false, message: 'Utilisateur non trouvé' };
        }
        const userData = userSnap.data();
        const plan = userData.plan || 'free';
        const planConfig = (0, plan_config_1.getPlanConfig)(plan);
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
    }
    catch (error) {
        console.error('Error checking agent creation limits:', error);
        return { allowed: false, message: 'Erreur lors de la vérification des limites' };
    }
}
async function countActiveAgents(userId) {
    try {
        const agentsRef = (0, firestore_1.collection)(firebase_1.db, 'agents');
        const q = (0, firestore_1.query)(agentsRef, (0, firestore_1.where)('userId', '==', userId), (0, firestore_1.where)('active', '==', true));
        const querySnapshot = await (0, firestore_1.getDocs)(q);
        return querySnapshot.size;
    }
    catch (error) {
        console.error('Error counting active agents:', error);
        throw error;
    }
}
async function getUserLimits(userId) {
    try {
        const userRef = (0, firestore_1.doc)(firebase_1.db, 'users', userId);
        const userSnap = await (0, firestore_1.getDoc)(userRef);
        if (!userSnap.exists()) {
            throw new Error('User not found');
        }
        const userData = userSnap.data();
        const plan = userData.plan || 'free';
        const planConfig = (0, plan_config_1.getPlanConfig)(plan);
        const suggestedUpgrade = (0, plan_config_1.getSuggestedUpgrade)(plan);
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
    }
    catch (error) {
        console.error('Error getting user limits:', error);
        throw error;
    }
}
async function updateUserAgentsCount(userId, newCount) {
    try {
        const userRef = (0, firestore_1.doc)(firebase_1.db, 'users', userId);
        await (0, firestore_1.updateDoc)(userRef, {
            agentsCount: newCount,
            updatedAt: firestore_1.Timestamp.now()
        });
    }
    catch (error) {
        console.error('Error updating user agents count:', error);
        throw error;
    }
}
//# sourceMappingURL=user-limits.js.map