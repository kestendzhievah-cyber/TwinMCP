import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';

interface CreateChatbotRequest {
  name: string;
  description: string;
  model: string;
  systemPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

interface Chatbot {
  id: string;
  userId: string;
  name: string;
  description: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  status: string;
  publicUrl: string;
  conversationsCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

function generateAgentId(): string {
  return 'agent_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Fonction pour créer un agent
export async function createAgent(userId: string, data: CreateChatbotRequest): Promise<Chatbot> {
  try {
    const agentsRef = collection(db, 'agents');
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
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const docRef = await addDoc(agentsRef, agentData);

    return {
      id: docRef.id,
      ...agentData,
    };
  } catch (error) {
    console.error('Error creating agent:', error);
    throw error;
  }
}

export async function getAgent(agentId: string): Promise<Chatbot | null> {
  try {
    const agentRef = doc(db, 'agents', agentId);
    const agentSnap = await getDoc(agentRef);

    if (!agentSnap.exists()) {
      return null;
    }

    return {
      id: agentSnap.id,
      ...agentSnap.data()
    } as Chatbot;
  } catch (error) {
    console.error('Error getting agent:', error);
    return null;
  }
}

export async function updateAgent(agentId: string, data: Partial<CreateChatbotRequest>): Promise<void> {
  try {
    const agentRef = doc(db, 'agents', agentId);
    await updateDoc(agentRef, {
      ...data,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error updating agent:', error);
    throw error;
  }
}

export async function deleteAgent(agentId: string): Promise<void> {
  try {
    const agentRef = doc(db, 'agents', agentId);
    await deleteDoc(agentRef);
  } catch (error) {
    console.error('Error deleting agent:', error);
    throw error;
  }
}
