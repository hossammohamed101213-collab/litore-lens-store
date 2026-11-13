import { notFound } from "next/navigation";
import { getProductAdmin } from "@/lib/db/admin";
import { ProductForm } from "../ProductForm";

export default async function EditProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { id } = await params;
  const { error, saved } = await searchParams;
  const data = getProductAdmin(id);
  if (!data) notFound();
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold">تعديل: {String(data.product.name_ar)}</h1>
      <ProductForm product={data.product} variants={data.variants} error={error} saved={saved === "1"} />
    </div>
  );
}
