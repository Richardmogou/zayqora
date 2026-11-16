import { cookies } from "next/headers";
import { COOKIE, DEFAULT_LOCALE, LOCALES, dictionaries, translate, type Locale, type Vars } from "./dictionaries";

export function getLocale(): Locale {
  const v = cookies().get(COOKIE)?.value;
  return LOCALES.includes(v as Locale) ? (v as Locale) : DEFAULT_LOCALE;
}

export function getT() {
  const dict = dictionaries[getLocale()];
  return (key: string, vars?: Vars) => translate(dict, key, vars);
}

export function getL() {
  const fr = getLocale() === "fr";
  return (en: string, frText: string) => (fr ? frText : en);
}
