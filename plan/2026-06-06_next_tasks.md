# 今後のタスク計画（2026-06-06）

このファイルは、AIが今後実行するタスクをステップごとに分割した計画です。各ステップは完了時にこのファイルと `log/` に記録します。

## 高レベル目標
- ロール移行（案A）に沿った実装を安全に進める
- Firestore セキュリティルールの強化とデプロイ
- 運用・エラー管理を整備する

## ステップ一覧

1. 準備
   - `git commit -m "backup: before role migration"`
   - Firebase Console で初代マスターに `role: "master"` を手動設定

2. ルール更新（現在完了済）
   - `firestore.rules` を編集して最小権限化
   - ルールをローカルで確認（`firebase emulators:start` が利用可能なら推奨）
   - `firebase deploy --only firestore:rules`

3. クライアント側実装
   - `firebase-db.js` の `fbLoginUnified`, `fbUpdatePlayerRole` を確認/追加
   - `app.js` のログイン処理を `fbLoginUnified` に統一
   - UI（`index.html`）の統合

4. 移行手順
   - 既存 `masters_auth` のマスターを `players` に移行
   - 招待コードや deprecated なフローを削除

5. テスト & 検証
   - マスター権限での操作を確認（ロール変更、CSVエクスポート等）
   - 選手権限での読み書き制限を確認

6. 運用準備
   - `tasks/operations` に運用手順を追加（例: ルールデプロイ手順）
   - `tasks/errors` にバグ/エラー報告テンプレートを用意（済）

7. ログ記録
   - 各ステップ完了時に `log/YYYY-MM-DD_log.md` に記録

## 次アクション（短期）
- 直近で `plan/` に本計画を置いたので、次はクライアント側の `firebase-db.js` の変更を行います。

---

> 更新履歴
- 2026-06-06: 計画作成（作成者: AI）
