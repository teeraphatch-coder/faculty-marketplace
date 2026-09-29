// js/app.js
let rawProducts = [];

// Seed Mock Data อัตโนมัติหากยังไม่มีข้อมูลใน Firestore
async function seedInitialData() {
    const snapshot = await db.collection("products").get();
    if (snapshot.empty) {
        const sampleData = [
            {
                title: "หนังสือ Calculus II มือสองสภาพดี",
                price: 180,
                category: "หนังสือ/ตำรา",
                condition: "มือสองสภาพดีมาก",
                location: "ใต้ตึกเพียรวิจิตร",
                imageUrl: "https://picsum.photos/seed/book/400/300",
                description: "ไม่มีรอยไฮไลท์ มีเฉลยแบบฝึกหัดท้ายบทครบถ้วน",
                status: "ready", // พร้อมขาย
                statusLabel: "พร้อมขาย",
                sellerName: "สมชาย สายเรียน",
                createdAt: new Date().toISOString()
            },
            {
                title: "หูฟัง Bluetooth เสียงดี แบตอึด",
                price: 350,
                category: "เครื่องใช้ไฟฟ้า",
                condition: "มือสองสภาพปานกลาง",
                location: "โรงอาหารกลาง",
                imageUrl: "https://picsum.photos/seed/headphone/400/300",
                description: "ใช้งานปกติ แบตเตอรี่อยู่อย่างน้อย 4 ชั่วโมง",
                status: "reserved", // มีผู้จองแล้ว
                statusLabel: "มีผู้จองแล้ว",
                sellerName: "สมหญิง จริงใจ",
                createdAt: new Date().toISOString()
            }
        ];
        for (let item of sampleData) {
            await db.collection("products").add(item);
        }
        console.log("Seed complete");
    }
}

// Fetch & Render Products
function loadProducts() {
    db.collection("products").onSnapshot((snapshot) => {
        rawProducts = [];
        snapshot.forEach((doc) => {
            rawProducts.push({ id: doc.id, ...doc.data() });
        });
        renderProducts(rawProducts);
    });
}

// Render Status Badge ตามไดอะแกรมระบบ
function getStatusBadge(status) {
    switch (status) {
        case 'ready':
            return `<span class="badge bg-success badge-status"><i class="fa-solid fa-check me-1"></i>พร้อมขาย</span>`;
        case 'reserved':
            return `<span class="badge bg-warning text-dark badge-status"><i class="fa-solid fa-clock me-1"></i>มีผู้จองแล้ว</span>`;
        case 'pending_payment':
            return `<span class="badge bg-info text-dark badge-status"><i class="fa-solid fa-credit-card me-1"></i>รอชำระเงิน</span>`;
        case 'shipping':
            return `<span class="badge bg-primary badge-status"><i class="fa-solid fa-truck me-1"></i>กำลังจัดส่ง</span>`;
        case 'sold':
            return `<span class="badge bg-secondary badge-status"><i class="fa-solid fa-box-archive me-1"></i>ขายแล้ว</span>`;
        default:
            return `<span class="badge bg-dark badge-status">ไม่ระบุ</span>`;
    }
}

function renderProducts(items) {
    const grid = document.getElementById("productGrid");
    document.getElementById("itemCount").innerText = `พบทั้งหมด ${items.length} รายการ`;
    grid.innerHTML = "";

    if (items.length === 0) {
        grid.innerHTML = `<div class="col-12 text-center text-muted py-5">ไม่พบรายการสินค้า</div>`;
        return;
    }

    items.forEach((p) => {
        const isAvailable = p.status === 'ready';
        const cardHtml = `
            <div class="col-12 col-sm-6 col-md-4 col-lg-3">
                <div class="card product-card h-100 shadow-sm">
                    ${getStatusBadge(p.status)}
                    <img src="${p.imageUrl}" class="card-img-top" style="height:180px; object-fit:cover;" alt="${p.title}">
                    <div class="card-body d-flex flex-column">
                        <span class="badge bg-light text-primary w-fit mb-2">${p.category}</span>
                        <h6 class="card-title fw-bold text-truncate">${p.title}</h6>
                        <p class="text-success fw-bold fs-5 mb-1">${Number(p.price).toLocaleString()} บาท</p>
                        <p class="text-muted small mb-2"><i class="fa-solid fa-location-dot me-1"></i>${p.location || 'นัดรับภายในคณะ'}</p>
                        <div class="mt-auto pt-2 border-top d-flex justify-content-between align-items-center">
                            <span class="small text-muted"><i class="fa-solid fa-user me-1"></i>${p.sellerName || 'นิสิตผู้ขาย'}</span>
                            <button class="btn btn-sm ${isAvailable ? 'btn-outline-primary' : 'btn-light disabled'}" onclick="createOrder('${p.id}', '${p.title}')">
                                ${isAvailable ? 'ส่งคำขอซื้อ' : 'ขายแล้ว/ติดจอง'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        grid.innerHTML += cardHtml;
    });
}

// สร้างคำสั่งซื้อ/จองสินค้า
async function createOrder(productId, title) {
    if (!confirm(`ยืนยันส่งคำขอซื้อ/จองสินค้า: ${title} ?`)) return;

    try {
        // บันทึกคำสั่งซื้อลง Firestore[cite: 1]
        await db.collection("orders").add({
            productId: productId,
            productTitle: title,
            buyerName: "ผู้ซื้อทดสอบ (นิสิต)",
            status: "pending",
            createdAt: new Date().toISOString()
        });

        // อัปเดตสถานะสินค้าเป็น "มีผู้จองแล้ว"[cite: 1]
        await db.collection("products").doc(productId).update({
            status: "reserved",
            statusLabel: "มีผู้จองแล้ว"
        });

        alert("ส่งคำขอจองสำเร็จ! ระบบแจ้งเตือนไปยังผู้ขายแล้ว");
    } catch (e) {
        alert("เกิดข้อผิดพลาดในการสร้างคำสั่งซื้อ: " + e.message);
    }
}

// เพิ่มสินค้าใหม่
document.getElementById("formAddProduct")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const newProduct = {
        title: document.getElementById("pTitle").value,
        price: parseFloat(document.getElementById("pPrice").value),
        category: document.getElementById("pCategory").value,
        condition: document.getElementById("pCondition").value,
        location: document.getElementById("pLocation").value,
        imageUrl: document.getElementById("pImageUrl").value || "https://picsum.photos/400/300",
        description: document.getElementById("pDescription").value,
        status: "ready", // พร้อมขาย[cite: 1]
        statusLabel: "พร้อมขาย",
        sellerName: "ฉัน (ผู้ขายปัจจุบัน)",
        createdAt: new Date().toISOString()
    };

    await db.collection("products").add(newProduct);
    bootstrap.Modal.getInstance(document.getElementById("modalAddProduct")).hide();
    document.getElementById("formAddProduct").reset();
    alert("ลงขายสินค้าสำเร็จ!");
});

// กรองหมวดหมู่ & ค้นหา
function filterCategory(cat) {
    if (cat === 'all') renderProducts(rawProducts);
    else renderProducts(rawProducts.filter(p => p.category === cat));
}

function searchProducts() {
    const term = document.getElementById("searchInput").value.toLowerCase();
    renderProducts(rawProducts.filter(p => p.title.toLowerCase().includes(term) || p.location?.toLowerCase().includes(term)));
}

// Initial Run
window.onload = async () => {
    await seedInitialData();
    loadProducts();
};