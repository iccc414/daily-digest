# Daily Music Digest

毎朝 7:00 JST に世界の音楽業界情報を自動収集・要約し、Google Docs として Google Drive に保存するシステム。

## 概要

- **情報源**: 16 の RSS フィード（Billboard, Pitchfork, Music Business Worldwide など）を並列取得
- **要約**: Claude API (Haiku) で日本語の構造化レポートを生成
- **出力**: Google Docs（5 セクション構成）を `Drive/YYYY/YYYY-MM/YYYY-MM-DD` に保存
- **スケジュール**: GitHub Actions cron（UTC 22:00 = JST 7:00）
- **コスト**: ~$0.42/月（約 65 円）

## レポート構成

```
YYYY-MM-DD
├── 1. Executive Summary    今日の最重要トピック
├── 2. Top News             記事ごとの要約 + 参照リンク
├── 3. Category Breakdown   芸術性 / 商業性 / トレンド / ビジネス / 周辺市場
├── 4. Signals & Insights   複数ソースから読み取れる変化・示唆
└── 5. Source List          全参照 URL 一覧
```

---

## セットアップ手順

### 前提条件

- Node.js 20+
- GitHub アカウント
- Google アカウント
- Anthropic API キー（[console.anthropic.com](https://console.anthropic.com)）

---

### Step 1: Google Cloud セットアップ

1. [console.cloud.google.com](https://console.cloud.google.com) でプロジェクトを作成
2. 以下の API を有効化:
   - **Google Docs API**
   - **Google Drive API**
   - **Google Sheets API**（ログ機能を使う場合）
3. 「IAM と管理」→「サービスアカウント」→「サービスアカウントを作成」
   - 名前: `daily-digest-writer`（任意）
   - ロール: なし（権限はフォルダ共有で付与）
4. 作成したサービスアカウントの「鍵」タブ → 「鍵を追加」→「JSON」でダウンロード
5. JSON ファイルの `client_email` をメモしておく

### Step 2: Google Drive フォルダ作成

1. Google Drive で「Daily Music Digest」フォルダを作成
2. フォルダを開き、「共有」からサービスアカウントのメールアドレス（`client_email`）に **編集者** 権限を付与
3. フォルダ URL からフォルダ ID を取得:
   ```
   https://drive.google.com/drive/folders/【ここがフォルダ ID】
   ```

### Step 3: GitHub リポジトリ設定

1. このリポジトリを GitHub に push
2. **Settings → Secrets and variables → Actions** で以下のシークレットを追加:

| Secret 名 | 値 |
|---|---|
| `CLAUDE_API_KEY` | Anthropic の API キー |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | サービスアカウント JSON を base64 エンコードした文字列 |
| `DRIVE_FOLDER_ID` | Step 2 で取得したフォルダ ID |
| `LOG_SHEET_ID` | ログ用スプレッドシートの ID（省略可） |

**base64 エンコード方法（Mac/Linux）:**
```bash
base64 -i service-account.json | tr -d '\n'
```
**Windows (PowerShell):**
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("service-account.json"))
```

### Step 4: ローカルでテスト実行

```bash
# 依存パッケージをインストール
npm install

# .env.example をコピーして編集
cp .env.example .env
# → .env に CLAUDE_API_KEY, GOOGLE_SERVICE_ACCOUNT_KEY, DRIVE_FOLDER_ID を設定

# テスト実行
npm run dev
```

### Step 5: 毎朝 7 時の自動実行を確認

GitHub Actions は `.github/workflows/daily-digest.yml` に `cron: '0 22 * * *'` が定義されている。
push 後、GitHub の「Actions」タブ → 「Daily Music Digest」→「Run workflow」で手動テスト実行できる。

---

## ファイル構成

```
├── src/
│   ├── index.ts          # エントリーポイント・全フェーズ制御
│   ├── config.ts         # 情報源・定数・プロンプトテンプレート（ここを編集）
│   ├── types.ts          # TypeScript 型定義
│   ├── fetcher.ts        # RSS フェッチ・フィルタ・重複排除
│   ├── summarizer.ts     # Claude API・バッチ要約・リトライ
│   ├── docWriter.ts      # Google Docs batchUpdate レポート生成
│   ├── driveManager.ts   # Drive フォルダ階層管理
│   └── logger.ts         # Google Sheet ログ記録
├── .github/
│   └── workflows/
│       └── daily-digest.yml   # GitHub Actions スケジュール設定
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

---

## 情報源の追加方法

[src/config.ts](src/config.ts) の `SOURCES` 配列に追記するだけ:

```typescript
{
  name: '新しいソース名',
  url: 'https://example.com/feed.rss',
  category: '音楽業界ニュース',  // または テック/AI, アート/ビジュアル, etc.
  language: 'en',
  priority: 2,                    // 1=最優先, 2=通常, 3=補足
  trustLevel: 'high',             // official, high, medium
},
```

---

## LLM モデルの変更

[src/config.ts](src/config.ts) の `CLAUDE_CONFIG.model` を変更:

```typescript
// コスト効率（推奨・~$0.014/日）
model: 'claude-haiku-4-5-20251001',

// 高品質（~$0.15/日）
model: 'claude-sonnet-4-6',
```

---

## コスト

| 項目 | 費用 |
|---|---|
| GitHub Actions | 無料（パブリックリポジトリ） / 月 ~150 分使用（プライベート 2,000 分枠） |
| Google Cloud API | 無料枠内 |
| Claude Haiku | ~$0.014/日（約 2 円） / ~$0.42/月（約 65 円） |

---

## トラブルシューティング

### Actions が実行されない
- GitHub の「Actions」タブでワークフローが有効になっているか確認（初回は手動で有効化が必要な場合あり）
- `workflow_dispatch` で手動実行してエラーを確認

### Google Docs が作成されない
- サービスアカウントの JSON を正しく base64 エンコードしているか確認
- Drive フォルダにサービスアカウントの編集権限があるか確認
- `DRIVE_FOLDER_ID` が正しいか確認

### 記事が 0 件になる
- RSS フィードの URL が生きているか確認（ブラウザで直接アクセス）
- `CONFIG.hoursLookback` を 48 に増やして再実行

### ログを確認する
- GitHub Actions の「Actions」タブ → 実行ログ
- `LOG_SHEET_ID` を設定していれば Google Sheet にも実行履歴が残る

---

## 将来の拡張案

- **Slack 通知**: `@slack/webhook` で Doc URL を朝 7 時に投稿
- **メール通知**: `nodemailer` で Doc URL をメール送信
- **週次サマリー**: 過去 7 日分の Doc を参照した週報生成
- **ソース信頼度スコアリング**: `trustLevel` を要約プロンプトに組み込み
- **Notion 二重保存**: Notion API への書き込みを追加
- **NotebookLM 連携**: 生成 Doc を NotebookLM のソースとして自動登録
