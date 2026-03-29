use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::State;
use librqbit::{Session, AddTorrent, SessionOptions, SessionPersistenceConfig};
use std::path::PathBuf;

pub struct TorrentState {
    pub session: Arc<Session>,
    pub slugs: Arc<Mutex<HashMap<String, String>>>, // info_hash -> game_slug
    pub download_dirs: Arc<Mutex<HashMap<String, String>>>, // info_hash -> output folder
    pub slugs_path: PathBuf,
    pub download_dir: PathBuf,
}

impl TorrentState {
    pub async fn new(download_dir: PathBuf) -> Result<Self, String> {
        let parent_dir = download_dir.parent().unwrap_or(&download_dir).to_path_buf();
        let config_dir = parent_dir.join("config");
        std::fs::create_dir_all(&config_dir).unwrap_or_default();
        
        let persistence_config = SessionPersistenceConfig::Json {
            folder: Some(config_dir.join("rqbit_session")),
        };

        let opts = SessionOptions {
            persistence: Some(persistence_config),
            fastresume: true,
            ..Default::default()
        };
        let session = Session::new_with_opts(download_dir.clone(), opts).await.map_err(|e| e.to_string())?;
        
        let slugs_path = config_dir.join("fg_slugs.json");
        let mut slugs = HashMap::new();
        if let Ok(data) = std::fs::read_to_string(&slugs_path) {
            if let Ok(json) = serde_json::from_str(&data) {
                slugs = json;
            }
        }
        
        Ok(Self {
            session,
            slugs: Arc::new(Mutex::new(slugs)),
            download_dirs: Arc::new(Mutex::new(HashMap::new())),
            slugs_path,
            download_dir: download_dir.clone(),
        })
    }
    
    pub async fn save_slugs(&self) {
        let data = self.slugs.lock().await.clone();
        if let Ok(json) = serde_json::to_string(&data) {
            let _ = std::fs::write(&self.slugs_path, json);
        }
    }
}

#[tauri::command]
pub async fn torrent_ping(_state: State<'_, TorrentState>) -> Result<String, String> {
    Ok("pong".to_string())
}

#[tauri::command]
pub async fn torrent_add_magnet(magnet: String, game_slug: Option<String>, download_dir: Option<String>, state: State<'_, TorrentState>) -> Result<String, String> {
    let output_folder = download_dir.clone().map(PathBuf::from).unwrap_or(state.download_dir.clone());
    let output_folder_str = output_folder.to_string_lossy().to_string();
    let opts = librqbit::AddTorrentOptions {
        output_folder: Some(output_folder_str.clone()),
        ..Default::default()
    };
    
    let response = state.session
        .add_torrent(AddTorrent::from_url(&magnet), Some(opts))
        .await
        .map_err(|e| format!("Failed to add magnet: {}", e))?;

    let handle = response.into_handle().ok_or("Failed to get torrent handle")?;
    let info_hash = handle.shared().info_hash.as_string();
    
    if let Some(slug) = game_slug {
        {
            state.slugs.lock().await.insert(info_hash.clone(), slug);
        }
        state.save_slugs().await;
    }

    {
        state.download_dirs.lock().await.insert(info_hash.clone(), output_folder_str);
    }

    Ok(info_hash)
}

#[tauri::command]
pub async fn torrent_add_url(url: String, game_slug: Option<String>, download_dir: Option<String>, state: State<'_, TorrentState>) -> Result<String, String> {
    let output_folder = download_dir.clone().map(PathBuf::from).unwrap_or(state.download_dir.clone());
    let output_folder_str = output_folder.to_string_lossy().to_string();
    let opts = librqbit::AddTorrentOptions {
        output_folder: Some(output_folder_str.clone()),
        ..Default::default()
    };
    
    let response = state.session
        .add_torrent(AddTorrent::from_url(&url), Some(opts))
        .await
        .map_err(|e| format!("Failed to add torrent URL: {}", e))?;

    let handle = response.into_handle().ok_or("Failed to get torrent handle")?;
    let info_hash = handle.shared().info_hash.as_string();
    
    if let Some(slug) = game_slug {
        {
            state.slugs.lock().await.insert(info_hash.clone(), slug);
        }
        state.save_slugs().await;
    }

    {
        state.download_dirs.lock().await.insert(info_hash.clone(), output_folder_str);
    }

    Ok(info_hash)
}

#[tauri::command]
pub async fn torrent_get_tasks(state: State<'_, TorrentState>) -> Result<Vec<serde_json::Value>, String> {
    let slugs = state.slugs.lock().await.clone();
    let download_dirs = state.download_dirs.lock().await.clone();
    let fallback_download_dir = state.download_dir.to_string_lossy().to_string();
    let session = state.session.clone();

    tokio::task::spawn_blocking(move || {
        let tasks: Vec<serde_json::Value> = session.with_torrents(|torrents_iter| {
            torrents_iter.map(|(_, handle)| {
                let info_hash = handle.shared().info_hash.as_string();
                let game_slug = slugs.get(&info_hash).cloned();
                let save_path = download_dirs
                    .get(&info_hash)
                    .cloned()
                    .unwrap_or_else(|| fallback_download_dir.clone());
                
                let stats = handle.stats();
                
                let status = if stats.finished {
                    "completed"
                } else {
                    match stats.state.to_string().as_str() {
                        "initializing" => "checking",
                        "live" => "downloading",
                        "paused" => "paused",
                        _ => "error",
                    }
                };

                let progress = if stats.total_bytes > 0 {
                    (stats.progress_bytes as f64) / (stats.total_bytes as f64)
                } else {
                    0.0
                };

                let mut download_speed = 0u64;
                let mut upload_speed = 0u64;
                let mut eta = 0u64;
                let mut peers = 0u32;
                let mut seeds = 0u32;

                if let Some(live) = stats.live {
                    download_speed = (live.download_speed.mbps * 1024.0 * 1024.0) as u64;
                    upload_speed = (live.upload_speed.mbps * 1024.0 * 1024.0) as u64;
                    peers = live.snapshot.peer_stats.live as u32;
                    seeds = live.snapshot.peer_stats.seen as u32;
                }

                if download_speed > 0 && stats.total_bytes > stats.progress_bytes {
                    eta = (stats.total_bytes - stats.progress_bytes) / download_speed;
                }

                let name_fallback = handle.name().map(|n| n.to_owned()).or(game_slug.clone()).unwrap_or_else(|| format!("Torrent {}", info_hash));

                serde_json::json!({
                    "id": info_hash,
                    "gameSlug": game_slug,
                    "name": name_fallback,
                    "status": status,
                    "progress": progress,
                    "downloadSpeed": download_speed,
                    "uploadSpeed": upload_speed,
                    "eta": eta,
                    "totalSize": stats.total_bytes,
                    "downloaded": stats.progress_bytes,
                    "peers": peers,
                    "seeds": seeds,
                    "savePath": save_path,
                })
            }).collect()
        });

        Ok(tasks)
    }).await.unwrap_or_else(|_| Err("Failed to spawn background blocking thread".to_string()))
}

#[tauri::command]
pub async fn torrent_pause(id: String, state: State<'_, TorrentState>) -> Result<(), String> {
    let handle_to_pause = state.session.with_torrents(|iter| {
        let mut found = None;
        for (_, handle) in iter {
            if handle.shared().info_hash.as_string() == id {
                found = Some(handle.clone());
                break;
            }
        }
        found
    });

    if let Some(handle) = handle_to_pause {
        let _ = state.session.pause(&handle).await;
    }
    
    Ok(())
}

#[tauri::command]
pub async fn torrent_resume(id: String, state: State<'_, TorrentState>) -> Result<(), String> {
    let handle_to_unpause = state.session.with_torrents(|iter| {
        let mut found = None;
        for (_, handle) in iter {
            if handle.shared().info_hash.as_string() == id {
                found = Some(handle.clone());
                break;
            }
        }
        found
    });

    if let Some(handle) = handle_to_unpause {
        let _ = state.session.unpause(&handle).await;
    }
    
    Ok(())
}

#[tauri::command]
pub async fn torrent_remove(id: String, delete_files: bool, state: State<'_, TorrentState>) -> Result<(), String> {
    {
        let mut slugs = state.slugs.lock().await;
        slugs.remove(&id);
    }
    {
        let mut dirs = state.download_dirs.lock().await;
        dirs.remove(&id);
    }
    let _ = state.save_slugs().await;

    let target_id = state.session.with_torrents(|iter| {
        let mut found = None;
        for (sid, handle) in iter {
            if handle.shared().info_hash.as_string() == id {
                found = Some(sid);
                break;
            }
        }
        found
    });

    if let Some(num) = target_id {
        let _ = state.session.delete(librqbit::api::TorrentIdOrHash::Id(num), delete_files).await;
    }
    
    Ok(())
}
