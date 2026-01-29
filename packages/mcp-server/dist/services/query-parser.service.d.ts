import { ParsedQuery } from '../types/library.types';
export declare class QueryParserService {
    private readonly COMMON_PATTERNS;
    private readonly ECOSYSTEM_PATTERNS;
    parseQuery(query: string, context?: any): ParsedQuery;
    private extractEntities;
    private detectEcosystem;
    private detectLanguage;
    private calculateConfidence;
}
//# sourceMappingURL=query-parser.service.d.ts.map