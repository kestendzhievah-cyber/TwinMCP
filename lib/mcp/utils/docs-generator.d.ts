export interface OpenAPISpec {
    openapi: string;
    info: {
        title: string;
        version: string;
        description?: string;
    };
    servers?: Array<{
        url: string;
        description?: string;
    }>;
    paths: Record<string, any>;
    components: {
        schemas: Record<string, any>;
        securitySchemes?: Record<string, any>;
        responses?: Record<string, any>;
    };
}
export declare class DocsGenerator {
    private baseUrl;
    constructor(baseUrl?: string);
    generateOpenAPI(): Promise<OpenAPISpec>;
    private generateSchemas;
    generateMarkdown(): Promise<string>;
    private getCategoryDescription;
    generateREADME(): Promise<string>;
}
export declare const docsGenerator: DocsGenerator;
//# sourceMappingURL=docs-generator.d.ts.map