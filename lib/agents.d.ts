import { Timestamp } from 'firebase/firestore';
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
export declare function createAgent(userId: string, data: CreateChatbotRequest): Promise<Chatbot>;
export declare function getAgent(agentId: string): Promise<Chatbot | null>;
export declare function updateAgent(agentId: string, data: Partial<CreateChatbotRequest>): Promise<void>;
export declare function deleteAgent(agentId: string): Promise<void>;
export {};
//# sourceMappingURL=agents.d.ts.map