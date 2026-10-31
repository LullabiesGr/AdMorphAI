import {createElement} from "react";
import type {HeadersFunction,LoaderFunctionArgs} from "react-router";
import {Outlet,useLoaderData,useRouteError} from "react-router";
import {boundary} from "@shopify/shopify-app-react-router/server";
import {AppProvider} from "@shopify/shopify-app-react-router/react";
import {authenticate} from "../shopify.server";
import "../styles.css";

export const loader=async({request}:LoaderFunctionArgs)=>{
 await authenticate.admin(request);
 return {apiKey:process.env.SHOPIFY_API_KEY||""};
};

/** Shopify App Bridge renders s-app-nav in the native admin left sidebar.
 * createElement avoids out-of-date custom-element JSX type packages.
 */
export default function App(){
 const {apiKey}=useLoaderData<typeof loader>();
 const navItems=[
  {href:"/app",label:"Overview",home:true},
  {href:"/app/getting-started",label:"Getting started"},
  {href:"/app/autopilot",label:"Autopilot"},
  {href:"/app/meta",label:"Meta Ads"},
  {href:"/app/campaigns",label:"AI campaigns"},
  {href:"/app/theme",label:"Theme activation"},
  {href:"/app/settings",label:"Settings"},
  {href:"/app/help",label:"Help"},
 ];
 return <AppProvider apiKey={apiKey}>
   {createElement("s-app-nav",null,...navItems.map(item=>
      createElement("s-link",{key:item.href,href:item.href,...(item.home?{rel:"home"}:{})},item.label)
   ))}
   <Outlet/>
 </AppProvider>;
}
export function ErrorBoundary(){return boundary.error(useRouteError());}
export const headers:HeadersFunction=args=>boundary.headers(args);
