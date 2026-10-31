import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Link, Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";
import "../styles.css";
export const loader=async({request}:LoaderFunctionArgs)=>{
 await authenticate.admin(request);
 return {apiKey:process.env.SHOPIFY_API_KEY||""};
};
export default function App(){
 const {apiKey}=useLoaderData<typeof loader>();
 return <AppProvider apiKey={apiKey}>
  <nav className="ad-topnav" aria-label="AdMorph navigation">
   <Link to="/app">Overview</Link>
   <Link to="/app/autopilot">Autopilot</Link>
   <Link to="/app/meta">Meta Ads</Link>
   <Link to="/app/campaigns">AI Campaigns</Link>
  </nav>
  <Outlet/>
 </AppProvider>;
}
export function ErrorBoundary(){return boundary.error(useRouteError());}
export const headers:HeadersFunction=args=>boundary.headers(args);
