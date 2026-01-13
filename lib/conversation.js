"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConversationHistory = getConversationHistory;
exports.createConversation = createConversation;
exports.addMessageToConversation = addMessageToConversation;
const firestore_1 = require("firebase/firestore");
const firebase_1 = require("./firebase");
async function getConversationHistory(conversationId) {
    try {
        const conversationRef = (0, firestore_1.doc)(firebase_1.db, 'conversations', conversationId);
        const conversationSnap = await (0, firestore_1.getDoc)(conversationRef);
        if (!conversationSnap.exists()) {
            return null;
        }
        return {
            id: conversationSnap.id,
            ...conversationSnap.data()
        };
    }
    catch (error) {
        console.error('Error getting conversation history:', error);
        return null;
    }
}
async function createConversation(chatbotId, visitorId) {
    try {
        const conversationsRef = (0, firestore_1.collection)(firebase_1.db, 'conversations');
        const conversationData = {
            chatbotId,
            visitorId,
            messages: [],
            createdAt: firestore_1.Timestamp.now(),
            updatedAt: firestore_1.Timestamp.now()
        };
        const docRef = await (0, firestore_1.addDoc)(conversationsRef, conversationData);
        return docRef.id;
    }
    catch (error) {
        console.error('Error creating conversation:', error);
        throw error;
    }
}
async function addMessageToConversation(conversationId, message) {
    try {
        const conversationRef = (0, firestore_1.doc)(firebase_1.db, 'conversations', conversationId);
        const conversationSnap = await (0, firestore_1.getDoc)(conversationRef);
        if (!conversationSnap.exists()) {
            throw new Error('Conversation not found');
        }
        const messages = conversationSnap.data().messages || [];
        const newMessage = {
            ...message,
            timestamp: firestore_1.Timestamp.now()
        };
        messages.push(newMessage);
        await (0, firestore_1.updateDoc)(conversationRef, {
            messages,
            updatedAt: firestore_1.Timestamp.now()
        });
        return `msg_${Date.now()}_${messages.length - 1}`;
    }
    catch (error) {
        console.error('Error adding message to conversation:', error);
        throw error;
    }
}
//# sourceMappingURL=conversation.js.map