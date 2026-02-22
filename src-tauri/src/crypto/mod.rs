// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use argon2::{Argon2, Params, Version};
use rand::RngCore;
use zeroize::Zeroize;

const SALT_LEN: usize = 16;
const NONCE_LEN: usize = 12;
pub const KEY_LEN: usize = 32;

const ARGON2_MEMORY_KB: u32 = 16384; // 16 MB -- balanced for local desktop use
const ARGON2_ITERATIONS: u32 = 1;
const ARGON2_PARALLELISM: u32 = 1;

const LEGACY_ARGON2_MEMORY_KB: u32 = 65536; // old: 64 MB
const LEGACY_ARGON2_ITERATIONS: u32 = 3;
const LEGACY_ARGON2_PARALLELISM: u32 = 4;

const PIN_ARGON2_MEMORY_KB: u32 = 4096; // 4 MB
const PIN_ARGON2_ITERATIONS: u32 = 1;
const PIN_ARGON2_PARALLELISM: u32 = 1;

const VERIFICATION_PLAINTEXT: &[u8] = b"ACCESS_STORAGE_OK";

const FORMAT_V2: u8 = 0x02;

#[derive(Debug, thiserror::Error)]
pub enum CryptoError {
    #[error("Encryption failed: {0}")]
    EncryptionFailed(String),
    #[error("Decryption failed: {0}")]
    DecryptionFailed(String),
    #[error("Invalid data format")]
    InvalidFormat,
    #[error("Key derivation failed: {0}")]
    KeyDerivationFailed(String),
}

fn derive_key_with_params(
    password: &[u8],
    salt: &[u8],
    memory_kb: u32,
    iterations: u32,
    parallelism: u32,
) -> Result<[u8; KEY_LEN], CryptoError> {
    let params = Params::new(memory_kb, iterations, parallelism, Some(KEY_LEN))
        .map_err(|e| CryptoError::KeyDerivationFailed(e.to_string()))?;
    let argon2 = Argon2::new(argon2::Algorithm::Argon2id, Version::V0x13, params);
    let mut key = [0u8; KEY_LEN];
    argon2
        .hash_password_into(password, salt, &mut key)
        .map_err(|e| CryptoError::KeyDerivationFailed(e.to_string()))?;
    Ok(key)
}

fn derive_key(password: &[u8], salt: &[u8]) -> Result<[u8; KEY_LEN], CryptoError> {
    derive_key_with_params(password, salt, ARGON2_MEMORY_KB, ARGON2_ITERATIONS, ARGON2_PARALLELISM)
}

pub fn derive_master_key(password: &str) -> Result<[u8; KEY_LEN], CryptoError> {
    let salt = b"access-storage-session-key-salt!";
    derive_key(password.as_bytes(), salt)
}

/// V2 encrypt: version(1) || nonce(12) || ciphertext. Uses pre-derived key, no Argon2id.
pub fn encrypt_with_key(plaintext: &[u8], key: &[u8; KEY_LEN]) -> Result<Vec<u8>, CryptoError> {
    let mut nonce_bytes = [0u8; NONCE_LEN];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);

    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| CryptoError::EncryptionFailed(e.to_string()))?;
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|e| CryptoError::EncryptionFailed(e.to_string()))?;

    let mut result = Vec::with_capacity(1 + NONCE_LEN + ciphertext.len());
    result.push(FORMAT_V2);
    result.extend_from_slice(&nonce_bytes);
    result.extend_from_slice(&ciphertext);
    Ok(result)
}

/// Attempts V2 decryption only. Returns Some(plaintext) if data is V2-format and the key matches.
pub fn try_decrypt_with_key(data: &[u8], key: &[u8; KEY_LEN]) -> Option<Vec<u8>> {
    if data.is_empty() || data[0] != FORMAT_V2 || data.len() < 1 + NONCE_LEN + 1 {
        return None;
    }
    let nonce = Nonce::from_slice(&data[1..1 + NONCE_LEN]);
    let ciphertext = &data[1 + NONCE_LEN..];
    let cipher = Aes256Gcm::new_from_slice(key).ok()?;
    cipher.decrypt(nonce, ciphertext).ok()
}

/// Decrypts both V1 (salt+nonce+ct, Argon2id) and V2 (version+nonce+ct, pre-derived key) formats.
/// Tries V2 first if a cached key is provided, falls back to V1 with password.
pub fn decrypt_auto(
    data: &[u8],
    cached_key: Option<&[u8; KEY_LEN]>,
    password: Option<&str>,
) -> Result<Vec<u8>, CryptoError> {
    if data.is_empty() {
        return Err(CryptoError::InvalidFormat);
    }

    if data[0] == FORMAT_V2 {
        let key = cached_key.ok_or(CryptoError::DecryptionFailed(
            "V2 format requires cached key".to_string(),
        ))?;
        if data.len() < 1 + NONCE_LEN + 1 {
            return Err(CryptoError::InvalidFormat);
        }
        let nonce_bytes = &data[1..1 + NONCE_LEN];
        let ciphertext = &data[1 + NONCE_LEN..];
        let cipher = Aes256Gcm::new_from_slice(key)
            .map_err(|e| CryptoError::DecryptionFailed(e.to_string()))?;
        let nonce = Nonce::from_slice(nonce_bytes);
        return cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| CryptoError::DecryptionFailed(e.to_string()));
    }

    if let Some(key) = cached_key {
        if data.len() >= SALT_LEN + NONCE_LEN + 1 {
            let nonce_bytes = &data[SALT_LEN..SALT_LEN + NONCE_LEN];
            let ciphertext = &data[SALT_LEN + NONCE_LEN..];
            let cipher = Aes256Gcm::new_from_slice(key)
                .map_err(|e| CryptoError::DecryptionFailed(e.to_string()))?;
            let nonce = Nonce::from_slice(nonce_bytes);
            if let Ok(plaintext) = cipher.decrypt(nonce, ciphertext) {
                return Ok(plaintext);
            }
        }
    }

    if let Some(pw) = password {
        return decrypt(data, pw);
    }

    Err(CryptoError::DecryptionFailed("No key or password available".to_string()))
}

/// V1 encrypt: salt(16) || nonce(12) || ciphertext. Runs Argon2id each time.
pub fn encrypt(plaintext: &[u8], password: &str) -> Result<Vec<u8>, CryptoError> {
    let mut salt = [0u8; SALT_LEN];
    let mut nonce_bytes = [0u8; NONCE_LEN];
    rand::thread_rng().fill_bytes(&mut salt);
    rand::thread_rng().fill_bytes(&mut nonce_bytes);

    let mut key = derive_key(password.as_bytes(), &salt)?;
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| CryptoError::EncryptionFailed(e.to_string()))?;
    key.zeroize();

    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|e| CryptoError::EncryptionFailed(e.to_string()))?;

    let mut result = Vec::with_capacity(SALT_LEN + NONCE_LEN + ciphertext.len());
    result.extend_from_slice(&salt);
    result.extend_from_slice(&nonce_bytes);
    result.extend_from_slice(&ciphertext);
    Ok(result)
}

/// V1 decrypt: salt(16) || nonce(12) || ciphertext.
/// Tries current Argon2id params first, then falls back to legacy params.
pub fn decrypt(data: &[u8], password: &str) -> Result<Vec<u8>, CryptoError> {
    if data.len() < SALT_LEN + NONCE_LEN + 1 {
        return Err(CryptoError::InvalidFormat);
    }

    let salt = &data[..SALT_LEN];
    let nonce_bytes = &data[SALT_LEN..SALT_LEN + NONCE_LEN];
    let ciphertext = &data[SALT_LEN + NONCE_LEN..];
    let nonce = Nonce::from_slice(nonce_bytes);

    // Try current params first (fast)
    if let Ok(mut key) = derive_key(password.as_bytes(), salt) {
        if let Ok(cipher) = Aes256Gcm::new_from_slice(&key) {
            if let Ok(plaintext) = cipher.decrypt(nonce, ciphertext) {
                key.zeroize();
                return Ok(plaintext);
            }
        }
        key.zeroize();
    }

    // Fall back to legacy params (slow but handles old data)
    let mut key = derive_key_with_params(
        password.as_bytes(), salt,
        LEGACY_ARGON2_MEMORY_KB, LEGACY_ARGON2_ITERATIONS, LEGACY_ARGON2_PARALLELISM,
    )?;
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| CryptoError::DecryptionFailed(e.to_string()))?;
    key.zeroize();

    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| CryptoError::DecryptionFailed(e.to_string()))
}

pub fn create_verification_token(password: &str) -> Result<Vec<u8>, CryptoError> {
    encrypt(VERIFICATION_PLAINTEXT, password)
}

pub fn verify_password(token: &[u8], password: &str) -> bool {
    match decrypt(token, password) {
        Ok(plaintext) => plaintext == VERIFICATION_PLAINTEXT,
        Err(_) => false,
    }
}

pub fn create_pin_verification_token(pin: &str) -> Result<Vec<u8>, CryptoError> {
    let mut salt = [0u8; SALT_LEN];
    let mut nonce_bytes = [0u8; NONCE_LEN];
    rand::thread_rng().fill_bytes(&mut salt);
    rand::thread_rng().fill_bytes(&mut nonce_bytes);

    let mut key = derive_key_with_params(
        pin.as_bytes(), &salt,
        PIN_ARGON2_MEMORY_KB, PIN_ARGON2_ITERATIONS, PIN_ARGON2_PARALLELISM,
    )?;
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| CryptoError::EncryptionFailed(e.to_string()))?;
    key.zeroize();

    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher
        .encrypt(nonce, VERIFICATION_PLAINTEXT)
        .map_err(|e| CryptoError::EncryptionFailed(e.to_string()))?;

    let mut result = Vec::with_capacity(SALT_LEN + NONCE_LEN + ciphertext.len());
    result.extend_from_slice(&salt);
    result.extend_from_slice(&nonce_bytes);
    result.extend_from_slice(&ciphertext);
    Ok(result)
}

pub fn verify_pin(token: &[u8], pin: &str) -> bool {
    if token.len() < SALT_LEN + NONCE_LEN + 1 {
        return false;
    }
    let salt = &token[..SALT_LEN];
    let nonce_bytes = &token[SALT_LEN..SALT_LEN + NONCE_LEN];
    let ciphertext = &token[SALT_LEN + NONCE_LEN..];

    let key = match derive_key_with_params(
        pin.as_bytes(), salt,
        PIN_ARGON2_MEMORY_KB, PIN_ARGON2_ITERATIONS, PIN_ARGON2_PARALLELISM,
    ) {
        Ok(k) => k,
        Err(_) => return false,
    };
    let cipher = match Aes256Gcm::new_from_slice(&key) {
        Ok(c) => c,
        Err(_) => return false,
    };
    let nonce = Nonce::from_slice(nonce_bytes);
    match cipher.decrypt(nonce, ciphertext) {
        Ok(plaintext) => plaintext == VERIFICATION_PLAINTEXT,
        Err(_) => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt() {
        let password = "test_password_123";
        let plaintext = b"Hello, World!";
        let encrypted = encrypt(plaintext, password).unwrap();
        let decrypted = decrypt(&encrypted, password).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_wrong_password() {
        let encrypted = encrypt(b"secret data", "correct_password").unwrap();
        assert!(decrypt(&encrypted, "wrong_password").is_err());
    }

    #[test]
    fn test_verification_token() {
        let password = "my_master_pass";
        let token = create_verification_token(password).unwrap();
        assert!(verify_password(&token, password));
        assert!(!verify_password(&token, "wrong_pass"));
    }

    #[test]
    fn test_different_encryptions_produce_different_output() {
        let password = "same_password";
        let plaintext = b"same data";
        let enc1 = encrypt(plaintext, password).unwrap();
        let enc2 = encrypt(plaintext, password).unwrap();
        assert_ne!(enc1, enc2);
    }

    #[test]
    fn test_v2_encrypt_decrypt() {
        let key = derive_master_key("test_password").unwrap();
        let plaintext = b"Hello V2!";
        let encrypted = encrypt_with_key(plaintext, &key).unwrap();
        assert_eq!(encrypted[0], FORMAT_V2);
        let decrypted = decrypt_auto(&encrypted, Some(&key), None).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_v1_decrypt_with_cached_key_fallback_to_password() {
        let password = "test_pass";
        let plaintext = b"V1 data";
        let encrypted = encrypt(plaintext, password).unwrap();
        let decrypted = decrypt_auto(&encrypted, None, Some(password)).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_pin_verification() {
        let pin = "1234";
        let token = create_pin_verification_token(pin).unwrap();
        assert!(verify_pin(&token, pin));
        assert!(!verify_pin(&token, "5678"));
    }
}
