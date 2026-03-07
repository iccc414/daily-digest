// OAuth2 Refresh Token取得スクリプト（手動コード入力方式）
// 使い方:
//   GOOGLE_OAUTH_CLIENT_ID=xxx GOOGLE_OAUTH_CLIENT_SECRET=yyy node scripts/get-refresh-token.js
// または .env に設定してから:
//   node -r dotenv/config scripts/get-refresh-token.js
const { google } = require('googleapis');
const readline = require('readline');

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Error: GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET must be set.');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: [
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/spreadsheets',
  ],
});

console.log('\n以下のURLをブラウザで開いてください:');
console.log('\n' + authUrl + '\n');
console.log('Googleアカウントでログインして「許可」をクリックすると、');
console.log('画面にコード（英数字の文字列）が表示されます。');
console.log('そのコードをここに貼り付けてEnterを押してください:\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('コード: ', async (code) => {
  rl.close();
  try {
    const { tokens } = await oauth2Client.getToken(code.trim());
    console.log('\n===== REFRESH TOKEN (コピーしてください) =====');
    console.log(tokens.refresh_token);
    console.log('===============================================\n');
  } catch (e) {
    console.error('エラー:', e.message);
  }
});
