import { Timestamp } from 'firebase/firestore';
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
export declare function getConversationHistory(conversationId: string): Promise<Conversation | null>;
export declare function createConversation(chatbotId: string, visitorId: string): Promise<string>;
export declare function addMessageToConversation(conversationId: string, message: Omit<Message, 'timestamp'>): Promise<string>;
export {};
//# sourceMappingURL=conversation.d.ts.map