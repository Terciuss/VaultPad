// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

pub mod local;
pub mod remote;

use crate::models::{Project, ProjectBackup};

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
    fn create_project(&self, project: &Project) -> Result<Option<String>, StorageError>;
    fn update_project(&self, project: &Project) -> Result<(), StorageError>;
    fn delete_project(&self, id: &str) -> Result<(), StorageError>;

    fn reorder_projects(&self, ids_with_order: &[(String, i32)]) -> Result<(), StorageError>;

    fn get_verification_token(&self) -> Result<Option<Vec<u8>>, StorageError>;
    fn set_verification_token(&self, token: &[u8]) -> Result<(), StorageError>;

    fn get_setting(&self, key: &str) -> Result<Option<String>, StorageError>;
    fn set_setting(&self, key: &str, value: &str) -> Result<(), StorageError>;

    fn create_backup(&self, _backup: &ProjectBackup) -> Result<(), StorageError> { Ok(()) }
    fn update_backup(&self, _backup: &ProjectBackup) -> Result<(), StorageError> { Ok(()) }
    fn list_backups(&self, _project_id: &str) -> Result<Vec<ProjectBackup>, StorageError> { Ok(vec![]) }
    fn get_backup(&self, backup_id: &str) -> Result<ProjectBackup, StorageError> {
        Err(StorageError::NotFound(backup_id.to_string()))
    }
    fn get_latest_backup(&self, _project_id: &str) -> Result<Option<ProjectBackup>, StorageError> { Ok(None) }
    fn delete_backup(&self, _backup_id: &str) -> Result<(), StorageError> { Ok(()) }
    fn cleanup_backups(&self, _project_id: &str, _keep_count: usize) -> Result<(), StorageError> { Ok(()) }
}
