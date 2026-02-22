// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

use base64::{engine::general_purpose::STANDARD as B64, Engine};
use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};

use super::{StorageError, StorageProvider};
use crate::models::Project;

#[derive(Serialize, Deserialize)]
struct ServerProject {
    id: i64,
    user_id: i64,
    encrypted_name: String,
    encrypted_content: String,
    sort_order: i32,
    created_at: String,
    updated_at: String,
}

#[derive(Serialize)]
struct CreateProjectPayload {
    encrypted_name: String,
    encrypted_content: String,
    sort_order: i32,
}

#[derive(Serialize)]
struct UpdateProjectPayload {
    encrypted_name: String,
    encrypted_content: String,
    sort_order: i32,
}

pub struct RemoteStorage {
    client: Client,
    base_url: String,
    token: String,
}

fn req_err(e: reqwest::Error) -> StorageError {
    StorageError::Io(e.to_string())
}

impl RemoteStorage {
    pub fn new(base_url: &str, token: &str) -> Self {
        Self {
            client: Client::new(),
            base_url: base_url.trim_end_matches('/').to_string(),
            token: token.to_string(),
        }
    }

    fn url(&self, path: &str) -> String {
        format!("{}/api{}", self.base_url, path)
    }

    fn auth_header(&self) -> String {
        format!("Bearer {}", self.token)
    }
}

impl StorageProvider for RemoteStorage {
    fn init(&self) -> Result<(), StorageError> {
        let resp = self.client.get(self.url("/health")).send().map_err(req_err)?;
        if !resp.status().is_success() {
            return Err(StorageError::Io("Server health check failed".into()));
        }
        Ok(())
    }

    fn list_projects(&self) -> Result<Vec<Project>, StorageError> {
        let resp = self
            .client
            .get(self.url("/projects"))
            .header("Authorization", self.auth_header())
            .send()
            .map_err(req_err)?;

        if !resp.status().is_success() {
            let text = resp.text().unwrap_or_default();
            return Err(StorageError::Io(format!("Server error: {}", text)));
        }

        let server_projects: Vec<ServerProject> = resp.json().map_err(req_err)?;

        server_projects
            .into_iter()
            .map(|sp| {
                Ok(Project {
                    id: sp.id.to_string(),
                    encrypted_name: B64
                        .decode(&sp.encrypted_name)
                        .map_err(|e| StorageError::Io(e.to_string()))?,
                    encrypted_content: B64
                        .decode(&sp.encrypted_content)
                        .map_err(|e| StorageError::Io(e.to_string()))?,
                    sort_order: sp.sort_order,
                    created_at: sp.created_at,
                    updated_at: sp.updated_at,
                    server_id: Some(sp.id.to_string()),
                    sync_status: "synced".to_string(),
                })
            })
            .collect()
    }

    fn get_project(&self, id: &str) -> Result<Project, StorageError> {
        let resp = self
            .client
            .get(self.url(&format!("/projects/{}", id)))
            .header("Authorization", self.auth_header())
            .send()
            .map_err(req_err)?;

        if !resp.status().is_success() {
            return Err(StorageError::NotFound(id.to_string()));
        }

        let sp: ServerProject = resp.json().map_err(req_err)?;

        Ok(Project {
            id: sp.id.to_string(),
            encrypted_name: B64
                .decode(&sp.encrypted_name)
                .map_err(|e| StorageError::Io(e.to_string()))?,
            encrypted_content: B64
                .decode(&sp.encrypted_content)
                .map_err(|e| StorageError::Io(e.to_string()))?,
            sort_order: sp.sort_order,
            created_at: sp.created_at,
            updated_at: sp.updated_at,
            server_id: Some(sp.id.to_string()),
            sync_status: "synced".to_string(),
        })
    }

    fn create_project(&self, project: &Project) -> Result<(), StorageError> {
        let payload = CreateProjectPayload {
            encrypted_name: B64.encode(&project.encrypted_name),
            encrypted_content: B64.encode(&project.encrypted_content),
            sort_order: project.sort_order,
        };

        let resp = self
            .client
            .post(self.url("/projects"))
            .header("Authorization", self.auth_header())
            .json(&payload)
            .send()
            .map_err(req_err)?;

        if !resp.status().is_success() {
            let text = resp.text().unwrap_or_default();
            return Err(StorageError::Io(format!("Create failed: {}", text)));
        }
        Ok(())
    }

    fn update_project(&self, project: &Project) -> Result<(), StorageError> {
        let server_id = project.server_id.as_deref().unwrap_or(&project.id);

        let payload = UpdateProjectPayload {
            encrypted_name: B64.encode(&project.encrypted_name),
            encrypted_content: B64.encode(&project.encrypted_content),
            sort_order: project.sort_order,
        };

        let resp = self
            .client
            .put(self.url(&format!("/projects/{}", server_id)))
            .header("Authorization", self.auth_header())
            .json(&payload)
            .send()
            .map_err(req_err)?;

        if !resp.status().is_success() {
            let text = resp.text().unwrap_or_default();
            return Err(StorageError::Io(format!("Update failed: {}", text)));
        }
        Ok(())
    }

    fn delete_project(&self, id: &str) -> Result<(), StorageError> {
        let resp = self
            .client
            .delete(self.url(&format!("/projects/{}", id)))
            .header("Authorization", self.auth_header())
            .send()
            .map_err(req_err)?;

        if !resp.status().is_success() {
            return Err(StorageError::NotFound(id.to_string()));
        }
        Ok(())
    }

    fn reorder_projects(&self, _ids_with_order: &[(String, i32)]) -> Result<(), StorageError> {
        Ok(())
    }

    fn get_verification_token(&self) -> Result<Option<Vec<u8>>, StorageError> {
        Ok(None)
    }

    fn set_verification_token(&self, _token: &[u8]) -> Result<(), StorageError> {
        Ok(())
    }

    fn get_setting(&self, _key: &str) -> Result<Option<String>, StorageError> {
        Ok(None)
    }

    fn set_setting(&self, _key: &str, _value: &str) -> Result<(), StorageError> {
        Ok(())
    }
}
