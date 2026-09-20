import { handleAdmin } from "../src/admin.js";

export async function onRequest(context) {
  const adminResponse = await handleAdmin(context.request, context.env);
  if (adminResponse) return adminResponse;
  return context.next();
}
