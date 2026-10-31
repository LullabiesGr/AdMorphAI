import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.webhook(request);
  // No customer records are stored.
  return new Response(null,{status:200});
};
