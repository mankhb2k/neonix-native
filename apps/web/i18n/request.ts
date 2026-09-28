import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isLocale, localeCookieName } from "./locales";
import type { AbstractIntlMessages } from "next-intl";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(localeCookieName)?.value;
  const locale = cookieLocale && isLocale(cookieLocale) ? cookieLocale : defaultLocale;

  const messagesModule = (await import(`../messages/${locale}.json`)) as {
    default: AbstractIntlMessages;
  };

  return {
    locale,
    messages: messagesModule.default,
  };
});
