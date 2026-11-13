import ar from "@/messages/ar.json";
import en from "@/messages/en.json";
import type { Locale } from "./config";

export type Dictionary = typeof ar;

const dictionaries: Record<Locale, Dictionary> = { ar, en };

export const getDictionary = (locale: Locale): Dictionary => dictionaries[locale];
