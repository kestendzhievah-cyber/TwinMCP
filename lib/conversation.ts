import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';

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

export async function getConversationHistory(conversationId: string): Promise<Conversation | null> {
  try {
    const conversationRef = doc(db, 'conversations', conversationId);
    const conversationSnap = await getDoc(conversationRef);

    if (!conversationSnap.exists()) {
      return null;
    }

    return {
      id: conversationSnap.id,
      ...conversationSnap.data()
    } as Conversation;
  } catch (error) {
    console.error('Error getting conversation history:', error);
    return null;
  }
}

export async function createConversation(chatbotId: string, visitorId: string): Promise<string> {
  try {
    const conversationsRef = collection(db, 'conversations');
    const conversationData = {
      chatbotId,
      visitorId,
      messages: [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    const docRef = await addDoc(conversationsRef, conversationData);
    return docRef.id;
  } catch (error) {
    console.error('Error creating conversation:', error);
    throw error;
  }
}

export async function addMessageToConversation(
  conversationId: string,
  message: Omit<Message, 'timestamp'>
): Promise<string> {
  try {
    const conversationRef = doc(db, 'conversations', conversationId);
    const conversationSnap = await getDoc(conversationRef);

    if (!conversationSnap.exists()) {
      throw new Error('Conversation not found');
    }

    const messages = conversationSnap.data().messages || [];
    const newMessage = {
      ...message,
      timestamp: Timestamp.now()
    };

    messages.push(newMessage);

    await updateDoc(conversationRef, {
      messages,
      updatedAt: Timestamp.now()
    });

    return `msg_${Date.now()}_${messages.length - 1}`;
  } catch (error) {
    console.error('Error adding message to conversation:', error);
    throw error;
  }
}
