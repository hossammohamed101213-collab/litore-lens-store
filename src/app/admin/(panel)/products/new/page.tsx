import { ProductForm } from "../ProductForm";

export default async function NewProductPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold">منتج جديد</h1>
      <ProductForm variants={[]} error={error} />
    </div>
  );
}
