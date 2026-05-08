# 案A 実装計画：統一ログイン＋ロールフィールド方式

> **方針**: 既存の `players` コレクションに `role` フィールドを追加し、マスターも同コレクションに収容する。
> 各ステップは独立してテスト可能な粒度に分割。

作成日: 2026-05-02

---

## 全体フロー

```
Phase 0: 準備・バックアップ
Phase 1: Firestore ルール更新（バックエンド）
Phase 2: firebase-db.js に統一ログイン関数を追加
Phase 3: app.js のロール判定ロジック変更
Phase 4: index.html のログイン UI 統合
Phase 5: ロール付与 UI の追加
Phase 6: クリーンアップ（旧コード削除）
```

---

## Phase 0：準備・バックアップ

### Step 0-1：現在のコードをコミットしてバックアップ

- [ ] `git add .` と `git commit -m "backup: before role-system migration"`
- [ ] タグを打っておく: `git tag v-before-role-migration`

### Step 0-2：Firestore コンソールで初代マスターを手動設定

- [ ] Firebase Console → Firestore → `players` コレクションを開く
- [ ] 自分のアカウント UID のドキュメントを選択
- [ ] `role` フィールドを `"master"` に手動変更（これが最初のマスター）

- ※ 以降は UI からロールを付与できるようになる

### Step 0-3：`masters_auth` の既存ユーザーを `players` に移行（手動）

- [ ] Firebase Console → Firestore → `masters_auth` コレクションを確認
- [ ] 既存マスターアカウントの UID をメモ
- [ ] 同 UID を `players` コレクションに作成し、`role: "master"` を設定
- [ ] 同時に `name`, `email` 等も転記しておく

> ✅ **確認ポイント**: `players/{masterUID}` に `role: "master"` が存在することを確認

---

## Phase 1：Firestore ルール更新

### Step 1-1：`isMaster()` の判定ロジックを変更

**ファイル**: `firestore.rules`

変更前:

```js
function isMaster() {
  return request.auth != null &&
    exists(/databases/$(database)/documents/masters_auth/$(request.auth.uid));
}
```

変更後:

```js
function isMaster() {
  return request.auth != null &&
    get(/databases/$(database)/documents/players/$(request.auth.uid)).data.role == 'master';
}
```

### Step 1-2：`masters_auth` コレクションを完全ロック

- [ ] 以下のルールに変更する

```js
match /masters_auth/{uid} {
  allow read, write: if false;
}
```

### Step 1-3：`players` の write 権限を確認

- [ ] `allow write: if isMaster()` が維持されていることを確認

### Step 1-4：Firebase CLI でルールをデプロイ

- [ ] `firebase deploy --only firestore:rules`

> ✅ **確認ポイント**: マスターアカウントで `players` コレクションへの write が通るか Firestore コンソールで確認

---

## Phase 2：firebase-db.js に統一ログイン関数を追加

### Step 2-1：`fbLoginUnified(playerId, password)` を新規追加

```js
window.fbLoginUnified = async function(playerId, password) {
    const playerDoc = await db.collection("players").doc(playerId).get();
    if (!playerDoc.exists) throw new Error('ユーザーが見つかりません。');

    const email = playerDoc.data().email;
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    const uid = userCredential.user.uid;

    // role を含む全データを返す
    return { uid, ...playerDoc.data() };
};
```

### Step 2-2：`fbGetCurrentUserRole(uid)` を新規追加

```js
window.fbGetCurrentUserRole = async function(uid) {
    const doc = await db.collection("players").doc(uid).get();
    if (!doc.exists) return 'player';
    return doc.data().role || 'player';
};
```

### Step 2-3：`fbUpdatePlayerRole(uid, newRole)` を新規追加

```js
window.fbUpdatePlayerRole = async function(uid, newRole) {
    if (!['master', 'player'].includes(newRole)) {
        throw new Error('無効なロールです。');
    }
    await db.collection("players").doc(uid).update({ role: newRole });
};
```

### Step 2-4：`fbAddPlayer` の `role` フィールドを確認

- [ ] 既存の選手登録関数に `role: 'player'` が含まれていることを確認

> ✅ **確認ポイント**: ブラウザコンソールで `fbLoginUnified` をテスト実行し、`role` フィールドが返ることを確認

---

## Phase 3：app.js のロール判定ロジック変更

### Step 3-1：`setRole()` の動作を確認

- [ ] 現行: `localStorage.setItem('userRole', role)` → このまま維持でOK
- [ ] ログイン時に Firestore から読んだ `role` を渡して呼ぶように変更することを確認

### Step 3-2：マスターログイン処理を修正（`btn-master-login` リスナー）

変更前: `fbLoginMaster(id, pass)` を呼ぶ（`masters_auth` 参照）
変更後:

```js
const userData = await window.fbLoginUnified(selectedId, password);
setRole(userData.role || 'player');
localStorage.setItem('currentPlayerId', userData.uid);
if (userData.role === 'master') {
    localStorage.setItem('masterName', userData.name);
}
```

### Step 3-3：選手ログイン処理を修正（`btn-login` リスナー）

- [ ] `fbLoginPlayer` → `fbLoginUnified` に統一
- [ ] ログイン後に `userData.role` で `setRole()` を呼ぶ
- [ ] 選手・マスター問わず `currentPlayerId` に `uid` を保存

### Step 3-4：`applyRoleVisibility()` の role 取得元を確認

- [ ] 現行: `localStorage.getItem('userRole')` → このままでOK
- [ ] localStorage の値が必ず Firestore から取得した role であることを保証する

### Step 3-5：`updateSidebarProfile()` のマスター判定を確認

- [ ] 既に `role === 'master'` で比較しているため、変更不要なことを確認

### Step 3-6：ログアウト処理を確認

- [ ] `localStorage.removeItem('userRole')` が呼ばれているか確認
- [ ] `localStorage.removeItem('masterName')` が呼ばれているか確認
- [ ] `localStorage.removeItem('currentPlayerId')` が呼ばれているか確認

> ✅ **確認ポイント**: 選手でログイン → `userRole=player` / マスターでログイン → `userRole=master` が localStorage に入ることを確認

---

## Phase 4：index.html のログイン UI 統合

### Step 4-1：方針確定

- `auth-login-view` → 選手・マスター共通の統一ログイン画面に変更
- `auth-master-view` → 削除（Phase 6 でクリーンアップ）
- `auth-master-register-view` → 削除（Phase 6 でクリーンアップ）

### Step 4-2：ドロップダウンをマスター含む全ユーザー対応に変更

- [ ] `showAuthModal()` の `fbGetPlayers()` は `role` を問わず全員取得するのでそのまま
- [ ] `role: 'master'` のユーザーが除外されていないことを確認
- [ ] 表示ラベルを整形: `${p.name} (${p.role === 'master' ? '管理者' : p.position} / #${p.number || '-'})`

### Step 4-3：「マスター権限でログイン」リンクを削除

- [ ] HTML から `<a href="#" id="link-master">マスター権限でログイン</a>` を削除

### Step 4-4：モーダルタイトルを変更

- [ ] `<h2 id="auth-title">プレイヤー選択</h2>` → `<h2 id="auth-title">ログイン</h2>`

### Step 4-5：統一ログインボタンの処理をマスター対応にする

- [ ] ログイン後に `userData.role` を見て `setRole()` を呼ぶ（Step 3-3 の変更と連動）

> ✅ **確認ポイント**: モーダルを開くとマスターアカウントもドロップダウンに表示され、ログインが通ること

---

## Phase 5：ロール付与 UI の追加

### Step 5-1：`renderPlayerList()` にロールバッジを追加

```js
`<span class="badge ${p.role === 'master' ? 'bg-orange' : 'bg-blue'} w-auto">
  ${p.role === 'master' ? '管理者' : '選手'}
</span>`
```

### Step 5-2：マスターのみ表示されるロール変更ドロップダウンを追加

```js
const isMe = p.id === window.fbAuth.currentUser?.uid;
`${currentRole === 'master' ? `
<select class="role-select glass-select" data-uid="${p.id}"
  ${isMe ? 'disabled title="自分自身のロールは変更できません"' : ''}>
  <option value="player" ${p.role !== 'master' ? 'selected' : ''}>選手</option>
  <option value="master" ${p.role === 'master' ? 'selected' : ''}>管理者</option>
</select>
` : ''}`
```

### Step 5-3：ロール変更の `change` イベントリスナーを `playerListEl` に追加

```js
playerListEl.addEventListener('change', async (e) => {
    if (!e.target.classList.contains('role-select')) return;
    const uid = e.target.dataset.uid;
    const newRole = e.target.value;
    const label = newRole === 'master' ? '管理者' : '選手';

    if (!confirm(`このユーザーのロールを「${label}」に変更しますか？`)) {
        await renderPlayerList();
        return;
    }

    try {
        await window.fbUpdatePlayerRole(uid, newRole);
        alert('ロールを変更しました。');
        await renderPlayerList();
    } catch (err) {
        alert('ロール変更に失敗しました: ' + err.message);
        await renderPlayerList();
    }
});
```

### Step 5-4：`styles.css` に `role-select` 用スタイルを追加

- [ ] disabled 状態のグレーアウト CSS を追加
- [ ] ドロップダウンが選手リスト UI に馴染むようにする

> ✅ **確認ポイント**: マスターでログインし、選手のロールをドロップダウンで変更 → Firestore の `role` フィールドが更新されること

---

## Phase 6：クリーンアップ

### Step 6-1：`index.html` から不要な HTML を削除

- [ ] `#auth-master-view` ブロック全体（line 527〜543）を削除
- [ ] `#auth-master-register-view` ブロック全体（line 545〜568）を削除
- [ ] `#link-master` リンク（line 585）を削除

### Step 6-2：`app.js` から不要なリスナー・コードを削除

- [ ] `btn-master-login` クリックリスナーを削除
- [ ] `btn-register-master` クリックリスナーを削除
- [ ] `initAuthNavListeners()` 内の master 関連ビュー参照を削除
- [ ] `authMasterView`, `authMasterRegisterView` 変数の参照を削除

### Step 6-3：`firebase-db.js` から旧関数を削除

- [ ] `fbLoginMaster()` を削除
- [ ] `fbRegisterMaster()` を削除

### Step 6-4：招待コード `admin2026` を削除

- [ ] `app.js` の `if (invite !== 'admin2026')` ブロックを削除

### Step 6-5：ログを記録する

- [ ] `log/2026-05-02_log.md` に変更日・変更内容・理由を記録

---

## 最終確認チェックリスト

- [ ] 選手アカウントで統一ログイン画面からログインできる
- [ ] マスターアカウントで統一ログイン画面からログインできる
- [ ] マスターでログインすると管理者 UI（CSV出力・選手管理など）が表示される
- [ ] マスターが選手管理タブでロールをドロップダウンから変更できる
- [ ] 自分自身のロールは変更できない（UI で disabled）
- [ ] 選手が Firestore 直接操作でロールを変更しようとすると拒否される（ルールで保護）
- [ ] 招待コード `admin2026` がコードのどこにも残っていない
- [ ] `masters_auth` を参照するコードが残っていない

---

## 変更ファイルサマリー

| ファイル            | 変更内容                                                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `firestore.rules` | `isMaster()` を `players` コレクション参照に変更。`masters_auth` を完全ロック                                         |
| `firebase-db.js`  | `fbLoginUnified`, `fbGetCurrentUserRole`, `fbUpdatePlayerRole` を追加。`fbLoginMaster`, `fbRegisterMaster` を削除 |
| `app.js`          | ログインリスナーを `fbLoginUnified` に統一、ロール付与 change イベント追加、旧マスターリスナー削除                        |
| `index.html`      | マスター専用ログイン UI を削除、統一ログイン画面に変更、タイトル変更                                                        |
| `styles.css`      | `role-select` のスタイル追加（disabled グレーアウトなど）                                                                 |

---

## 注意事項

⚠️ **Phase 1（Firestore ルール変更）を行う前に、必ず Step 0-2 で初代マスターの `role` フィールドを設定すること。**
先にルールを変更すると、`players` に `role: 'master'` がないマスターが締め出される。

💡 `fbGetCurrentUserRole()` は Firestore への読み取りが1回発生する。ログイン頻度は低いが、将来的にキャッシュする場合は `localStorage` の活用を検討。

💡 Step 0-3 の移行は急がなくてよい。旧 `masters_auth` ユーザーが新しい統一ログインを使えない間は、一時的に両方の認証フローを並走させることも可能。
