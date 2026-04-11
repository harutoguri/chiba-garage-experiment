import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL
  || 'mysql://33CD7BKpshztP9D.root:G8i7MWROfxFStFF4b671@gateway03.us-east-1.prod.aws.tidbcloud.com:4000/4WnCpiyyV5zEiwX2YFQ52L?ssl={"rejectUnauthorized":true}';

function parseDbUrl(url) {
  const match = url.match(/^mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
  if (!match) throw new Error('Invalid DATABASE_URL: ' + url);
  return {
    user: decodeURIComponent(match[1]),
    password: decodeURIComponent(match[2]),
    host: match[3],
    port: parseInt(match[4]),
    database: match[5],
    ssl: { rejectUnauthorized: true },
  };
}

const conn = await mysql.createConnection(parseDbUrl(DATABASE_URL));
console.log('Connected.');

// Check if column exists
const [cols] = await conn.execute("SHOW COLUMNS FROM vehicle_media LIKE 'thumbTs'");
if (cols.length > 0) {
  console.log('✓ thumbTs column already exists.');
} else {
  // Try TiDB/MySQL compatible syntax
  try {
    await conn.execute('ALTER TABLE vehicle_media ADD COLUMN thumbTs FLOAT DEFAULT NULL');
    console.log('✓ thumbTs column added successfully.');
  } catch (e) {
    // Try without IF NOT EXISTS
    if (e.message?.includes('Duplicate column') || e.message?.includes('already exists')) {
      console.log('✓ thumbTs column already exists (caught duplicate error).');
    } else {
      throw e;
    }
  }
}

// Verify
const [cols2] = await conn.execute("SHOW COLUMNS FROM vehicle_media");
const colNames = cols2.map(c => c.Field);
console.log('Columns:', colNames.join(', '));

await conn.end();
console.log('Done.');
