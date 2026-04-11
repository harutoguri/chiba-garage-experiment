import mysql from 'mysql2/promise';

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  // 車両の表示順序を確認（APIと同じ順序: displayOrder ASC, createdAt DESC）
  const [vehicles] = await connection.execute("SELECT id, title, displayOrder, createdAt FROM vehicles WHERE isPublished = 1 ORDER BY displayOrder ASC, createdAt DESC LIMIT 5");
  console.log("Vehicles (API order):", JSON.stringify(vehicles, null, 2));
  
  // 最初の車両のメディアを確認
  const firstVehicleId = (vehicles as any[])[0]?.id;
  if (firstVehicleId) {
    const [media] = await connection.execute("SELECT id, vehicleId, type, url, isMain, displayOrder FROM vehicle_media WHERE vehicleId = ?", [firstVehicleId]);
    console.log(`Media for vehicleId ${firstVehicleId}:`, JSON.stringify(media, null, 2));
  }
  
  await connection.end();
}

main().catch(console.error);
