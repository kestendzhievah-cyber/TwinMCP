import { z } from 'zod';
import { ValidationResult } from '../core/types';
export declare class InputValidator {
    private schemas;
    private globalSchemas;
    registerSchema(toolId: string, schema: z.ZodSchema): void;
    registerGlobalSchema(name: string, schema: z.ZodSchema): void;
    validate(toolId: string, args: any): Promise<ValidationResult>;
    validateGlobal(name: string, data: any): Promise<ValidationResult>;
    sanitize(input: any): any;
    securityValidate(input: any): Promise<ValidationResult>;
    private checkForSecurityIssues;
    private containsScript;
    private containsSQLInjection;
    private containsPathTraversal;
    private sanitizeString;
    private formatValidationMessage;
    validateBatch(toolArgs: Array<{
        toolId: string;
        args: any;
    }>): Promise<{
        results: Array<{
            toolId: string;
            validation: ValidationResult;
        }>;
        overallSuccess: boolean;
    }>;
    getSchema(toolId: string): z.ZodSchema | null;
    getAllSchemas(): Array<{
        toolId: string;
        schema: z.ZodSchema;
    }>;
    clearSchemas(): void;
}
export declare const validator: InputValidator;
export declare const globalSchemas: {
    pagination: z.ZodObject<{
        limit: z.ZodDefault<z.ZodNumber>;
        offset: z.ZodDefault<z.ZodNumber>;
        sort: z.ZodOptional<z.ZodString>;
        order: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
    }, "strip", z.ZodTypeAny, {
        limit: number;
        offset: number;
        order: "asc" | "desc";
        sort?: string | undefined;
    }, {
        sort?: string | undefined;
        limit?: number | undefined;
        offset?: number | undefined;
        order?: "asc" | "desc" | undefined;
    }>;
    dateRange: z.ZodEffects<z.ZodObject<{
        startDate: z.ZodString;
        endDate: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        startDate: string;
        endDate: string;
    }, {
        startDate: string;
        endDate: string;
    }>, {
        startDate: string;
        endDate: string;
    }, {
        startDate: string;
        endDate: string;
    }>;
    contactInfo: z.ZodObject<{
        name: z.ZodString;
        email: z.ZodString;
        phone: z.ZodOptional<z.ZodString>;
        company: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        email: string;
        name: string;
        phone?: string | undefined;
        company?: string | undefined;
    }, {
        email: string;
        name: string;
        phone?: string | undefined;
        company?: string | undefined;
    }>;
    apiKey: z.ZodString;
    jwt: z.ZodString;
};
//# sourceMappingURL=validator.d.ts.map