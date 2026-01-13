import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

async function runMigration() {
  const db = new Pool({ connectionString: process.env['DATABASE_URL'] });
  
  try {
    console.log('Starting search features migration...');
    
    // Read the migration file
    const migrationPath = join(__dirname, '../prisma/migrations/add_search_features.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    // Execute migration
    await db.query(migrationSQL);
    
    console.log('✅ Search features migration completed successfully');
    
    // Update search vectors for existing libraries
    console.log('Updating search vectors for existing libraries...');
    
    const updateResult = await db.query(`
      UPDATE libraries 
      SET search_vector = 
        setweight(to_tsvector('english', COALESCE(name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(display_name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(language, '')), 'C')
      WHERE search_vector IS NULL
    `);
    
    console.log(`✅ Updated search vectors for ${updateResult.rowCount} libraries`);
    
    // Insert some sample tags if they don't exist
    console.log('Ensuring sample tags exist...');
    
    const sampleTags = [
      ['react', 'frontend', 'React framework', '#61dafb'],
      ['vue', 'frontend', 'Vue.js framework', '#4fc08d'],
      ['angular', 'frontend', 'Angular framework', '#dd0031'],
      ['express', 'backend', 'Express.js server', '#000000'],
      ['typescript', 'language', 'TypeScript language', '#3178c6'],
      ['javascript', 'language', 'JavaScript language', '#f7df1e'],
      ['nodejs', 'runtime', 'Node.js runtime', '#339933'],
      ['testing', 'category', 'Testing frameworks', '#c21325'],
      ['styling', 'category', 'CSS and styling', '#ff6b6b']
    ];
    
    for (const [name, category, description, color] of sampleTags) {
      await db.query(`
        INSERT INTO library_tags (name, category, description, color)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (name) DO NOTHING
      `, [name, category, description, color]);
    }
    
    console.log('✅ Sample tags ensured');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await db.end();
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export { runMigration };
