import type {ActionFunctionArgs,LoaderFunctionArgs} from "react-router";
import {recordEvent} from "../services/experiment.server";
const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"POST, OPTIONS",
"Access-Control-Allow-Headers":"Content-Type","Cache-Control":"no-store"};
export const loader=({request}:LoaderFunctionArgs)=>
 new Response(null,{status:request.method==="OPTIONS"?204:405,headers});
export const action=async({request}:ActionFunctionArgs)=>{
 if(request.method!=="POST")return new Response(null,{status:405,headers});
 const size=Number(request.headers.get("content-length")||0);
 if(size>4096)return new Response(null,{status:413,headers});
 try{
  const body=await request.text();
  if(body.length>4096)return new Response(null,{status:413,headers});
  const data=JSON.parse(body);
  const ok=await recordEvent(data.token,data.kind,data.key);
  return Response.json({ok},{status:ok?200:400,headers});
 }catch{return Response.json({ok:false},{status:400,headers});}
};
