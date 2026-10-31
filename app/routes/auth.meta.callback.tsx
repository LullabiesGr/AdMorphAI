import type { LoaderFunctionArgs } from "react-router";
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
 
 try {await connectMeta(state.shop,code);}
 catch(e) {console.error("Meta OAuth failed",e);return new Response("Could not connect Meta. Return to Shopify and retry.",{status:502});}
 // OAuth runs in a separate, top-level tab; do not render the embedded Shopify
 // app here. The original Shopify tab polls its authenticated loader and continues.
 const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
 <title>Meta connected — AdMorph AI</title>
 <style>body{font:16px system-ui;background:#f7f9fd;color:#14233b;display:grid;place-items:center;min-height:100vh;margin:0}
 main{max-width:440px;background:white;padding:40px;border:1px solid #e3e8f0;border-radius:16px;box-shadow:0 12px 40px #17355b13}
 h1{font-size:25px;letter-spacing:-.5px;margin:0 0 12px}p{line-height:1.65;color:#536376}</style></head><body>
 <main><h1>Meta account connected</h1>
 <p>Authorization completed successfully. Return to your Shopify AdMorph AI tab to continue with Autopilot.</p>
 <p>You can close this tab.</p></main></body></html>`;
 return new Response(body,{status:200,headers:{
  "Content-Type":"text/html; charset=utf-8",
  "Cache-Control":"no-store","X-Content-Type-Options":"nosniff",
  "Referrer-Policy":"no-referrer","Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'"
 }});
};
