"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAgent = createAgent;
exports.getAgent = getAgent;
exports.updateAgent = updateAgent;
exports.deleteAgent = deleteAgent;
const firestore_1 = require("firebase/firestore");
const firebase_1 = require("./firebase");
function generateAgentId() {
    return 'agent_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}
// Fonction pour créer un agent
async function createAgent(userId, data) {
    try {
        const agentsRef = (0, firestore_1.collection)(firebase_1.db, 'agents');
        const agentId = generateAgentId();
        const agentData = {
            userId,
            name: data.name,
            description: data.description,
            model: data.model,
            systemPrompt: data.systemPrompt,
            temperature: data.temperature || 0.7,
            maxTokens: data.maxTokens || 1000,
            status: 'active',
            publicUrl: `/chat/${agentId}`,
            conversationsCount: 0,
            createdAt: firestore_1.Timestamp.now(),
            updatedAt: firestore_1.Timestamp.now(),
        };
        const docRef = await (0, firestore_1.addDoc)(agentsRef, agentData);
        return {
            id: docRef.id,
            ...agentData,
        };
    }
    catch (error) {
        console.error('Error creating agent:', error);
        throw error;
    }
}
async function getAgent(agentId) {
    try {
        const agentRef = (0, firestore_1.doc)(firebase_1.db, 'agents', agentId);
        const agentSnap = await (0, firestore_1.getDoc)(agentRef);
        if (!agentSnap.exists()) {
            return null;
        }
        return {
            id: agentSnap.id,
            ...agentSnap.data()
        };
    }
    catch (error) {
        console.error('Error getting agent:', error);
        return null;
    }
}
async function updateAgent(agentId, data) {
    try {
        const agentRef = (0, firestore_1.doc)(firebase_1.db, 'agents', agentId);
        await (0, firestore_1.updateDoc)(agentRef, {
            ...data,
            updatedAt: firestore_1.Timestamp.now(),
        });
    }
    catch (error) {
        console.error('Error updating agent:', error);
        throw error;
    }
}
async function deleteAgent(agentId) {
    try {
        const agentRef = (0, firestore_1.doc)(firebase_1.db, 'agents', agentId);
        await (0, firestore_1.deleteDoc)(agentRef);
    }
    catch (error) {
        console.error('Error deleting agent:', error);
        throw error;
    }
}
//# sourceMappingURL=agents.js.map