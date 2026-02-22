// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

use rusqlite::{params, Connection};
use std::sync::Mutex;

use crate::models::Project;
use super::{StorageError, StorageProvider};

pub struct LocalStorage {
    conn: Mutex<Connection>,
}

impl LocalStorage {
    pub fn new(db_path: &str) -> Result<Self, StorageError> {
        let conn = Connection::open(db_path)
            .map_err(|e| StorageError::Database(e.to_string()))?;
        let storage = Self {
            conn: Mutex::new(conn),
        };
        storage.init()?;
        Ok(storage)
    }
}

impl StorageProvider for LocalStorage {
    fn init(&self) -> Result<(), StorageError> {
        let conn = self.conn.lock().map_err(|e| StorageError::Database(e.to_string()))?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                encrypted_name BLOB NOT NULL,
                encrypted_content BLOB NOT NULL,
                sort_order INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                server_id TEXT,
                sync_status TEXT DEFAULT 'local'
            );
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS verification (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                token BLOB NOT NULL
            );"
        )
        .map_err(|e| StorageError::Database(e.to_string()))?;
        Ok(())
    }

    fn list_projects(&self) -> Result<Vec<Project>, StorageError> {
        let conn = self.conn.lock().map_err(|e| StorageError::Database(e.to_string()))?;
        let mut stmt = conn
            .prepare(
                "SELECT id, encrypted_name, encrypted_content,
                        sort_order, created_at, updated_at, server_id, sync_status
                 FROM projects ORDER BY sort_order ASC, created_at ASC",
            )
            .map_err(|e| StorageError::Database(e.to_string()))?;

        let projects = stmt
            .query_map([], |row| {
                Ok(Project {
                    id: row.get(0)?,
                    encrypted_name: row.get(1)?,
                    encrypted_content: row.get(2)?,
                    sort_order: row.get(3)?,
                    created_at: row.get(4)?,
                    updated_at: row.get(5)?,
                    server_id: row.get(6)?,
                    sync_status: row.get(7)?,
                })
            })
            .map_err(|e| StorageError::Database(e.to_string()))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| StorageError::Database(e.to_string()))?;

        Ok(projects)
    }

    fn get_project(&self, id: &str) -> Result<Project, StorageError> {
        let conn = self.conn.lock().map_err(|e| StorageError::Database(e.to_string()))?;
        conn.query_row(
            "SELECT id, encrypted_name, encrypted_content,
                    sort_order, created_at, updated_at, server_id, sync_status
             FROM projects WHERE id = ?1",
            params![id],
            |row| {
                Ok(Project {
                    id: row.get(0)?,
                    encrypted_name: row.get(1)?,
                    encrypted_content: row.get(2)?,
                    sort_order: row.get(3)?,
                    created_at: row.get(4)?,
                    updated_at: row.get(5)?,
                    server_id: row.get(6)?,
                    sync_status: row.get(7)?,
                })
            },
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                StorageError::NotFound(id.to_string())
            }
            _ => StorageError::Database(e.to_string()),
        })
    }

    fn create_project(&self, project: &Project) -> Result<(), StorageError> {
        let conn = self.conn.lock().map_err(|e| StorageError::Database(e.to_string()))?;
        conn.execute(
            "INSERT INTO projects (id, encrypted_name, encrypted_content,
                                   sort_order, created_at, updated_at, server_id, sync_status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                project.id,
                project.encrypted_name,
                project.encrypted_content,
                project.sort_order,
                project.created_at,
                project.updated_at,
                project.server_id,
                project.sync_status,
            ],
        )
        .map_err(|e| StorageError::Database(e.to_string()))?;
        Ok(())
    }

    fn update_project(&self, project: &Project) -> Result<(), StorageError> {
        let conn = self.conn.lock().map_err(|e| StorageError::Database(e.to_string()))?;
        let rows = conn
            .execute(
                "UPDATE projects SET encrypted_name = ?2, encrypted_content = ?3,
                        sort_order = ?4, updated_at = ?5,
                        server_id = ?6, sync_status = ?7
                 WHERE id = ?1",
                params![
                    project.id,
                    project.encrypted_name,
                    project.encrypted_content,
                    project.sort_order,
                    project.updated_at,
                    project.server_id,
                    project.sync_status,
                ],
            )
            .map_err(|e| StorageError::Database(e.to_string()))?;

        if rows == 0 {
            return Err(StorageError::NotFound(project.id.clone()));
        }
        Ok(())
    }

    fn delete_project(&self, id: &str) -> Result<(), StorageError> {
        let conn = self.conn.lock().map_err(|e| StorageError::Database(e.to_string()))?;
        let rows = conn
            .execute("DELETE FROM projects WHERE id = ?1", params![id])
            .map_err(|e| StorageError::Database(e.to_string()))?;

        if rows == 0 {
            return Err(StorageError::NotFound(id.to_string()));
        }
        Ok(())
    }

    fn reorder_projects(&self, ids_with_order: &[(String, i32)]) -> Result<(), StorageError> {
        let conn = self.conn.lock().map_err(|e| StorageError::Database(e.to_string()))?;
        let tx = conn.unchecked_transaction()
            .map_err(|e| StorageError::Database(e.to_string()))?;
        for (id, order) in ids_with_order {
            tx.execute(
                "UPDATE projects SET sort_order = ?1 WHERE id = ?2",
                params![order, id],
            )
            .map_err(|e| StorageError::Database(e.to_string()))?;
        }
        tx.commit().map_err(|e| StorageError::Database(e.to_string()))?;
        Ok(())
    }

    fn get_verification_token(&self) -> Result<Option<Vec<u8>>, StorageError> {
        let conn = self.conn.lock().map_err(|e| StorageError::Database(e.to_string()))?;
        match conn.query_row("SELECT token FROM verification WHERE id = 1", [], |row| {
            row.get(0)
        }) {
            Ok(token) => Ok(Some(token)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(StorageError::Database(e.to_string())),
        }
    }

    fn set_verification_token(&self, token: &[u8]) -> Result<(), StorageError> {
        let conn = self.conn.lock().map_err(|e| StorageError::Database(e.to_string()))?;
        conn.execute(
            "INSERT OR REPLACE INTO verification (id, token) VALUES (1, ?1)",
            params![token],
        )
        .map_err(|e| StorageError::Database(e.to_string()))?;
        Ok(())
    }

    fn get_setting(&self, key: &str) -> Result<Option<String>, StorageError> {
        let conn = self.conn.lock().map_err(|e| StorageError::Database(e.to_string()))?;
        match conn.query_row(
            "SELECT value FROM settings WHERE key = ?1",
            params![key],
            |row| row.get(0),
        ) {
            Ok(value) => Ok(Some(value)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(StorageError::Database(e.to_string())),
        }
    }

    fn set_setting(&self, key: &str, value: &str) -> Result<(), StorageError> {
        let conn = self.conn.lock().map_err(|e| StorageError::Database(e.to_string()))?;
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            params![key, value],
        )
        .map_err(|e| StorageError::Database(e.to_string()))?;
        Ok(())
    }
}
