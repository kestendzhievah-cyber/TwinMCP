import { DownloadManagerService } from '../src/services/download-manager.service';
import { STORAGE_CONFIG } from '../src/config/download.config';
import { DownloadTask } from '../src/types/download.types';

describe('DownloadManagerService', () => {
  let service: DownloadManagerService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };

    service = new DownloadManagerService(
      mockDb,
      STORAGE_CONFIG
    );
  });

  describe('createDownloadTask', () => {
    it('should create and queue download task', async () => {
      const task = {
        type: 'github' as const,
        source: { owner: 'facebook', repository: 'react' },
        options: { 
          shallow: true, 
          includeDocs: true, 
          includeTests: false, 
          includeExamples: true, 
          maxDepth: 5, 
          excludePatterns: [] 
        },
        priority: 'normal' as const,
        metadata: {
          size: 0,
          files: 0,
          duration: 0
        }
      };

      mockDb.query.mockResolvedValue({ rows: [] });

      const taskId = await service.createDownloadTask(task);

      expect(taskId).toBeDefined();
      expect(typeof taskId).toBe('string');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO download_tasks'),
        expect.any(Array)
      );
    });
  });

  describe('getDownloadStatus', () => {
    it('should return task status for existing task', async () => {
      const mockTask: DownloadTask = {
        id: 'test-task-id',
        type: 'github',
        source: { owner: 'facebook', repository: 'react' },
        options: { 
          shallow: true, 
          includeDocs: true, 
          includeTests: false, 
          includeExamples: true, 
          maxDepth: 5, 
          excludePatterns: [] 
        },
        priority: 'normal',
        status: 'completed',
        progress: { downloaded: 100, total: 100, percentage: 100, currentFile: '' },
        metadata: { size: 1000, files: 50, duration: 5000 },
        createdAt: new Date(),
        retryCount: 0
      };

      mockDb.query.mockResolvedValue({ 
        rows: [{
          ...mockTask,
          source: JSON.stringify(mockTask.source),
          options: JSON.stringify(mockTask.options),
          progress: JSON.stringify(mockTask.progress),
          metadata: JSON.stringify(mockTask.metadata)
        }] 
      });

      const result = await service.getDownloadStatus('test-task-id');

      expect(result).toBeDefined();
      expect(result?.id).toBe('test-task-id');
      expect(result?.status).toBe('completed');
    });

    it('should return null for non-existing task', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await service.getDownloadStatus('non-existing-id');

      expect(result).toBeNull();
    });
  });

  describe('getDownloadQueue', () => {
    it('should return download queue with stats', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          status: 'pending',
          source: JSON.stringify({ owner: 'test', repository: 'repo' }),
          options: JSON.stringify({ shallow: true }),
          progress: JSON.stringify({ downloaded: 0, total: 100, percentage: 0, currentFile: '' }),
          metadata: JSON.stringify({ size: 0, files: 0, duration: 0 })
        }
      ];

      mockDb.query
        .mockResolvedValueOnce({ rows: mockTasks.filter(t => t.status === 'pending') })
        .mockResolvedValueOnce({ rows: mockTasks.filter(t => t.status === 'downloading') })
        .mockResolvedValueOnce({ rows: mockTasks.filter(t => t.status === 'completed') })
        .mockResolvedValueOnce({ rows: mockTasks.filter(t => t.status === 'failed') })
        .mockResolvedValueOnce({ 
          rows: [{
            total_tasks: '1',
            completed_tasks: '0',
            failed_tasks: '0',
            avg_download_time: '1000',
            total_downloaded_size: '0'
          }]
        });

      const queue = await service.getDownloadQueue();

      expect(queue).toBeDefined();
      expect(queue.pending).toHaveLength(1);
      expect(queue.stats).toBeDefined();
      expect(queue.stats.totalTasks).toBe(1);
    });
  });
});
