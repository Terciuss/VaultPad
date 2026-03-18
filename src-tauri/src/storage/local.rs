// Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
// Licensed under the PolyForm Noncommercial License 1.0.0

use rusqlite::{params, Connection};
use std::sync::Mutex;

use crate::models::{Project, ProjectBackup};
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
                name TEXT NOT NULL DEFAULT '',
                encrypted_content BLOB NOT NULL,
                key_check BLOB,
                sort_order INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                server_id TEXT,
                sync_status TEXT DEFAULT 'local',
                last_synced_at TEXT
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

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS project_backups (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                name TEXT NOT NULL DEFAULT '',
                encrypted_content BLOB NOT NULL,
                key_check BLOB,
                created_at TEXT NOT NULL,
                trigger_type TEXT NOT NULL,
                content_length INTEGER NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_backups_project
                ON project_backups(project_id, created_at DESC);"
        )
        .map_err(|e| StorageError::Database(e.to_string()))?;

        conn.execute_batch("PRAGMA foreign_keys = ON;")
            .map_err(|e| StorageError::Database(e.to_string()))?;

        let project_cols: Vec<String> = {
            let mut stmt = conn
                .prepare("PRAGMA table_info(projects)")
                .map_err(|e| StorageError::Database(e.to_string()))?;
            let rows = stmt.query_map([], |row| row.get::<_, String>(1))
                .map_err(|e| StorageError::Database(e.to_string()))?;
            rows.filter_map(|r| r.ok()).collect()
        };
        if !project_cols.contains(&"last_synced_at".to_string()) {
            conn.execute_batch("ALTER TABLE projects ADD COLUMN last_synced_at TEXT;")
                .map_err(|e| StorageError::Database(e.to_string()))?;
        }
        if !project_cols.contains(&"name".to_string()) {
            conn.execute_batch(
                "ALTER TABLE projects ADD COLUMN name TEXT NOT NULL DEFAULT '';
                 ALTER TABLE projects ADD COLUMN key_check BLOB;"
            )
            .map_err(|e| StorageError::Database(e.to_string()))?;
        }

        let backup_cols: Vec<String> = {
            let mut stmt = conn
                .prepare("PRAGMA table_info(project_backups)")
                .map_err(|e| StorageError::Database(e.to_string()))?;
            let rows = stmt.query_map([], |row| row.get::<_, String>(1))
                .map_err(|e| StorageError::Database(e.to_string()))?;
            rows.filter_map(|r| r.ok()).collect()
        };
        if !backup_cols.is_empty() && !backup_cols.contains(&"name".to_string()) {
            conn.execute_batch(
                "ALTER TABLE project_backups ADD COLUMN name TEXT NOT NULL DEFAULT '';
                 ALTER TABLE project_backups ADD COLUMN key_check BLOB;"
            )
            .map_err(|e| StorageError::Database(e.to_string()))?;
        }

        Ok(())
    }

    fn list_projects(&self) -> Result<Vec<Project>, StorageError> {
        let conn = self.conn.lock().map_err(|e| StorageError::Database(e.to_string()))?;
        let mut stmt = conn
            .prepare(
                "SELECT id, name, encrypted_content, key_check,
                        sort_order, created_at, updated_at, server_id, sync_status, last_synced_at
                 FROM projects ORDER BY sort_order ASC, created_at ASC",
            )
            .map_err(|e| StorageError::Database(e.to_string()))?;

        let projects = stmt
            .query_map([], |row| {
                Ok(Project {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    encrypted_content: row.get(2)?,
                    key_check: row.get::<_, Option<Vec<u8>>>(3)?.unwrap_or_default(),
                    sort_order: row.get(4)?,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                    server_id: row.get(7)?,
                    sync_status: row.get(8)?,
                    last_synced_at: row.get(9)?,
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
            "SELECT id, name, encrypted_content, key_check,
                    sort_order, created_at, updated_at, server_id, sync_status, last_synced_at
             FROM projects WHERE id = ?1",
            params![id],
            |row| {
                Ok(Project {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    encrypted_content: row.get(2)?,
                    key_check: row.get::<_, Option<Vec<u8>>>(3)?.unwrap_or_default(),
                    sort_order: row.get(4)?,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                    server_id: row.get(7)?,
                    sync_status: row.get(8)?,
                    last_synced_at: row.get(9)?,
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

    fn create_project(&self, project: &Project) -> Result<Option<String>, StorageError> {
        let conn = self.conn.lock().map_err(|e| StorageError::Database(e.to_string()))?;
        conn.execute(
            "INSERT INTO projects (id, name, encrypted_content, key_check,
                                   sort_order, created_at, updated_at, server_id, sync_status, last_synced_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                project.id,
                project.name,
                project.encrypted_content,
                project.key_check,
                project.sort_order,
                project.created_at,
                project.updated_at,
                project.server_id,
                project.sync_status,
                project.last_synced_at,
            ],
        )
        .map_err(|e| StorageError::Database(e.to_string()))?;
        Ok(None)
    }

    fn update_project(&self, project: &Project) -> Result<(), StorageError> {
        let conn = self.conn.lock().map_err(|e| StorageError::Database(e.to_string()))?;
        let rows = conn
            .execute(
                "UPDATE projects SET name = ?2, encrypted_content = ?3,
                        key_check = ?4, sort_order = ?5, updated_at = ?6,
                        server_id = ?7, sync_status = ?8, last_synced_at = ?9
                 WHERE id = ?1",
                params![
                    project.id,
                    project.name,
                    project.encrypted_content,
                    project.key_check,
                    project.sort_order,
                    project.updated_at,
                    project.server_id,
                    project.sync_status,
                    project.last_synced_at,
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

    fn create_backup(&self, backup: &ProjectBackup) -> Result<(), StorageError> {
        let conn = self.conn.lock().map_err(|e| StorageError::Database(e.to_string()))?;
        conn.execute(
            "INSERT INTO project_backups (id, project_id, name, encrypted_content,
                                          key_check, created_at, trigger_type, content_length)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                backup.id,
                backup.project_id,
                backup.name,
                backup.encrypted_content,
                backup.key_check,
                backup.created_at,
                backup.trigger_type,
                backup.content_length,
            ],
        )
        .map_err(|e| StorageError::Database(e.to_string()))?;
        Ok(())
    }

    fn update_backup(&self, backup: &ProjectBackup) -> Result<(), StorageError> {
        let conn = self.conn.lock().map_err(|e| StorageError::Database(e.to_string()))?;
        let rows = conn
            .execute(
                "UPDATE project_backups SET name = ?2,
                        encrypted_content = ?3, key_check = ?4
                 WHERE id = ?1",
                params![backup.id, backup.name, backup.encrypted_content, backup.key_check],
            )
            .map_err(|e| StorageError::Database(e.to_string()))?;
        if rows == 0 {
            return Err(StorageError::NotFound(backup.id.clone()));
        }
        Ok(())
    }

    fn list_backups(&self, project_id: &str) -> Result<Vec<ProjectBackup>, StorageError> {
        let conn = self.conn.lock().map_err(|e| StorageError::Database(e.to_string()))?;
        let mut stmt = conn
            .prepare(
                "SELECT id, project_id, name, encrypted_content,
                        key_check, created_at, trigger_type, content_length
                 FROM project_backups
                 WHERE project_id = ?1
                 ORDER BY created_at DESC",
            )
            .map_err(|e| StorageError::Database(e.to_string()))?;

        let backups = stmt
            .query_map(params![project_id], |row| {
                Ok(ProjectBackup {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    name: row.get(2)?,
                    encrypted_content: row.get(3)?,
                    key_check: row.get::<_, Option<Vec<u8>>>(4)?.unwrap_or_default(),
                    created_at: row.get(5)?,
                    trigger_type: row.get(6)?,
                    content_length: row.get(7)?,
                })
            })
            .map_err(|e| StorageError::Database(e.to_string()))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| StorageError::Database(e.to_string()))?;

        Ok(backups)
    }

    fn get_backup(&self, backup_id: &str) -> Result<ProjectBackup, StorageError> {
        let conn = self.conn.lock().map_err(|e| StorageError::Database(e.to_string()))?;
        conn.query_row(
            "SELECT id, project_id, name, encrypted_content,
                    key_check, created_at, trigger_type, content_length
             FROM project_backups WHERE id = ?1",
            params![backup_id],
            |row| {
                Ok(ProjectBackup {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    name: row.get(2)?,
                    encrypted_content: row.get(3)?,
                    key_check: row.get::<_, Option<Vec<u8>>>(4)?.unwrap_or_default(),
                    created_at: row.get(5)?,
                    trigger_type: row.get(6)?,
                    content_length: row.get(7)?,
                })
            },
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                StorageError::NotFound(backup_id.to_string())
            }
            _ => StorageError::Database(e.to_string()),
        })
    }

    fn get_latest_backup(&self, project_id: &str) -> Result<Option<ProjectBackup>, StorageError> {
        let conn = self.conn.lock().map_err(|e| StorageError::Database(e.to_string()))?;
        match conn.query_row(
            "SELECT id, project_id, name, encrypted_content,
                    key_check, created_at, trigger_type, content_length
             FROM project_backups
             WHERE project_id = ?1
             ORDER BY created_at DESC LIMIT 1",
            params![project_id],
            |row| {
                Ok(ProjectBackup {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    name: row.get(2)?,
                    encrypted_content: row.get(3)?,
                    key_check: row.get::<_, Option<Vec<u8>>>(4)?.unwrap_or_default(),
                    created_at: row.get(5)?,
                    trigger_type: row.get(6)?,
                    content_length: row.get(7)?,
                })
            },
        ) {
            Ok(backup) => Ok(Some(backup)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(StorageError::Database(e.to_string())),
        }
    }

    fn delete_backup(&self, backup_id: &str) -> Result<(), StorageError> {
        let conn = self.conn.lock().map_err(|e| StorageError::Database(e.to_string()))?;
        conn.execute("DELETE FROM project_backups WHERE id = ?1", params![backup_id])
            .map_err(|e| StorageError::Database(e.to_string()))?;
        Ok(())
    }

    fn cleanup_backups(&self, project_id: &str, keep_count: usize) -> Result<(), StorageError> {
        let conn = self.conn.lock().map_err(|e| StorageError::Database(e.to_string()))?;
        conn.execute(
            "DELETE FROM project_backups
             WHERE project_id = ?1
               AND id NOT IN (
                   SELECT id FROM project_backups
                   WHERE project_id = ?1
                   ORDER BY created_at DESC
                   LIMIT ?2
               )",
            params![project_id, keep_count as i64],
        )
        .map_err(|e| StorageError::Database(e.to_string()))?;
        Ok(())
    }
}
