import type { Subscription } from "./rules";

/** Never send a signing secret to the browser after creation. */
export function publicView(sub: Subscription) {
  const { secret, ...rest } = sub;
  return { ...rest, secretPreview: `${secret.slice(0, 12)}…` };
}
