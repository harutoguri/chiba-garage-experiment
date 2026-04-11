import mysql from 'mysql2/promise';

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  // 車両の表示順序を確認
  const [vehicles] = await connection.execute("SELECT id, title, displayOrder FROM vehicles WHERE isPublished = 1 ORDER BY displayOrder, id LIMIT 5");
  console.log("Vehicles:", JSON.stringify(vehicles, null, 2));
  
  // 最初の車両のメディアを確認
  const [media] = await connection.execute("SELECT id, vehicleId, type, url, isMain, displayOrder FROM vehicle_media WHERE vehicleId = 30001");
  console.log("Media for vehicleId 30001:", JSON.stringify(media, null, 2));
  
  await connection.end();
}

main().catch(console.error);
