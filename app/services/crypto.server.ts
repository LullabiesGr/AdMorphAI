import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
function getKey() {
  const value=process.env.TOKEN_ENCRYPTION_KEY;
  if (!value) throw new Error("TOKEN_ENCRYPTION_KEY is required");
  const key=Buffer.from(value,"base64");
  if(key.length!==32) throw new Error("TOKEN_ENCRYPTION_KEY must be 32 bytes encoded as base64");
  return key;
}
export function encrypt(value: string): string {
  const iv=randomBytes(12);
  const cipher=createCipheriv("aes-256-gcm",getKey(),iv);
  const ciphertext=Buffer.concat([cipher.update(value,"utf8"),cipher.final()]);
  return [iv,cipher.getAuthTag(),ciphertext].map(x=>x.toString("base64url")).join(".");
}
export function decrypt(value: string): string {
  const parts=value.split(".");
  if(parts.length!==3) throw new Error("Malformed encrypted token");
  const [iv,tag,ciphertext]=parts.map(x=>Buffer.from(x,"base64url"));
  const decipher=createDecipheriv("aes-256-gcm",getKey(),iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext),decipher.final()]).toString("utf8");
}
