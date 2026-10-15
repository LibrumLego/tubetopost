export function getSiteOrigin() {
  return new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://tubetopost.vercel.app").origin;
}
