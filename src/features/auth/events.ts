export function announceAuth(type: "login" | "logout", userId?: string) {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel("pds07-auth");
  channel.postMessage({ type, userId });
  channel.close();
}
