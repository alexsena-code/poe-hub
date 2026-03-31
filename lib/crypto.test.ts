import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "./crypto";

describe("lib/crypto", () => {
  it("should encrypt and decrypt a simple string", () => {
    const plaintext = "my-secret-password";
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("should produce different ciphertexts for the same input (random IV)", () => {
    const plaintext = "same-input";
    const encrypted1 = encrypt(plaintext);
    const encrypted2 = encrypt(plaintext);
    expect(encrypted1).not.toBe(encrypted2);
  });

  it("should both encrypt/decrypt roundtrip for empty string", () => {
    const encrypted = encrypt("");
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe("");
  });

  it("should handle unicode characters", () => {
    const plaintext = "senhaComAcentuação: ñ, ü, 你好, 🔑";
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("should handle long strings", () => {
    const plaintext = "a".repeat(10000);
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("should produce ciphertext in iv:tag:data format", () => {
    const encrypted = encrypt("test");
    const parts = encrypted.split(":");
    expect(parts).toHaveLength(3);
    // IV = 16 bytes = 32 hex chars
    expect(parts[0]).toHaveLength(32);
    // Tag = 16 bytes = 32 hex chars
    expect(parts[1]).toHaveLength(32);
    // Data should be non-empty hex
    expect(parts[2].length).toBeGreaterThan(0);
  });

  it("should throw on tampered ciphertext", () => {
    const encrypted = encrypt("test");
    const parts = encrypted.split(":");
    // Tamper with the ciphertext data
    const tampered = parts[0] + ":" + parts[1] + ":ff" + parts[2].slice(2);
    expect(() => decrypt(tampered)).toThrow();
  });

  it("should throw on invalid format", () => {
    expect(() => decrypt("not-valid-format")).toThrow("Invalid ciphertext format");
  });
});
