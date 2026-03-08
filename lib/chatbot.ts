import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db as _db } from './firebase';

function getDb() {
  if (!_db) throw new Error('Firebase Firestore is not initialized. Check Firebase configuration.');
  return _db;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: 'BUYER' | 'SELLER' | 'ADMIN';
  createdAt: Timestamp;
}

interface Chatbot {
  id: string;
  name: string;
  description: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  userId: string;
  status: 'active' | 'inactive';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Timestamp;
}

interface Conversation {
  id: string;
  chatbotId: string;
  visitorId: string;
  messages: Message[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface CreateChatbotRequest {
  name: string;
  description: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
}

interface SendMessageRequest {
  chatbotId: string;
  message: string;
  conversationId?: string;
  visitorId: string;
}

interface SendMessageResponse {
  response: string;
  conversationId: string;
}

// User operations
export async function getUserProfile(userId: string): Promise<User | null> {
  try {
    const userRef = doc(getDb(), 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return null;
    }

    return {
      id: userSnap.id,
      ...userSnap.data(),
    } as User;
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
}

export async function getChatbot(chatbotId: string): Promise<Chatbot | null> {
  try {
    const chatbotRef = doc(getDb(), 'chatbots', chatbotId);
    const chatbotSnap = await getDoc(chatbotRef);

    if (!chatbotSnap.exists()) {
      return null;
    }

    return {
      id: chatbotSnap.id,
      ...chatbotSnap.data(),
    } as Chatbot;
  } catch (error) {
    console.error('Error getting chatbot:', error);
    return null;
  }
}

export async function createChatbot(userId: string, data: CreateChatbotRequest): Promise<string> {
  try {
    const chatbotsRef = collection(getDb(), 'chatbots');
    const chatbotData = {
      ...data,
      userId,
      status: 'active',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const docRef = await addDoc(chatbotsRef, chatbotData);
    return docRef.id;
  } catch (error) {
    console.error('Error creating chatbot:', error);
    throw error;
  }
}

export async function getUserChatbots(userId: string): Promise<Chatbot[]> {
  try {
    const chatbotsRef = collection(getDb(), 'chatbots');
    const q = query(chatbotsRef, where('userId', '==', userId), orderBy('createdAt', 'desc'));

    const querySnapshot = await getDocs(q);
    const chatbots: Chatbot[] = [];

    querySnapshot.forEach(doc => {
      chatbots.push({
        id: doc.id,
        ...doc.data(),
      } as Chatbot);
    });

    return chatbots;
  } catch (error) {
    console.error('Error getting user chatbots:', error);
    return [];
  }
}

export async function updateChatbot(chatbotId: string, updates: Partial<Chatbot>): Promise<void> {
  try {
    // SECURITY: Whitelist mutable fields — prevent overwriting userId, status, createdAt
    const safeFields: Record<string, unknown> = {};
    if (updates.name !== undefined) safeFields.name = updates.name;
    if (updates.description !== undefined) safeFields.description = updates.description;
    if (updates.model !== undefined) safeFields.model = updates.model;
    if (updates.systemPrompt !== undefined) safeFields.systemPrompt = updates.systemPrompt;
    if (updates.temperature !== undefined) safeFields.temperature = updates.temperature;
    if (updates.maxTokens !== undefined) safeFields.maxTokens = updates.maxTokens;

    const chatbotRef = doc(getDb(), 'chatbots', chatbotId);
    await updateDoc(chatbotRef, {
      ...safeFields,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error updating chatbot:', error);
    throw error;
  }
}

export async function deleteChatbot(chatbotId: string): Promise<void> {
  try {
    const chatbotRef = doc(getDb(), 'chatbots', chatbotId);
    await deleteDoc(chatbotRef);
  } catch (error) {
    console.error('Error deleting chatbot:', error);
    throw error;
  }
}
