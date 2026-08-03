import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const VERSION = "v1";

function encryptionKey() {
  const source =
    process.env.PLATFORM_CREDENTIAL_ENCRYPTION_KEY?.trim() ||
    process.env.NEON_AUTH_COOKIE_SECRET?.trim();
  if (!source) {
    throw new Error("A platform credential encryption key is required.");
  }
  return createHash("sha256").update(source).digest();
}

export function encryptPlatformSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptPlatformSecret(value: string) {
  const [version, ivValue, tagValue, ciphertextValue] = value.split(".");
  if (version !== VERSION || !ivValue || !tagValue || !ciphertextValue) {
    throw new Error("The encrypted credential format is invalid.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
