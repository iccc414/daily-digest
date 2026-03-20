// ============================================================
// Google Drive フォルダ階層管理
// ROOT / YYYY / YYYY-MM の構造を自動生成
// ============================================================

import { google } from 'googleapis';

function getAuth() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('GOOGLE_OAUTH_CLIENT_ID / CLIENT_SECRET / REFRESH_TOKEN are not set');
  }
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

/**
 * ドキュメントの保存先フォルダ ID を返す
 * DRIVE_FOLDER_ID（Daily Music Digest）直下に直接保存する
 */
export async function getOrCreateDailyFolder(_dateStr: string): Promise<string> {
  const rootId = process.env.DRIVE_FOLDER_ID;
  if (!rootId) throw new Error('DRIVE_FOLDER_ID is not set');
  console.log(`[drive] Using folder: ${rootId}`);
  return rootId;
}


/**
 * Google Doc ファイルを指定フォルダに移動する
 * （Doc は作成時にルートに置かれるため）
 */
export async function moveFileToFolder(
  fileId: string,
  targetFolderId: string
): Promise<void> {
  const auth = getAuth();
  const drive = google.drive({ version: 'v3', auth });

  // 現在の親フォルダを取得
  const file = await drive.files.get({ fileId, fields: 'parents' });
  const currentParents = (file.data.parents ?? []).join(',');

  // 移動
  await drive.files.update({
    fileId,
    addParents: targetFolderId,
    removeParents: currentParents,
    fields: 'id, parents',
  });

  console.log(`[drive] Moved file ${fileId} to folder ${targetFolderId}`);
}
