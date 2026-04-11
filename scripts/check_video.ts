import mysql from 'mysql2/promise';

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  const [rows] = await connection.execute("SELECT id, vehicleId, type, url FROM vehicle_media WHERE type = 'video' ORDER BY id LIMIT 5");
  console.log(JSON.stringify(rows, null, 2));
  await connection.end();
}

main().catch(console.error);
