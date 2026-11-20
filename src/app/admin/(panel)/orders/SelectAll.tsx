"use client";

/** Ticks or clears every order box in the list and keeps the "print selected" button honest about how many are chosen. */
export function SelectAll({ form }: { form: string }) {
  const boxes = () => [...document.querySelectorAll<HTMLInputElement>(`input[type=checkbox][name=id][form="${form}"]`)];
  return (
    <label className="inline-flex min-h-11 items-center gap-2 text-sm font-bold">
      <input type="checkbox" data-select-all className="h-5 w-5" onChange={(e) => { for (const b of boxes()) b.checked = e.currentTarget.checked; }} />
      تحديد الكل
    </label>
  );
}
