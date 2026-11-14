/** UAE emirates and their main cities/towns. `value` is what carriers receive (English); ar/en are what the customer sees. */
export type GeoOption = { value: string; ar: string; en: string };

export const UAE_OTHER = "__other";

export const uaeEmirates: (GeoOption & { cities: GeoOption[] })[] = [
  { value: "Abu Dhabi", ar: "أبوظبي", en: "Abu Dhabi", cities: [
    { value: "Abu Dhabi", ar: "أبوظبي", en: "Abu Dhabi" }, { value: "Al Ain", ar: "العين", en: "Al Ain" },
    { value: "Madinat Zayed", ar: "مدينة زايد", en: "Madinat Zayed" }, { value: "Ruwais", ar: "الرويس", en: "Ruwais" },
    { value: "Liwa", ar: "ليوا", en: "Liwa" }, { value: "Ghayathi", ar: "غياثي", en: "Ghayathi" },
  ] },
  { value: "Dubai", ar: "دبي", en: "Dubai", cities: [
    { value: "Dubai", ar: "دبي", en: "Dubai" }, { value: "Hatta", ar: "حتا", en: "Hatta" },
  ] },
  { value: "Sharjah", ar: "الشارقة", en: "Sharjah", cities: [
    { value: "Sharjah", ar: "الشارقة", en: "Sharjah" }, { value: "Khor Fakkan", ar: "خورفكان", en: "Khor Fakkan" },
    { value: "Kalba", ar: "كلباء", en: "Kalba" }, { value: "Dibba Al-Hisn", ar: "دبا الحصن", en: "Dibba Al-Hisn" },
    { value: "Al Dhaid", ar: "الذيد", en: "Al Dhaid" }, { value: "Mleiha", ar: "مليحة", en: "Mleiha" },
  ] },
  { value: "Ajman", ar: "عجمان", en: "Ajman", cities: [
    { value: "Ajman", ar: "عجمان", en: "Ajman" }, { value: "Masfout", ar: "مصفوت", en: "Masfout" }, { value: "Manama", ar: "المنامة", en: "Manama" },
  ] },
  { value: "Umm Al Quwain", ar: "أم القيوين", en: "Umm Al Quwain", cities: [
    { value: "Umm Al Quwain", ar: "أم القيوين", en: "Umm Al Quwain" }, { value: "Falaj Al Mualla", ar: "فلج المعلا", en: "Falaj Al Mualla" },
  ] },
  { value: "Ras Al Khaimah", ar: "رأس الخيمة", en: "Ras Al Khaimah", cities: [
    { value: "Ras Al Khaimah", ar: "رأس الخيمة", en: "Ras Al Khaimah" }, { value: "Al Jazirah Al Hamra", ar: "الجزيرة الحمراء", en: "Al Jazirah Al Hamra" },
    { value: "Digdagga", ar: "دقداقة", en: "Digdagga" }, { value: "Khatt", ar: "الخت", en: "Khatt" },
  ] },
  { value: "Fujairah", ar: "الفجيرة", en: "Fujairah", cities: [
    { value: "Fujairah", ar: "الفجيرة", en: "Fujairah" }, { value: "Dibba Al-Fujairah", ar: "دبا الفجيرة", en: "Dibba Al-Fujairah" }, { value: "Masafi", ar: "مسافي", en: "Masafi" },
  ] },
];
