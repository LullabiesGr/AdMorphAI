import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop } = await authenticate.webhook(request);
  await prisma.$transaction([
    prisma.shop.deleteMany({where:{domain:shop}}),
    prisma.metaOauthState.deleteMany({where:{shop}}),
    prisma.session.deleteMany({where:{shop}}),
  ]);
  return new Response(null,{status:200});
};
