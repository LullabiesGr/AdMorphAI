import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import prisma from "../db.server";
import { connectMeta } from "../services/meta.server";
export const loader=async ({request}:LoaderFunctionArgs)=>{
 const url=new URL(request.url);
 const error=url.searchParams.get("error");
 if(error) return new Response("Meta authorization declined.",{status:400});
 const code=url.searchParams.get("code");
 const nonce=url.searchParams.get("state");
 if(!code||!nonce||!/^[a-f0-9]{64}$/.test(nonce)) return new Response("Invalid OAuth response",{status:400});
 const state=await prisma.metaOauthState.findUnique({where:{nonce}});
 if(!state||state.expiresAt.getTime()<Date.now()) return new Response("OAuth state expired or invalid",{status:403});
 await prisma.metaOauthState.delete({where:{nonce}});
 let connectedAccounts: Array<{id:string,name:string}>=[];
 try {connectedAccounts=await connectMeta(state.shop,code);}
 catch(e) {console.error("Meta OAuth failed",e);return new Response("Could not connect Meta. Return to Shopify and retry.",{status:502});}
 return redirect((connectedAccounts.length===1?"/app/autopilot?run=1&shop=":"/app/meta?shop=")+encodeURIComponent(state.shop));
};
