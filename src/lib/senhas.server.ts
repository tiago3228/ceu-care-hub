import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Criptografia simétrica AES-256-GCM das credenciais.
 * A chave vive apenas no servidor (SENHAS_CRYPTO_KEY) e nunca é enviada ao navegador.
 */
function chave() {
  const bruta = process.env["SENHAS_CRYPTO_KEY"];
  if (!bruta) throw new Error("Cofre de senhas não configurado.");
  return createHash("sha256").update(bruta).digest();
}

export function cifrar(texto: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", chave(), iv);
  const dados = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${dados.toString("base64")}`;
}

export function decifrar(pacote: string) {
  const partes = pacote.split(":");
  if (partes.length !== 4 || partes[0] !== "v1") throw new Error("Credencial inválida.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    chave(),
    Buffer.from(partes[1]!, "base64"),
  );
  decipher.setAuthTag(Buffer.from(partes[2]!, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(partes[3]!, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
