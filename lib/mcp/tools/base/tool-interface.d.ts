import { MCPTool } from '../../core/types';
export declare abstract class BaseTool implements MCPTool {
    abstract id: string;
    abstract name: string;
    abstract version: string;
    abstract category: 'communication' | 'productivity' | 'development' | 'data';
    abstract description: string;
    abstract author?: string;
    abstract tags: string[];
    abstract requiredConfig: string[];
    abstract optionalConfig?: string[];
    abstract inputSchema: any;
    abstract capabilities: {
        async: boolean;
        batch: boolean;
        streaming: boolean;
        webhook: boolean;
    };
    abstract rateLimit?: {
        requests: number;
        period: string;
        strategy: 'fixed' | 'sliding' | 'token-bucket';
    };
    abstract cache?: {
        enabled: boolean;
        ttl: number;
        key: (args: any) => string;
        strategy: 'memory' | 'redis' | 'hybrid';
    };
    abstract validate(args: any): Promise<{
        success: boolean;
        errors?: Array<{
            path: string;
            message: string;
        }>;
        data?: any;
    }>;
    abstract execute(args: any, config: any): Promise<{
        success: boolean;
        data?: any;
        error?: string;
        metadata?: any;
    }>;
    beforeExecute?(args: any): Promise<any>;
    afterExecute?(result: any): Promise<any>;
    onError?(error: Error): Promise<void>;
}
//# sourceMappingURL=tool-interface.d.ts.map