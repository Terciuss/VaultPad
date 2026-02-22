// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

pub mod local;
pub mod remote;

use crate::models::Project;

#[derive(Debug, thiserror::Error)]
pub enum StorageError {
    #[error("Database error: {0}")]
    Database(String),
    #[error("Project not found: {0}")]
    NotFound(String),
    #[error("IO error: {0}")]
    Io(String),
}

pub trait StorageProvider: Send + Sync {
    fn init(&self) -> Result<(), StorageError>;
    fn list_projects(&self) -> Result<Vec<Project>, StorageError>;
    fn get_project(&self, id: &str) -> Result<Project, StorageError>;
    fn create_project(&self, project: &Project) -> Result<(), StorageError>;
    fn update_project(&self, project: &Project) -> Result<(), StorageError>;
    fn delete_project(&self, id: &str) -> Result<(), StorageError>;

    fn get_verification_token(&self) -> Result<Option<Vec<u8>>, StorageError>;
    fn set_verification_token(&self, token: &[u8]) -> Result<(), StorageError>;

    fn get_setting(&self, key: &str) -> Result<Option<String>, StorageError>;
    fn set_setting(&self, key: &str, value: &str) -> Result<(), StorageError>;
}
