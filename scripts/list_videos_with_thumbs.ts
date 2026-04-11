import mysql from 'mysql2/promise';

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  const [rows] = await connection.execute(
    "SELECT id, bunnyVideoId, thumbnailUrl FROM vehicle_media WHERE type = 'video' AND bunnyVideoId IS NOT NULL ORDER BY id"
  );
  console.log(JSON.stringify(rows, null, 2));
  console.log(`Total: ${(rows as any[]).length} videos`);
  await connection.end();
}

main().catch(console.error);
