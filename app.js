// ==========================================
// 1. ตั้งค่า ImgBB และ รหัสหลัก (Prefix)
// ==========================================
const IMGBB_API_KEY = 'fb241941a3033065ba37a71d85066bc7';
const ID_PREFIX = '169204140'; // รหัสหลัก (รวมกับ 3 ตัวหลัง เช่น 169204140001)

// แปลงรหัส 3 ตัวหลังให้เป็น Email สำหรับ Firebase Auth
function convertCodeToEmail(threeDigits) {
  const fullCode = ID_PREFIX + String(threeDigits).padStart(3, '0');
  return {
    fullCode: fullCode,
    email: `${fullCode}@faculty.local`
  };
}

// อัปโหลดรูปภาพขึ้น ImgBB
async function uploadImageToImgBB(imageFile) {
  if (!imageFile) return '';
  const formData = new FormData();
  formData.append('image', imageFile);

  const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
    method: 'POST',
    body: formData
  });

  const data = await response.json();
  if (data.success) {
    return data.data.url;
  } else {
    throw new Error('อัปโหลดรูปภาพไม่สำเร็จ');
  }
}

// ==========================================
// 2. ระบบ Login / Register & เเยกสิทธิ์ Admin/User
// ==========================================

// เข้าสู่ระบบด้วยรหัส 3 ตัวหลัง + Password
async function loginUser(threeDigits, password) {
  if (String(threeDigits).trim().length !== 3) {
    alert('กรุณากรอกรหัสประจำตัว 3 ตัวหลังให้ถูกต้อง (เช่น 001)');
    return;
  }

  const { email } = convertCodeToEmail(threeDigits.trim());

  try {
    const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
    const uid = userCredential.user.uid;

    // ดึงข้อมูล Role จาก Firestore เพื่อเปลี่ยนหน้าอัตโนมัติ
    const userDoc = await db.collection('users').doc(uid).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      alert(`เข้าสู่ระบบสำเร็จ! สวัสดีคุณ ${userData.displayName || userData.studentId}`);

      // หากเป็น Admin ให้เด้งไปหน้า admin.html ทันที
      if (userData.role === 'admin') {
        window.location.href = 'admin.html';
      } else {
        window.location.href = 'index.html';
      }
    } else {
      window.location.href = 'index.html';
    }
  } catch (error) {
    alert('รหัสประจำตัวหรือรหัสผ่านไม่ถูกต้อง');
  }
}

// สมัครสมาชิก (ระบุรหัส 3 ตัวหลัง, รหัสผ่าน, ชื่อ, คอนแทกต์, สิทธิ์)
async function registerUser(threeDigits, password, displayName, contactInfo, role = 'user') {
  if (String(threeDigits).trim().length !== 3) {
    alert('กรุณากรอกรหัสประจำตัว 3 ตัวหลังให้ถูกต้อง (เช่น 001)');
    return;
  }

  const { fullCode, email } = convertCodeToEmail(threeDigits.trim());

  try {
    const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;

    await db.collection('users').doc(user.uid).set({
      uid: user.uid,
      studentId: fullCode,      // 169204140001
      shortId: threeDigits,     // 001
      displayName: displayName,
      email: email,
      contactInfo: contactInfo,
      role: role,               // 'user' หรือ 'admin'
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert(`สมัครสมาชิกสำเร็จ! รหัสผู้ใช้ของคุณคือ: ${fullCode}`);
    
    if (role === 'admin') {
      window.location.href = 'admin.html';
    } else {
      window.location.href = 'index.html';
    }
  } catch (error) {
    alert('เกิดข้อผิดพลาดในการสมัคร: ' + error.message);
  }
}

// ออกจากระบบ
function logoutUser() {
  firebase.auth().signOut().then(() => {
    alert('ออกจากระบบเรียบร้อย');
    window.location.href = 'index.html';
  });
}

// ตรวจสอบสิทธิ์ผู้ใช้และควบคุมการเข้าถึงหน้าเว็บ (Role Guard)
firebase.auth().onAuthStateChanged(async (user) => {
  const isAdminPage = window.location.pathname.includes('admin.html');

  if (user) {
    const userDoc = await db.collection('users').doc(user.uid).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      
      // ถ้าอยู่หน้า admin แต่ไม่ใช่ admin ให้ดีดออกไปหน้า index.html
      if (isAdminPage && userData.role !== 'admin') {
        alert('คุณไม่มีสิทธิ์เข้าถึงหน้า Admin');
        window.location.href = 'index.html';
      }
    }
  } else {
    // ถ้ายังไม่ได้ Login แล้วพยายามเข้าหน้า admin.html
    if (isAdminPage) {
      alert('กรุณาเข้าสู่ระบบด้วยบัญชี Admin');
      window.location.href = 'index.html';
    }
  }
});