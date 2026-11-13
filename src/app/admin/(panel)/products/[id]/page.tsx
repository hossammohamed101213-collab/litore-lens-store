import { notFound } from "next/navigation";
import { getProductAdmin } from "@/lib/db/admin";
import { db } from "@/lib/db";
import { ProductForm } from "../ProductForm";

export default async function EditProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { id } = await params;
  const { error, saved } = await searchParams;
  const data = getProductAdmin(id);
  if (!data) notFound();
  const images = db().prepare("SELECT id,file FROM product_images WHERE product_id = ? ORDER BY sort, rowid").all(id) as { id: string; file: string }[];
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold">تعديل: <span dir="ltr">{String(data.product.name_en || data.product.name_ar)}</span>{data.product.name_en ? <span className="ms-2 text-xl opacity-75">{String(data.product.name_ar)}</span> : null}</h1>
      <ProductForm product={data.product} variants={data.variants} images={images} error={error} saved={saved === "1"} />
    </div>
  );
}
