/**
 * سكريبت ترحيل: ينقل كل الصور المخزّنة كـ base64 في DB إلى Cloudinary
 * ويستبدل قيمة العمود برابط Cloudinary الحقيقي.
 *
 * يغطّي: products.image_url, products.image_urls[], categories.image_url,
 *         categories.icon_url, banners.image_url, offers.image_url
 *
 * تشغيل:  npx tsx scripts/migrate-base64-to-cloudinary.ts
 *         npx tsx scripts/migrate-base64-to-cloudinary.ts --dry
 */
import { v2 as cloudinary } from "cloudinary";
import { pool } from "../server/db";

const DRY = process.argv.includes("--dry");

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (!cloudName || !apiKey || !apiSecret) {
  console.error("❌ Cloudinary غير مضبوط. أضِف CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET");
  process.exit(1);
}
cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });

async function uploadDataUrl(dataUrl: string, folder: string): Promise<string | null> {
  try {
    const res = await cloudinary.uploader.upload(dataUrl, {
      folder: `oyoplast/${folder}`,
      resource_type: "image",
      quality: "auto:good",
      fetch_format: "auto",
    });
    return res.secure_url;
  } catch (e: any) {
    console.error(`   ❌ فشل رفع الصورة:`, e.message);
    return null;
  }
}

const stats = { products: 0, productImageUrls: 0, categories: 0, categoryIcons: 0, subcategories: 0, banners: 0, offers: 0, failed: 0 };

async function migrateProducts() {
  console.log("\n📦 المنتجات…");
  const r = await pool.query(`SELECT id, name, image_url, image_urls FROM products ORDER BY id`);
  for (const row of r.rows) {
    // image_url
    if (typeof row.image_url === "string" && row.image_url.startsWith("data:")) {
      console.log(`  • منتج #${row.id} (${row.name}) — image_url`);
      if (!DRY) {
        const url = await uploadDataUrl(row.image_url, "products");
        if (url) {
          await pool.query(`UPDATE products SET image_url = $1 WHERE id = $2`, [url, row.id]);
          stats.products++;
        } else stats.failed++;
      } else stats.products++;
    }
    // image_urls[]
    if (Array.isArray(row.image_urls)) {
      const next: string[] = [];
      let changed = false;
      for (const u of row.image_urls) {
        if (typeof u === "string" && u.startsWith("data:")) {
          changed = true;
          if (!DRY) {
            const url = await uploadDataUrl(u, "products");
            if (url) { next.push(url); stats.productImageUrls++; }
            else { next.push(u); stats.failed++; }
          } else { next.push(u); stats.productImageUrls++; }
        } else next.push(u);
      }
      if (changed && !DRY) {
        await pool.query(`UPDATE products SET image_urls = $1 WHERE id = $2`, [next, row.id]);
      }
    }
  }
}

async function migrateCategories() {
  console.log("\n🗂  الأقسام…");
  const r = await pool.query(`SELECT id, name, image_url, icon_url FROM categories ORDER BY id`);
  for (const row of r.rows) {
    if (typeof row.image_url === "string" && row.image_url.startsWith("data:")) {
      console.log(`  • قسم #${row.id} (${row.name}) — image_url`);
      if (!DRY) {
        const url = await uploadDataUrl(row.image_url, "categories");
        if (url) {
          await pool.query(`UPDATE categories SET image_url = $1 WHERE id = $2`, [url, row.id]);
          stats.categories++;
        } else stats.failed++;
      } else stats.categories++;
    }
    if (typeof row.icon_url === "string" && row.icon_url.startsWith("data:")) {
      console.log(`  • قسم #${row.id} (${row.name}) — icon_url`);
      if (!DRY) {
        const url = await uploadDataUrl(row.icon_url, "categories/icons");
        if (url) {
          await pool.query(`UPDATE categories SET icon_url = $1 WHERE id = $2`, [url, row.id]);
          stats.categoryIcons++;
        } else stats.failed++;
      } else stats.categoryIcons++;
    }
  }
}

async function migrateSubcategories() {
  console.log("\n📑 الأقسام الفرعية…");
  const r = await pool.query(`SELECT id, name, image_url FROM subcategories ORDER BY id`);
  for (const row of r.rows) {
    if (typeof row.image_url === "string" && row.image_url.startsWith("data:")) {
      console.log(`  • قسم فرعي #${row.id} (${row.name})`);
      if (!DRY) {
        const url = await uploadDataUrl(row.image_url, "subcategories");
        if (url) {
          await pool.query(`UPDATE subcategories SET image_url = $1 WHERE id = $2`, [url, row.id]);
          stats.subcategories++;
        } else stats.failed++;
      } else stats.subcategories++;
    }
  }
}

async function migrateBanners() {
  console.log("\n🎯 البنرات…");
  // فحص إن الجدول موجود
  const exists = await pool.query(
    `SELECT to_regclass('public.banners') as t`
  );
  if (!exists.rows[0]?.t) { console.log("  (لا يوجد جدول banners)"); return; }
  const r = await pool.query(`SELECT id, title, image_url FROM banners ORDER BY id`);
  for (const row of r.rows) {
    if (typeof row.image_url === "string" && row.image_url.startsWith("data:")) {
      console.log(`  • بنر #${row.id} (${row.title})`);
      if (!DRY) {
        const url = await uploadDataUrl(row.image_url, "banners");
        if (url) {
          await pool.query(`UPDATE banners SET image_url = $1 WHERE id = $2`, [url, row.id]);
          stats.banners++;
        } else stats.failed++;
      } else stats.banners++;
    }
  }
}

async function migrateOffers() {
  console.log("\n🏷  العروض…");
  const exists = await pool.query(`SELECT to_regclass('public.offers') as t`);
  if (!exists.rows[0]?.t) { console.log("  (لا يوجد جدول offers)"); return; }
  const r = await pool.query(`SELECT id, title, image_url FROM offers ORDER BY id`);
  for (const row of r.rows) {
    if (typeof row.image_url === "string" && row.image_url.startsWith("data:")) {
      console.log(`  • عرض #${row.id} (${row.title})`);
      if (!DRY) {
        const url = await uploadDataUrl(row.image_url, "offers");
        if (url) {
          await pool.query(`UPDATE offers SET image_url = $1 WHERE id = $2`, [url, row.id]);
          stats.offers++;
        } else stats.failed++;
      } else stats.offers++;
    }
  }
}

async function main() {
  console.log(`🚀 ترحيل الصور (${DRY ? "DRY-RUN" : "تنفيذ فعلي"})…`);
  console.time("⏱  المدة");
  await migrateProducts();
  await migrateCategories();
  await migrateSubcategories();
  await migrateBanners();
  await migrateOffers();
  console.timeEnd("⏱  المدة");
  console.log("\n📊 النتائج:");
  console.log(`   منتجات (image_url):   ${stats.products}`);
  console.log(`   صور إضافية للمنتج:   ${stats.productImageUrls}`);
  console.log(`   أقسام (image_url):    ${stats.categories}`);
  console.log(`   أيقونات الأقسام:      ${stats.categoryIcons}`);
  console.log(`   بنرات:                ${stats.banners}`);
  console.log(`   عروض:                 ${stats.offers}`);
  console.log(`   فشل:                  ${stats.failed}`);
  console.log(DRY ? "\n💡 لتشغيل الترحيل فعلياً: npx tsx scripts/migrate-base64-to-cloudinary.ts" : "\n✅ تم.");
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
