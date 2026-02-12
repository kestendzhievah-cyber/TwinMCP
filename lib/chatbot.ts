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
  Timestamp
} from 'firebase/firestore';
import { db as _db } from './firebase';
const db = _db!;

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
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return null;
    }

    return {
      id: userSnap.id,
      ...userSnap.data()
    } as User;
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
}

export async function getChatbot(chatbotId: string): Promise<Chatbot | null> {
  try {
    const chatbotRef = doc(db, 'chatbots', chatbotId);
    const chatbotSnap = await getDoc(chatbotRef);

    if (!chatbotSnap.exists()) {
      return null;
    }

    return {
      id: chatbotSnap.id,
      ...chatbotSnap.data()
    } as Chatbot;
  } catch (error) {
    console.error('Error getting chatbot:', error);
    return null;
  }
}

export async function createChatbot(userId: string, data: CreateChatbotRequest): Promise<string> {
  try {
    const chatbotsRef = collection(db, 'chatbots');
    const chatbotData = {
      ...data,
      userId,
      status: 'active',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
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
    const chatbotsRef = collection(db, 'chatbots');
    const q = query(
      chatbotsRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const chatbots: Chatbot[] = [];

    querySnapshot.forEach((doc) => {
      chatbots.push({
        id: doc.id,
        ...doc.data()
      } as Chatbot);
    });

    return chatbots;
  } catch (error) {
    console.error('Error getting user chatbots:', error);
    return [];
  }
}

export async function updateChatbot(
  chatbotId: string, 
  updates: Partial<Chatbot>
): Promise<void> {
  try {
    const chatbotRef = doc(db, 'chatbots', chatbotId);
    await updateDoc(chatbotRef, {
      ...updates,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Error updating chatbot:', error);
    throw error;
  }
}

export async function deleteChatbot(chatbotId: string): Promise<void> {
  try {
    const chatbotRef = doc(db, 'chatbots', chatbotId);
    await deleteDoc(chatbotRef);
  } catch (error) {
    console.error('Error deleting chatbot:', error);
    throw error;
  }
}
