# AGENT.md — AI エージェント向け開発ガイドライン

このファイルは、AIアシスタントが本プロジェクトを扱う際に最初に読み込み、遵守すべきルールを定義します。

---

## プロジェクト概要

| 項目 | 内容 |
|---|---|
| プロジェクト名 | 野球部 トレーニング・数値管理アプリ |
| リポジトリ | `c:\Users\shant\OneDrive\ドキュメント\baseball_tr` |
| 技術スタック | HTML / Vanilla CSS / JavaScript / Firebase (Firestore, Auth) |
| デプロイ | Firebase Hosting |

---

## ドキュメント管理ルール

### 1. すべての文書は Markdown（.md）形式で作成する
- 設計書・仕様書・メモ・議事録・説明文など、テキストで記録するものはすべて `.md` 形式で保存する。
- ファイル名は内容を表す日本語または英語のスネークケース（例: `role_migration_plan.md`）。

### 2. 計画・設計書は `plan/` フォルダに保存する
- 実装計画、設計書、改善案などは必ず `plan/` フォルダ内に保存する。
- ファイル名に日付を付与する: `YYYY-MM-DD_タイトル.md`
- 例: `plan/2026-05-02_role_migration_plan.md`

### 3. 開発ログは `log/` フォルダに保存する
- 作業記録、変更履歴、バグ報告などは `log/` フォルダ内に保存する。
- ファイル名は日付を付与する: `YYYY-MM-DD_log.md`
- 例: `log/2026-05-02_log.md`
- 同日に複数の作業がある場合は同一ファイルに追記する。

### 4. ルートへの雑多なファイル配置を避ける
- ルートには `AGENT.md`, `README.md`, `index.html`, `app.js`, `styles.css`, `firebase-db.js` 等のコアファイルのみを置く。
- 計画・ログ・メモはそれぞれのフォルダに分類する。

---

## フォルダ構成

```
baseball_tr/
├── AGENT.md              ← このファイル（AIが最初に読む）
├── README.md             ← プロジェクト概要（人間向け）
├── index.html
├── app.js
├── styles.css
├── firebase-db.js
├── firestore.rules
├── firebase.json
├── plan/                 ← 実装計画・設計書
│   └── YYYY-MM-DD_*.md
└── log/                  ← 開発ログ・作業記録
    └── YYYY-MM-DD_log.md
```

---

## コーディングルール

### JavaScript
- 関数には JSDoc コメントを付ける（既存スタイルを維持）。
- Firebase 操作は必ず `firebase-db.js` のラッパー関数を経由する。直接 `db.collection()` を `app.js` から呼ばない。
- エラーは `console.error()` で記録し、ユーザーには `alert()` または UI メッセージで通知する。

### Firestore
- コレクション名: `players`, `weightRecords`, `trainingRecords`, `statsRecords`, `comments`
- ロール管理: `players/{uid}.role` フィールドで行う（`'master'` または `'player'`）。
- セキュリティルールは `firestore.rules` で管理し、変更後は必ず `firebase deploy --only firestore:rules` でデプロイする。

### CSS
- CSS 変数（カスタムプロパティ）を使い、ハードコードされた色値を避ける。
- クラス名は既存の命名規則（`btn-primary`, `badge`, `glass` など）に従う。

---

## AI への作業指示ルール

AIがタスクを実行する際は以下に従うこと:

1. **まず AGENT.md を確認** し、ルールを遵守する。
2. **計画を立ててから実装する**。実装前に変更対象ファイルと変更内容を明示する。
3. **既存コードを尊重する**。不要なリファクタリングや命名変更を行わない。
4. **作業後にログを記録する**。`log/YYYY-MM-DD_log.md` に作業内容・変更ファイル・確認ポイントを追記する。
5. **破壊的変更の前にバックアップを促す**。`git commit` を推奨する。

6. **AIがこれから行おうとする作業は必ず `plan/` に `.md` で保存すること**。
- 作業を始める前に、今回行う変更の目的、影響範囲、手順をまとめた Markdown ファイルを `plan/` フォルダに作成する（例: `plan/2026-06-06_update-firestore-rules.md`）。
- そのファイルには実行前の TODO（ステップ）と完了条件を明記し、作業を進めるごとに更新（追記または完了チェック）する。
- 作業完了後は `log/` に短い実行ログを追記し、`plan/` の該当ファイルに完了日時と結果（成功/失敗と問題点）を記載する。

---

## 現在進行中のタスク

| ステータス | タスク | 計画書 |
|---|---|---|
| 🔄 進行中 | マスター権限 → ロール付与方式への移行（案A） | `plan/2026-05-02_role_migration_plan.md` |

---

*最終更新: 2026-05-02*
