// ==========================================
// 1. ตั้งค่า ImgBB API Key
// ==========================================
const IMGBB_API_KEY = '51a07553119e1552ace83af8297da074';

// ฟังก์ชันอัปโหลดรูปภาพขึ้น ImgBB
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
    return data.data.url; // คืนค่าเป็น Link รูปภาพจริง
  } else {
    throw new Error('อัปโหลดรูปภาพไม่สำเร็จ: ' + (data.error?.message || ''));
  }
}

// ==========================================
// 2. ระบบยืนยันตัวตน (Authentication & Profile)
// ==========================================

// สมัครสมาชิก + บันทึกข้อมูลโปรไฟล์และคอนแทกต์
async function registerUser(email, password, displayName, contactInfo) {
  try {
    const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;

    // บันทึกโปรไฟล์ลง Firestore
    await db.collection('users').doc(user.uid).set({
      uid: user.uid,
      displayName: displayName,
      email: email,
      contactInfo: contactInfo, // เช่น Line ID / เบอร์โทรศัพท์
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert('สมัครสมาชิกสำเร็จ!');
  } catch (error) {
    alert('เกิดข้อผิดพลาดในการสมัครสมาชิก: ' + error.message);
  }
}

// เข้าสู่ระบบ
async function loginUser(email, password) {
  try {
    await firebase.auth().signInWithEmailAndPassword(email, password);
    alert('เข้าสู่ระบบสำเร็จ!');
  } catch (error) {
    alert('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
  }
}

// ออกจากระบบ
function logoutUser() {
  firebase.auth().signOut().then(() => alert('ออกจากระบบเรียบร้อย'));
}

// ตรวจสอบสถานะ User ปัจจุบัน
firebase.auth().onAuthStateChanged(async (user) => {
  if (user) {
    const userDoc = await db.collection('users').doc(user.uid).get();
    if (userDoc.exists) {
      const profile = userDoc.data();
      console.log('ผู้ใช้ปัจจุบัน:', profile.displayName, '| Contact:', profile.contactInfo);
      // นำข้อมูลโปรไฟล์ไปแสดงบน UI หน้าเว็บได้ตรงนี้
    }
  } else {
    console.log('ยังไม่ได้เข้าสู่ระบบ');
  }
});

// ==========================================
// 3. ระบบโพสต์ขายสินค้า (อัปโหลดรูป + เพิ่มคอนแทกต์)
// ==========================================

async function createProductPost(title, price, category, contactInfo, imageFile) {
  const currentUser = firebase.auth().currentUser;

  if (!currentUser) {
    alert('กรุณาเข้าสู่ระบบก่อนทำการโพสต์ขายสินค้า');
    return;
  }

  try {
    alert('กำลังอัปโหลดรูปและบันทึกข้อมูล...');

    // 1. อัปโหลดรูปไป ImgBB
    let imageUrl = '';
    if (imageFile) {
      imageUrl = await uploadImageToImgBB(imageFile);
    }

    // 2. บันทึกข้อมูลลง Firestore
    await db.collection('products').add({
      title: title,
      price: Number(price),
      category: category,
      contactInfo: contactInfo, // ช่องทางติดต่อสำหรับสินค้านี้
      imageUrl: imageUrl,       // ลิงก์รูปภาพจาก ImgBB
      sellerId: currentUser.uid,
      sellerEmail: currentUser.email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert('ลงประกาศขายสินค้าเรียบร้อยแล้ว!');
  } catch (error) {
    alert('เกิดข้อผิดพลาด: ' + error.message);
  }
}

// ==========================================
// 4. ดึงรายการสินค้ามาแสดงบนหน้าเว็บ
// ==========================================

function loadProducts(containerId) {
  db.collection('products').orderBy('createdAt', 'desc').onSnapshot((snapshot) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = ''; // ล้างข้อมูลเก่า
    snapshot.forEach((doc) => {
      const item = doc.data();
      
      const card = `
        <div class="product-card" style="border: 1px solid #ccc; padding: 10px; margin: 10px; border-radius: 8px;">
          ${item.imageUrl ? `<img src="${item.imageUrl}" style="width:100%; max-height:200px; object-fit:cover;">` : ''}
          <h3>${item.title}</h3>
          <p>ราคา: ${item.price} บาท</p>
          <p>หมวดหมู่: ${item.category}</p>
          <p><strong>ช่องทางติดต่อผู้ขาย:</strong> ${item.contactInfo || 'ไม่มีข้อมูลติดต่อ'}</p>
        </div>
      `;
      container.innerHTML += card;
    });
  });
}