// ConfFlow — Firebase Services
// ─────────────────────────────────────────────────────────
// Loaded as type="module". Exposes all services on window.FirebaseServices
// so that app.js (a plain <script>) can call them.
// Fires a "firebase-ready" CustomEvent when done.

import { initializeApp }                         from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword,
         signInWithEmailAndPassword, signInWithPopup,
         GoogleAuthProvider, GithubAuthProvider,
         signOut, onAuthStateChanged, updateProfile }
                                                  from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { getFirestore, collection, doc, addDoc,
         setDoc, getDoc, getDocs, updateDoc,
         query, where, orderBy, serverTimestamp, onSnapshot }
                                                  from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable,
         getDownloadURL, deleteObject }            from "https://www.gstatic.com/firebasejs/10.7.0/firebase-storage.js";
import { getAnalytics, logEvent }                 from "https://www.gstatic.com/firebasejs/10.7.0/firebase-analytics.js";

// ── Validate config ───────────────────────────────────────
const cfg = window.__FIREBASE_CONFIG__;
const valid = cfg && cfg.apiKey && !cfg.apiKey.startsWith('PLACEHOLDER') && !cfg.apiKey.startsWith('PASTE_');

if (!valid) {
  console.error(
    '❌ Firebase config is missing or still has placeholder values.\n' +
    '   On Vercel: ensure FIREBASE_API_KEY and all FIREBASE_* env vars are set.\n' +
    '   Locally: edit firebase-config.js with your real credentials.'
  );
  window.__FIREBASE_READY__ = false;
  window.dispatchEvent(new CustomEvent('firebase-ready', { detail: { ok: false } }));
} else {
  bootFirebase(cfg);
}

function safeLog(analytics, event, params) {
  try { logEvent(analytics, event, params); } catch (_) {}
}

function bootFirebase(config) {
  let app, auth, db, storage, analytics;
  try {
    app       = initializeApp(config);
    auth      = getAuth(app);
    db        = getFirestore(app);
    storage   = getStorage(app);
    analytics = getAnalytics(app);
  } catch (err) {
    console.error('❌ Firebase init failed:', err.message);
    window.__FIREBASE_READY__ = false;
    window.dispatchEvent(new CustomEvent('firebase-ready', { detail: { ok: false } }));
    return;
  }

  const googleProvider = new GoogleAuthProvider();
  const githubProvider = new GithubAuthProvider();

  // ── Auth ──────────────────────────────────────────────
  const AuthService = {
    async register(email, password, displayName, role, institution) {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName });
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid, displayName, email, role, institution,
        createdAt: serverTimestamp(), avatar: null
      });
      safeLog(analytics, 'sign_up', { method: 'email' });
      return cred.user;
    },
    async login(email, password) {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      safeLog(analytics, 'login', { method: 'email' });
      return cred.user;
    },
    async loginWithGoogle() {
      const r = await signInWithPopup(auth, googleProvider);
      safeLog(analytics, 'login', { method: 'google' });
      return r.user;
    },
    async loginWithGithub() {
      const r = await signInWithPopup(auth, githubProvider);
      safeLog(analytics, 'login', { method: 'github' });
      return r.user;
    },
    async logout() { await signOut(auth); },
    onAuthChange(cb)  { return onAuthStateChanged(auth, cb); },
    getCurrentUser()  { return auth.currentUser; }
  };

  // ── Users ─────────────────────────────────────────────
  const UserService = {
    async getProfile(uid) {
      const snap = await getDoc(doc(db, 'users', uid));
      return snap.exists() ? snap.data() : null;
    },
    async updateProfile(uid, data) {
      await updateDoc(doc(db, 'users', uid), { ...data, updatedAt: serverTimestamp() });
    }
  };

  // ── Conferences ───────────────────────────────────────
  const ConferenceService = {
    async create(data) {
      return await addDoc(collection(db, 'conferences'), {
        ...data, createdAt: serverTimestamp(), status: 'active', papersCount: 0
      });
    },
    async getAll() {
      const q = query(collection(db, 'conferences'), where('status', '==', 'active'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },
    async getById(id) {
      const snap = await getDoc(doc(db, 'conferences', id));
      return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    },
    async update(id, data) {
      await updateDoc(doc(db, 'conferences', id), { ...data, updatedAt: serverTimestamp() });
    },
    onConfChange(id, cb) {
      return onSnapshot(doc(db, 'conferences', id), snap => {
        if (snap.exists()) cb({ id: snap.id, ...snap.data() });
      });
    }
  };

  // ── Papers ────────────────────────────────────────────
  const PaperService = {
    async submit(data, pdfFile) {
      let pdfUrl = null;
      if (pdfFile) {
        const sRef = ref(storage, `papers/${Date.now()}_${pdfFile.name}`);
        const task = await uploadBytesResumable(sRef, pdfFile);
        pdfUrl = await getDownloadURL(task.ref);
      }
      return await addDoc(collection(db, 'papers'), {
        ...data, pdfUrl, status: 'submitted', aiScore: null,
        reviewers: [], submittedAt: serverTimestamp(), updatedAt: serverTimestamp()
      });
    },
    async getByAuthor(uid) {
      const q = query(collection(db, 'papers'), where('authorId', '==', uid), orderBy('submittedAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },
    async updateStatus(paperId, status, note = '') {
      await updateDoc(doc(db, 'papers', paperId), { status, statusNote: note, updatedAt: serverTimestamp() });
    },
    onPaperChange(paperId, cb) {
      return onSnapshot(doc(db, 'papers', paperId), snap => {
        if (snap.exists()) cb({ id: snap.id, ...snap.data() });
      });
    }
  };

  // ── Reviews ───────────────────────────────────────────
  const ReviewService = {
    async submit(data) {
      return await addDoc(collection(db, 'reviews'), { ...data, submittedAt: serverTimestamp() });
    },
    async getByPaper(paperId) {
      const q = query(collection(db, 'reviews'), where('paperId', '==', paperId));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
  };

  // ── Storage ───────────────────────────────────────────
  const StorageService = {
    uploadWithProgress(path, file, onProgress) {
      const sRef = ref(storage, path);
      const task = uploadBytesResumable(sRef, file);
      return new Promise((resolve, reject) => {
        task.on('state_changed',
          snap => { if (onProgress) onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)); },
          reject,
          async () => resolve(await getDownloadURL(task.ref))
        );
      });
    },
    async delete(filePath) { await deleteObject(ref(storage, filePath)); }
  };

  // ── Analytics ─────────────────────────────────────────
  const Analytics = {
    track(eventName, params = {}) { safeLog(analytics, eventName, params); }
  };

  // ── Expose on window so app.js can access everything ──
  window.FirebaseServices = {
    AuthService, UserService, ConferenceService,
    PaperService, ReviewService, StorageService, Analytics
  };
  window.__FIREBASE_READY__ = true;

  console.log('✅ Firebase initialised successfully');
  window.dispatchEvent(new CustomEvent('firebase-ready', { detail: { ok: true } }));
}