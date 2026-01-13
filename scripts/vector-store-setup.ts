import { VectorStoreService } from '../src/services/vector-store.service';

async function setupVectorStore() {
  console.log('Setting up vector store...');

  try {
    const vectorStore = new VectorStoreService();
    await vectorStore.initialize();

    // Vérifier le health check
    const isHealthy = await vectorStore.healthCheck();
    console.log('Vector store health:', isHealthy);

    // Obtenir les stats
    const stats = await vectorStore.getStats();
    console.log('Vector store stats:', JSON.stringify(stats, null, 2));

    console.log('Vector store setup completed!');
  } catch (error) {
    console.error('Vector store setup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  setupVectorStore();
}
