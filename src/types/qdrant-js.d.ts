declare module 'qdrant-js' {
  export class QdrantClient {
    constructor(options: { url: string; apiKey?: string });
    
    getCollections(): Promise<{ collections: Array<{ name: string }> }>;
    
    createCollection(name: string, config: {
      vectors: { size: number; distance: string };
      optimizers_config?: { default_segment_number?: number };
      replication_factor?: number;
    }): Promise<void>;
    
    upsert(collectionName: string, data: { points: any[] }): Promise<void>;
    
    search(collectionName: string, query: {
      vector: { name: string; vector: number[] };
      limit: number;
      with_payload: boolean;
      with_vector: boolean;
      filter?: any;
    }): Promise<{ result: any[] }>;
    
    delete(collectionName: string, data: { points?: string[]; filter?: any }): Promise<void>;
    
    getCollection(collectionName: string): Promise<{ result: any }>;
  }
}
