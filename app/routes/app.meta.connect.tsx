import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { randomBytes } from "node:crypto";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { metaAuthorizeUrl } from "../services/meta.server";
export const loader=async ({request}:LoaderFunctionArgs)=>{
 const {session}=await authenticate.admin(request);
 const shop=session.shop;
 const nonce=randomBytes(32).toString("hex");
 await prisma.metaOauthState.create({data:{nonce,shop,expiresAt:new Date(Date.now()+10*60*1000)}});
 return redirect(metaAuthorizeUrl(nonce));
};
