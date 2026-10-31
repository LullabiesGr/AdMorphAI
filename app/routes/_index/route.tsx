import type { LoaderFunctionArgs } from "react-router";
import { Form, redirect } from "react-router";
export const loader = async ({ request }: LoaderFunctionArgs) => {
 const u=new URL(request.url); if(u.searchParams.has("shop")) throw redirect("/app?"+u.searchParams.toString());
 return null;
};
export default function Index(){return <main style={{maxWidth:640,margin:"12vh auto",fontFamily:"Inter, sans-serif",padding:24}}>
<h1 style={{fontSize:42,letterSpacing:"-2px"}}>AdMorph AI</h1>
<p>Turn every Meta ad into a more relevant Shopify product experience.</p>
<Form action="/auth/login" method="post">
<label htmlFor="shop">Your Shopify domain</label><br/>
<input id="shop" name="shop" required placeholder="example.myshopify.com" style={{width:"100%",padding:14,margin:"12px 0"}}/>
<button type="submit" style={{padding:"12px 24px",background:"#151515",color:"white",borderRadius:8}}>Continue to Shopify</button>
</Form></main>;}
