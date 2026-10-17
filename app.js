// ==========================================================
// js/app.js — ตัวกลางของระบบ (ล็อกอิน/สมัคร/สิทธิ์/อัปโหลดรูป)
// ต้องโหลดหลัง js/firebase-config.js เสมอ
// หน้าอื่นรอผู้ใช้พร้อมด้วย:  authReady.then(({ user, profile }) => { ... })
// ==========================================================
const IMGBB_API_KEY = 'fb241941a3033065ba37a71d85066bc7';
const ID_PREFIX = '169204140';     // รหัสหลัก + 3 ตัวท้าย เช่น 169204140001
const AUTO_APPROVE = true;         // true = ประกาศใหม่แสดงทันที | false = รอแอดมินอนุมัติก่อน

const CURRENT_PAGE = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
const IS_AUTH_PAGE = CURRENT_PAGE.startsWith('auth');
const IS_ADMIN_PAGE = CURRENT_PAGE.startsWith('admin');

let currentUser = null, currentProfile = null;
let authBusy = false;              // กัน redirect อัตโนมัติระหว่างกำลังล็อกอิน/สมัคร
let _resolveAuth;
const authReady = new Promise(r => { _resolveAuth = r; });

// ---------- รหัส 3 ตัวท้าย → อีเมลสำหรับ Firebase Auth ----------
function convertCodeToEmail(threeDigits) {
  const fullCode = ID_PREFIX + String(threeDigits).padStart(3, '0');
  return { fullCode, email: `${fullCode}@faculty.local` };
}
// ช่องล็อกอินรับได้ทั้งอีเมลจริง และรหัส 3 หลัก (เช่น 001)
function toLoginEmail(input) {
  const s = String(input || '').trim();
  return /^\d{3}$/.test(s) ? convertCodeToEmail(s) : { fullCode: '', email: s };
}

// ---------- อัปโหลดรูปขึ้น ImgBB ----------
async function uploadImageToImgBB(imageFile) {
  if (!imageFile) return '';
  if (imageFile.size > 5 * 1024 * 1024) throw new Error('รูปต้องมีขนาดไม่เกิน 5 MB');
  const formData = new FormData();
  formData.append('image', imageFile);
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: formData });
  const data = await res.json();
  if (!data.success) throw new Error('อัปโหลดรูปภาพไม่สำเร็จ');
  return data.data.url;
}

// ---------- ข้อความ error ภาษาไทย ----------
function authErrorText(e) {
  const m = {
    'auth/operation-not-allowed': 'ยังไม่ได้เปิดวิธีล็อกอินนี้ใน Firebase Console (Authentication > Sign-in method)',
    'auth/unauthorized-domain': 'โดเมนนี้ยังไม่ได้อนุญาต: เพิ่มใน Authentication > Settings > Authorized domains (และห้ามเปิดแบบ file://)',
    'auth/email-already-in-use': 'อีเมล/รหัสนี้ถูกใช้สมัครแล้ว',
    'auth/weak-password': 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร',
    'auth/invalid-email': 'รูปแบบอีเมลหรือรหัสไม่ถูกต้อง',
    'auth/invalid-credential': 'อีเมล/รหัส หรือรหัสผ่านไม่ถูกต้อง',
    'auth/user-not-found': 'อีเมล/รหัส หรือรหัสผ่านไม่ถูกต้อง',
    'auth/wrong-password': 'อีเมล/รหัส หรือรหัสผ่านไม่ถูกต้อง',
    'auth/invalid-api-key': 'API Key ใน js/firebase-config.js ไม่ถูกต้อง',
    'auth/popup-closed-by-user': 'ปิดหน้าต่างล็อกอินก่อนเสร็จสิ้น',
    'auth/too-many-requests': 'ลองผิดหลายครั้งเกินไป กรุณารอสักครู่',
    'permission-denied': 'ไม่มีสิทธิ์เข้าถึงฐานข้อมูล ตรวจสอบ Firestore Rules'
  };
  return m[e && e.code] || (e && e.message) || String(e);
}

// ---------- โปรไฟล์ผู้ใช้ใน Firestore: users/{uid} (role = 'user' | 'admin') ----------
async function ensureProfile(user, extra = {}) {
  const ref = db.collection('users').doc(user.uid);
  const snap = await ref.get();
  const now = firebase.firestore.FieldValue.serverTimestamp();
  if (snap.exists) {                         // ไม่แตะ role เดิม อัปเดตแค่เวลาล็อกอิน
    await ref.update({ lastLogin: now });
    return snap.data();
  }
  const profile = {
    uid: user.uid,
    displayName: extra.displayName || user.displayName || (user.email || '').split('@')[0],
    email: user.email || '',
    photoURL: user.photoURL || '',
    role: 'user',                            // แอดมินตั้งผ่าน Firebase Console เท่านั้น
    createdAt: now,
    lastLogin: now
  };
  if (extra.year) profile.year = extra.year;
  if (extra.studentId) profile.studentId = extra.studentId;
  await ref.set(profile);
  return profile;
}

const goByRole = (p) => location.replace(p && p.role === 'admin' ? 'admin.html' : 'index.html');

// ---------- ล็อกอิน / สมัคร / Google / ออกจากระบบ (throw error ให้หน้าเรียกแสดงเอง) ----------
async function loginUser(input, password) {
  const { email } = toLoginEmail(input);
  authBusy = true;
  try {
    const c = await auth.signInWithEmailAndPassword(email, password);
    goByRole(await ensureProfile(c.user));
  } catch (e) { authBusy = false; throw e; }
}

async function registerUser(input, password, displayName, year) {
  const { fullCode, email } = toLoginEmail(input);
  authBusy = true;
  try {
    const c = await auth.createUserWithEmailAndPassword(email, password);
    await c.user.updateProfile({ displayName });
    goByRole(await ensureProfile(c.user, { displayName, year, studentId: fullCode }));
  } catch (e) { authBusy = false; throw e; }
}

async function googleLogin() {
  authBusy = true;
  try {
    const r = await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
    goByRole(await ensureProfile(r.user));
  } catch (e) { authBusy = false; throw e; }
}

function logoutUser() {
  const go = () => location.replace('auth.html');
  auth.signOut().then(go, go);
}

// ---------- Role Guard ----------
auth.onAuthStateChanged(async (user) => {
  if (authBusy) return;
  if (!user) { if (!IS_AUTH_PAGE) location.replace('auth.html'); return; }

  let profile;
  try { profile = await ensureProfile(user); }
  catch (e) {
    console.error(e);
    alert('เชื่อมต่อฐานข้อมูลไม่ได้: ' + authErrorText(e) + '\n(ตรวจสอบว่าสร้าง Firestore Database และตั้ง Rules แล้ว)');
    return;
  }
  if (IS_AUTH_PAGE) return goByRole(profile);
  if (IS_ADMIN_PAGE && profile.role !== 'admin') {
    alert('คุณไม่มีสิทธิ์เข้าถึงหน้า Admin');
    location.replace('index.html');
    return;
  }
  currentUser = user; currentProfile = profile;
  _resolveAuth({ user, profile });
});
