import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.webhook(request);
  // AdMorph does not collect or store customer-identifying data in its MVP.
  return new Response(null,{status:200});
};
