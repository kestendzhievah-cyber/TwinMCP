import { Timestamp } from 'firebase/firestore';
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
interface CreateChatbotRequest {
    name: string;
    description: string;
    model: string;
    systemPrompt: string;
    temperature: number;
    maxTokens: number;
}
export declare function getUserProfile(userId: string): Promise<User | null>;
export declare function getChatbot(chatbotId: string): Promise<Chatbot | null>;
export declare function createChatbot(userId: string, data: CreateChatbotRequest): Promise<string>;
export declare function getUserChatbots(userId: string): Promise<Chatbot[]>;
export declare function updateChatbot(chatbotId: string, updates: Partial<Chatbot>): Promise<void>;
export declare function deleteChatbot(chatbotId: string): Promise<void>;
export {};
//# sourceMappingURL=chatbot.d.ts.map