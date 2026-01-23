import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  const isProduction = process.env.NODE_ENV === "production";
  
  if (!key) {
    const sessionSecret = process.env.SESSION_SECRET;
    if (!sessionSecret) {
      if (isProduction) {
        throw new Error("[FATAL] ENCRYPTION_KEY 또는 SESSION_SECRET이 설정되지 않았습니다. 프로덕션에서는 필수입니다.");
      }
      console.warn("[Crypto] ENCRYPTION_KEY/SESSION_SECRET 미설정. 개발용 기본값 사용.");
      return crypto.createHash("sha256").update("dev-only-encryption-key").digest();
    }
    console.warn("[Crypto] ENCRYPTION_KEY 미설정. SESSION_SECRET에서 키를 파생합니다.");
    return crypto.createHash("sha256").update(sessionSecret).digest();
  }
  
  if (key.length === 64) {
    return Buffer.from(key, "hex");
  }
  
  return crypto.createHash("sha256").update(key).digest();
}

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();
  const parts = ciphertext.split(":");
  
  if (parts.length !== 3) {
    throw new Error("Invalid ciphertext format");
  }
  
  const [ivHex, tagHex, encrypted] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(tagHex, "hex");
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}

export function isEncrypted(value: string): boolean {
  const parts = value.split(":");
  if (parts.length !== 3) return false;
  
  const [ivHex, tagHex] = parts;
  return ivHex.length === 32 && tagHex.length === 32;
}
