/**
 * 前セッションでS3にアップロード済みの無加工サムネイルURLでDBを更新する
 */
import mysql from 'mysql2/promise';

const updates: { dbId: number; cdnUrl: string }[] = [
  { dbId: 30003, cdnUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663305386043/GhaxXHoPIsybXkzn.jpg" },
  { dbId: 30020, cdnUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663305386043/lsQXzdGlFfIMOBrB.jpg" },
  { dbId: 570002, cdnUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663305386043/BAhtnOZBhrpvledA.jpg" },
  { dbId: 570003, cdnUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663305386043/JQoLkQIYRiuKfcXA.jpg" },
  { dbId: 570004, cdnUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663305386043/SMONxpDtkymeANGA.jpg" },
  { dbId: 570005, cdnUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663305386043/bHSiwwMpTBzjnJkx.jpg" },
  { dbId: 570006, cdnUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663305386043/DQOBNWlDCdfTrDzp.jpg" },
  { dbId: 570007, cdnUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663305386043/oCSFzNdJzhnqZmfL.jpg" },
  { dbId: 570009, cdnUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663305386043/spcAZwymoTWgHWrP.jpg" },
  { dbId: 570010, cdnUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663305386043/CmglVJOnDJsLPXbE.jpg" },
  { dbId: 570011, cdnUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663305386043/YbaDRpLeLtXKfibU.jpg" },
  { dbId: 600001, cdnUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663305386043/XhIiHYdRiwInXIDq.jpg" },
  { dbId: 600002, cdnUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663305386043/DPrCAumwyXSTCvvP.jpg" },
  { dbId: 600003, cdnUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663305386043/GACQhHRXCBHZbuiW.jpg" },
  { dbId: 600005, cdnUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663305386043/JTQTwZIIueZSodXM.jpg" },
  { dbId: 600006, cdnUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663305386043/EIzBsCWMlBpFazJr.jpg" },
  { dbId: 600007, cdnUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663305386043/GllMlvqnlPYNxTRQ.jpg" },
  { dbId: 600008, cdnUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663305386043/NwTVoiCDRORJClgM.jpg" },
];

async function main() {
  console.log('=== DB更新: 無加工サムネイルURL ===\n');
  
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  
  for (const { dbId, cdnUrl } of updates) {
    await connection.execute(
      'UPDATE vehicle_media SET thumbnailUrl = ? WHERE id = ?',
      [cdnUrl, dbId]
    );
    console.log(`[${dbId}] Updated: ${cdnUrl.substring(cdnUrl.lastIndexOf('/') + 1)}`);
  }
  
  console.log(`\n=== ${updates.length}件更新完了 ===`);
  await connection.end();
}

main().catch(console.error);
