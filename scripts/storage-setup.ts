import { StorageService } from '../src/config/storage';
import { DocumentStorageService } from '../src/services/document-storage.service';

async function setupStorage() {
  console.log('Setting up storage...');

  try {
    const storage = new StorageService();
    const documentStorage = new DocumentStorageService();

    const storageHealthy = await storage.healthCheck();
    console.log('Storage health:', storageHealthy);

    const docStorageHealthy = await documentStorage.healthCheck();
    console.log('Document storage health:', docStorageHealthy);

    const storageInfo = storage.getStorageInfo();
    console.log('Storage info:', storageInfo);

    const testKey = 'setup-test.txt';
    await storage.uploadFile(testKey, 'Storage setup test');
    const content = await storage.downloadFileAsString(testKey);
    console.log('Test upload/download successful:', content === 'Storage setup test');
    
    await storage.deleteFile(testKey);

    console.log('Storage setup completed successfully!');
  } catch (error) {
    console.error('Storage setup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  setupStorage();
}
