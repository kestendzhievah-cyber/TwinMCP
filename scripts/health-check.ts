import { databaseHealthCheck } from '../src/config/database';
import { redisHealthCheck } from '../src/config/redis';

async function healthCheck() {
  console.log('🔍 Checking system health...\n');

  const checks = [
    {
      name: 'PostgreSQL',
      check: databaseHealthCheck,
      emoji: '🐘',
    },
    {
      name: 'Redis',
      check: redisHealthCheck,
      emoji: '🔴',
    },
  ];

  let allHealthy = true;

  for (const { name, check, emoji } of checks) {
    try {
      const isHealthy = await check();
      const status = isHealthy ? '✅ Healthy' : '❌ Unhealthy';
      console.log(`${emoji} ${name}: ${status}`);
      
      if (!isHealthy) {
        allHealthy = false;
      }
    } catch (error) {
      console.log(`${emoji} ${name}: ❌ Error - ${error}`);
      allHealthy = false;
    }
  }

  console.log('\n' + '='.repeat(50));
  
  if (allHealthy) {
    console.log('🎉 All systems are healthy!');
    process.exit(0);
  } else {
    console.log('⚠️  Some systems are unhealthy. Check the logs above.');
    process.exit(1);
  }
}

if (require.main === module) {
  healthCheck();
}

export { healthCheck };
