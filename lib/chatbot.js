"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserProfile = getUserProfile;
exports.getChatbot = getChatbot;
exports.createChatbot = createChatbot;
exports.getUserChatbots = getUserChatbots;
exports.updateChatbot = updateChatbot;
exports.deleteChatbot = deleteChatbot;
const firestore_1 = require("firebase/firestore");
const firebase_1 = require("./firebase");
// User operations
async function getUserProfile(userId) {
    try {
        const userRef = (0, firestore_1.doc)(firebase_1.db, 'users', userId);
        const userSnap = await (0, firestore_1.getDoc)(userRef);
        if (!userSnap.exists()) {
            return null;
        }
        return {
            id: userSnap.id,
            ...userSnap.data()
        };
    }
    catch (error) {
        console.error('Error getting user profile:', error);
        return null;
    }
}
async function getChatbot(chatbotId) {
    try {
        const chatbotRef = (0, firestore_1.doc)(firebase_1.db, 'chatbots', chatbotId);
        const chatbotSnap = await (0, firestore_1.getDoc)(chatbotRef);
        if (!chatbotSnap.exists()) {
            return null;
        }
        return {
            id: chatbotSnap.id,
            ...chatbotSnap.data()
        };
    }
    catch (error) {
        console.error('Error getting chatbot:', error);
        return null;
    }
}
async function createChatbot(userId, data) {
    try {
        const chatbotsRef = (0, firestore_1.collection)(firebase_1.db, 'chatbots');
        const chatbotData = {
            ...data,
            userId,
            status: 'active',
            createdAt: firestore_1.Timestamp.now(),
            updatedAt: firestore_1.Timestamp.now()
        };
        const docRef = await (0, firestore_1.addDoc)(chatbotsRef, chatbotData);
        return docRef.id;
    }
    catch (error) {
        console.error('Error creating chatbot:', error);
        throw error;
    }
}
async function getUserChatbots(userId) {
    try {
        const chatbotsRef = (0, firestore_1.collection)(firebase_1.db, 'chatbots');
        const q = (0, firestore_1.query)(chatbotsRef, (0, firestore_1.where)('userId', '==', userId), (0, firestore_1.orderBy)('createdAt', 'desc'));
        const querySnapshot = await (0, firestore_1.getDocs)(q);
        const chatbots = [];
        querySnapshot.forEach((doc) => {
            chatbots.push({
                id: doc.id,
                ...doc.data()
            });
        });
        return chatbots;
    }
    catch (error) {
        console.error('Error getting user chatbots:', error);
        return [];
    }
}
async function updateChatbot(chatbotId, updates) {
    try {
        const chatbotRef = (0, firestore_1.doc)(firebase_1.db, 'chatbots', chatbotId);
        await (0, firestore_1.updateDoc)(chatbotRef, {
            ...updates,
            updatedAt: firestore_1.Timestamp.now()
        });
    }
    catch (error) {
        console.error('Error updating chatbot:', error);
        throw error;
    }
}
async function deleteChatbot(chatbotId) {
    try {
        const chatbotRef = (0, firestore_1.doc)(firebase_1.db, 'chatbots', chatbotId);
        await (0, firestore_1.deleteDoc)(chatbotRef);
    }
    catch (error) {
        console.error('Error deleting chatbot:', error);
        throw error;
    }
}
//# sourceMappingURL=chatbot.js.map