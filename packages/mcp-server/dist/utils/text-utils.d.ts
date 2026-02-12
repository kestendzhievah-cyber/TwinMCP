export declare class TextUtils {
    private static readonly STOP_WORDS;
    static normalizeQuery(query: string): string;
    static tokenize(query: string): string[];
    static isStopWord(token: string): boolean;
    static looksLikeLibraryName(token: string): boolean;
    static calculateTokenConfidence(token: string): number;
    private static isKnownLibrary;
    static calculateLevenshteinDistance(str1: string, str2: string): number;
    static areSimilar(str1: string, str2: string, threshold?: number): boolean;
}
//# sourceMappingURL=text-utils.d.ts.map