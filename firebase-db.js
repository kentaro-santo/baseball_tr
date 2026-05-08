// Firebase Compat API Wrapper
const firebaseConfig = {
  apiKey: "AIzaSyAqelpCmCT9tY15O-3IQh8xYnDKMk8S_UI",
  authDomain: "baseball-training-app-8982a.firebaseapp.com",
  projectId: "baseball-training-app-8982a",
  storageBucket: "baseball-training-app-8982a.firebasestorage.app",
  messagingSenderId: "337777290763",
  appId: "1:337777290763:web:a3c1cf848fd06698f4210e"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Global Access for app.js
window.fbAuth = auth;
window.fbDb = db;

// Firebase API Wrapper functions

// Wait for auth to be ready
window.fbCheckAuthStatus = function(callback) {
  auth.onAuthStateChanged((user) => {
    callback(user);
  });
};

// Login with email
window.fbLoginUser = async function(email, password) {
  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    return { success: true, user: userCredential.user };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Player Login by ID and Password
window.fbLoginPlayer = async function(playerId, password) {
    try {
        // 1. Fetch the synthetic email for this player ID
        const playerDoc = await db.collection("players").doc(playerId).get();
        if (!playerDoc.exists) {
            throw new Error('選手データが見つかりません。');
        }
        
        const email = playerDoc.data().email;
        if (!email) {
            throw new Error('この選手にはログイン情報が設定されていません。');
        }

        // 2. Sign in with Firebase Auth
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        return { success: true, user: userCredential.user, playerData: playerDoc.data() };
    } catch (error) {
        console.error("Player Login Error:", error);
        throw error;
    }
}

// Register with email
window.fbRegisterUser = async function(email, password) {
  try {
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    return { success: true, user: userCredential.user };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Logout
window.fbLogoutUser = async function() {
  await auth.signOut();
}

// Players Collection
window.fbGetPlayers = async function() {
  const querySnapshot = await db.collection("players").get();
  const players = [];
  querySnapshot.forEach((doc) => {
    players.push({ id: doc.id, ...doc.data() });
  });
  return players;
}

window.fbAddPlayer = async function(playerData, password) {
    // 1. Create a synthetic email for the player
    // We use a combination of name and number to make it somewhat unique, 
    // but the real identifier is the UID.
    const email = `player_${Math.random().toString(36).substring(2, 11)}@baseball-tracker.internal`;
    
    try {
        // 2. Create Auth User
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const uid = userCredential.user.uid;

        // 3. Store player data using UID as document ID
        const finalPlayerData = {
            ...playerData,
            email: email, // Save the synthetic email for future logins if needed
            id: uid,
            plainPassword: password, // Saved locally for Master preview
            role: 'player',
            createdAt: new Date().toISOString()
        };
        
        await db.collection("players").doc(uid).set(finalPlayerData);
        return uid;
    } catch (err) {
        console.error("Player Registration Error:", err);
        throw err;
    }
}

window.fbUpdatePlayer = async function(id, data) {
  await db.collection("players").doc(id).update(data);
}

window.fbDeletePlayer = async function(id) {
  await db.collection("players").doc(id).delete();
}

// Records Generic Functions
window.fbGetRecords = async function(collectionName, playerId) {
  let q;
  if (playerId) {
      q = db.collection(collectionName).where("playerId", "==", playerId).orderBy("date", "asc");
  } else {
      q = db.collection(collectionName).orderBy("date", "asc");
  }
  
  try {
      const querySnapshot = await q.get();
      const records = [];
      querySnapshot.forEach((doc) => {
          records.push({ id: doc.id, ...doc.data() });
      });
      return records;
  } catch (e) {
      console.warn("Index creating... falling back to simple query", e);
      let fallbackQ = playerId ? db.collection(collectionName).where("playerId", "==", playerId) : db.collection(collectionName);
      const querySnapshot = await fallbackQ.get();
      let records = [];
      querySnapshot.forEach((doc) => {
          records.push({ id: doc.id, ...doc.data() });
      });
      return records.sort((a,b) => new Date(a.date) - new Date(b.date));
  }
}

window.fbAddRecord = async function(collectionName, data) {
  const docRef = await db.collection(collectionName).add(data);
  return docRef.id;
}

window.fbUpdateRecord = async function(collectionName, id, data) {
  await db.collection(collectionName).doc(id).update(data);
}

window.fbDeleteRecord = async function(collectionName, id) {
  await db.collection(collectionName).doc(id).delete();
}

// ----- Comments Functions -----
window.fbAddComment = async function(playerId, senderName, senderId, content) {
    const data = {
        playerId: playerId,
        senderName: senderName,
        senderId: senderId,
        content: content,
        date: new Date().toISOString(),
        isRead: false
    };
    const docRef = await db.collection('comments').add(data);
    return docRef.id;
}

window.fbGetComments = async function(playerId) {
    const snapshot = await db.collection('comments').where("playerId", "==", playerId).get();
    let comments = [];
    snapshot.forEach((doc) => {
        comments.push({ id: doc.id, ...doc.data() });
    });
    return comments.sort((a,b) => new Date(b.date) - new Date(a.date));
}

window.fbListenToComments = function(playerId, callback) {
    return db.collection('comments')
        .where("playerId", "==", playerId)
        .onSnapshot((snapshot) => {
            const comments = [];
            snapshot.forEach(doc => {
                comments.push({ id: doc.id, ...doc.data() });
            });
            // Sort by date ascending for chat (newest at bottom)
            comments.sort((a,b) => new Date(a.date) - new Date(b.date));
            callback(comments);
        }, (err) => {
            console.error("Listen to comments failed:", err);
        });
}

window.fbDeleteComment = async function(commentId) {
    await db.collection('comments').doc(commentId).delete();
}

window.fbUpdateComment = async function(commentId, data) {
    await db.collection('comments').doc(commentId).update(data);
}

// ----- Unified Auth Functions (Role-Based) -----

/**
 * Unified login for all users (master and player).
 * Fetches the user's document from the 'players' collection and returns it
 * including the 'role' field ('master' or 'player').
 */
window.fbLoginUnified = async function(playerId, password) {
    try {
        const playerDoc = await db.collection('players').doc(playerId).get();
        if (!playerDoc.exists) {
            throw new Error('ユーザーが見つかりません。');
        }

        const email = playerDoc.data().email;
        if (!email) {
            throw new Error('このアカウントにはログイン情報が設定されていません。');
        }

        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const uid = userCredential.user.uid;

        // Return full user data including role
        return { uid, ...playerDoc.data() };
    } catch (err) {
        console.error('Unified Login Error:', err);
        // Re-throw with user-friendly message for auth errors
        if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
            throw new Error('パスワードが間違っています。');
        }
        throw err;
    }
};

/**
 * Gets the role of the currently logged-in user from the 'players' collection.
 * Returns 'player' as fallback if the document doesn't exist.
 */
window.fbGetCurrentUserRole = async function(uid) {
    try {
        const doc = await db.collection('players').doc(uid).get();
        if (!doc.exists) return 'player';
        return doc.data().role || 'player';
    } catch (err) {
        console.error('Get Role Error:', err);
        return 'player';
    }
};

/**
 * Updates the role of a user. Only callable by masters (enforced by Firestore rules).
 * @param {string} uid - The UID of the user to update.
 * @param {string} newRole - 'master' or 'player'.
 */
window.fbUpdatePlayerRole = async function(uid, newRole) {
    if (!['master', 'player'].includes(newRole)) {
        throw new Error('無効なロールです。');
    }
    await db.collection('players').doc(uid).update({ role: newRole });
};

// ----- Legacy Master Auth Functions (@deprecated) -----
// These functions are kept for backward compatibility but should not be used.

/** @deprecated Use fbLoginUnified instead */
window.fbRegisterMaster = async function(masterId, name, password) {
    console.warn('fbRegisterMaster is deprecated. Use the role assignment UI instead.');
    throw new Error('この機能は廃止されました。マスターによるロール付与を使用してください。');
};

/** @deprecated Use fbLoginUnified instead */
window.fbLoginMaster = async function(masterId, password) {
    console.warn('fbLoginMaster is deprecated. Use fbLoginUnified instead.');
    throw new Error('この機能は廃止されました。統一ログインを使用してください。');
}
// ----- Account Settings Auth Functions -----
window.fbChangePassword = async function(currentPassword, newPassword) {
    const user = auth.currentUser;
    if (!user) throw new Error("未ログインです。");

    try {
        // Re-authenticate
        const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
        await user.reauthenticateWithCredential(credential);
        
        // Update password
        await user.updatePassword(newPassword);
        
        // Update the stored plain password for Master view
        await db.collection("players").doc(user.uid).update({ plainPassword: newPassword });
        
        return true;
    } catch (err) {
        if (err.code === 'auth/wrong-password') {
            throw new Error("現在のパスワードが間違っています。");
        }
        throw new Error("パスワード変更に失敗しました: " + err.message);
    }
}

window.fbDeleteAccount = async function() {
    const user = auth.currentUser;
    if (!user) throw new Error("未ログインです。");

    try {
        const uid = user.uid;
        // Delete user's profile from Firestore
        await db.collection("players").doc(uid).delete();
        
        // Delete from Auth
        await user.delete();
        return true;
    } catch (err) {
        if (err.code === 'auth/requires-recent-login') {
            throw new Error("セキュリティのため、一度ログアウトして再ログインしてから再度実行してください。");
        }
        throw new Error("アカウント削除に失敗しました: " + err.message);
    }
}

console.log("Firebase DB Module (Compat) Loaded.");
