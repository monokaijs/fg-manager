use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::State;
use reqwest::Client;
use std::path::PathBuf;
use tokio::io::AsyncWriteExt;
use std::time::{Instant, Duration};
use futures_util::StreamExt;
use regex::Regex;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use unrar::Archive;

#[derive(Clone, serde::Serialize)]
pub struct FFTaskStats {
    pub id: String,
    pub game_slug: String,
    pub name: String,
    pub status: String,
    pub progress: f64,
    pub download_speed: u64,
    pub eta: u64,
    pub total_size: u64,
    pub downloaded: u64,
    pub executable_path: Option<String>,
}

pub struct FFTask {
    pub id: String,
    pub game_slug: String,
    pub urls: Vec<String>,
    pub current_part_idx: usize,
    pub current_part_bytes: u64,
    pub current_part_total: u64,
    pub status: String,
    pub total_bytes: u64,
    pub progress_bytes: u64,
    pub download_speed: u64,
    pub token: Arc<AtomicBool>,
    pub custom_dir: Option<PathBuf>,
    pub extracting_progress: f64,
    pub executable_path: Option<String>,
}

pub struct FuckingFastState {
    pub tasks: Arc<Mutex<HashMap<String, FFTask>>>,
    pub client: Client,
    pub download_dir: PathBuf,
    pub speed_limit_kb: Arc<AtomicU64>,
}

impl FuckingFastState {
    pub fn new(download_dir: PathBuf) -> Self {
        let mut headers = reqwest::header::HeaderMap::new();
        headers.insert(reqwest::header::USER_AGENT, reqwest::header::HeaderValue::from_static("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"));
        headers.insert(reqwest::header::REFERER, reqwest::header::HeaderValue::from_static("https://fitgirl-repacks.site/"));
        Self {
            tasks: Arc::new(Mutex::new(HashMap::new())),
            client: Client::builder().default_headers(headers).build().unwrap(),
            download_dir,
            speed_limit_kb: Arc::new(AtomicU64::new(0)),
        }
    }
}

pub async fn start_download(
    id: String,
    download_dir: PathBuf,
    client: Client,
    tasks: Arc<Mutex<HashMap<String, FFTask>>>,
    speed_limit_kb: Arc<AtomicU64>,
) {
    let mut initial_file = None;
    let mut root_dir = None;

    'dl: loop {
        let (url, cancel_token, mut file_path, current_idx, _total_parts) = {
            let mut t = tasks.lock().await;
            let task = match t.get_mut(&id) {
                Some(t) => t,
                None => return,
            };
            if task.status == "paused" || task.status == "error" || task.status == "extracting" {
                return;
            }
            if task.current_part_idx >= task.urls.len() {
                task.status = "extracting".to_string();
                task.download_speed = 0;
                task.current_part_bytes = task.current_part_total;
                break 'dl;
            }
            task.status = "downloading".to_string();
            let target_url = task.urls[task.current_part_idx].clone();
            
            let base_dir = task.custom_dir.clone().unwrap_or(download_dir.clone());
            let parent_folder = base_dir.join(&task.game_slug);
            let _ = std::fs::create_dir_all(&parent_folder);
            
            (target_url, task.token.clone(), parent_folder, task.current_part_idx, task.urls.len())
        };

        // Fetch page to extract direct URL
        let dl_req = match client.get(&url).send().await {
            Ok(r) => r.text().await.unwrap_or_default(),
            Err(_) => {
                let mut t = tasks.lock().await;
                if let Some(task) = t.get_mut(&id) {
                    task.status = "error".to_string();
                }
                return;
            }
        };

        let direct_url = if let Some(cap) = Regex::new(r#"window\.open\(['"](https?://[^'"\s\)]+)['"]"#).unwrap().captures(&dl_req) {
            cap.get(1).map_or("", |m| m.as_str()).to_string()
        } else {
            let mut t = tasks.lock().await;
            if let Some(task) = t.get_mut(&id) { task.status = "error".to_string(); }
            return;
        };
        
        // Use filename from url
        let file_name = direct_url.split('/').last().unwrap_or("unknown_file.bin");
        file_path = file_path.join(file_name);
        
        if current_idx == 0 {
            initial_file = Some(file_path.clone());
            root_dir = Some(file_path.parent().unwrap().to_path_buf());
        }

        let resp = match client.get(&direct_url).send().await {
            Ok(r) => r,
            Err(_) => {
                let mut t = tasks.lock().await;
                if let Some(task) = t.get_mut(&id) { task.status = "error".to_string(); }
                return;
            }
        };

        let size = resp.content_length().unwrap_or(0);
        {
            let mut t = tasks.lock().await;
            if let Some(task) = t.get_mut(&id) {
                if task.current_part_total != size {
                    task.total_bytes += size;
                    task.current_part_total = size;
                    task.current_part_bytes = 0;
                }
            }
        }

        let mut file = match tokio::fs::File::create(&file_path).await {
            Ok(f) => f,
            Err(_) => {
                let mut t = tasks.lock().await;
                if let Some(task) = t.get_mut(&id) { task.status = "error".to_string(); }
                return;
            }
        };

        let mut stream = resp.bytes_stream();
        let mut last_update = Instant::now();
        let mut bytes_since_last_update = 0;

        while let Some(chunk_res) = stream.next().await {
            if cancel_token.load(Ordering::SeqCst) {
                let mut t = tasks.lock().await;
                if let Some(task) = t.get_mut(&id) { task.status = "paused".to_string(); }
                return;
            }

            if let Ok(chunk) = chunk_res {
                if file.write_all(&chunk).await.is_ok() {
                    let len = chunk.len() as u64;
                    bytes_since_last_update += len;
                    
                    let mut t = tasks.lock().await;
                    if let Some(task) = t.get_mut(&id) {
                        task.progress_bytes += len;
                        task.current_part_bytes += len;
                        if last_update.elapsed() > Duration::from_millis(500) {
                            task.download_speed = ((bytes_since_last_update as f64) / last_update.elapsed().as_secs_f64()) as u64;
                            bytes_since_last_update = 0;
                            last_update = Instant::now();
                        }
                    }

                    // Throttle block
                    let limit_kbps = speed_limit_kb.load(Ordering::Relaxed);
                    if limit_kbps > 0 {
                        let bytes_per_sec = limit_kbps * 1024;
                        let expected_secs = (len as f64) / (bytes_per_sec as f64);
                        tokio::time::sleep(Duration::from_secs_f64(expected_secs)).await;
                    }
                }
            }
        }
        
        {
            let mut t = tasks.lock().await;
            if let Some(task) = t.get_mut(&id) {
                task.current_part_idx += 1;
                task.current_part_bytes = 0;
                task.current_part_total = 0;
            }
        }
    }
    
    // Auto-Extraction Phase
    if let (Some(archive_path), Some(extract_to)) = (initial_file, root_dir) {
        if let Ok(path_str) = archive_path.into_os_string().into_string() {
            if path_str.to_lowercase().ends_with(".rar") {
                {
                    let mut t = tasks.lock().await;
                    if let Some(task) = t.get_mut(&id) {
                        task.status = "extracting".to_string();
                        task.extracting_progress = 0.5; // Simulate progress as unrar crate is synchronous
                    }
                }
                
                let dest = extract_to.clone();
                let _ = tokio::task::spawn_blocking(move || {
                    if let Ok(mut archive) = Archive::new(&path_str).open_for_processing() {
                        while let Ok(Some(header)) = archive.read_header() {
                            if let Ok(next_archive) = header.extract_to(&dest) {
                                archive = next_archive;
                            } else {
                                break;
                            }
                        }
                    }
                }).await;
                
                // Phase 3: Find setup.exe and extract .iss
                let mut setup_exe = None;
                if let Ok(entries) = std::fs::read_dir(&extract_to) {
                    for entry in entries.filter_map(|e| e.ok()) {
                        if entry.file_name() == "setup.exe" {
                            setup_exe = Some(entry.path());
                            break;
                        }
                    }
                }

                if let Some(setup_path) = setup_exe {
                    {
                        let mut t = tasks.lock().await;
                        if let Some(task) = t.get_mut(&id) {
                            task.status = "installing".to_string();
                        }
                    }

                    // Extract install_script.iss
                    let _ = std::process::Command::new("innoextract")
                        .arg("--extract")
                        .arg("install_script.iss")
                        .arg(&setup_path)
                        .current_dir(&extract_to)
                        .output();

                    let iss_path = extract_to.join("install_script.iss");
                    if let Ok(script_content) = std::fs::read_to_string(&iss_path) {
                        for line in script_content.lines() {
                            if line.contains("Filename: \"{app}\\") && line.contains(".exe\"") {
                                if let Some(start) = line.find("\"{app}\\") {
                                    if let Some(end) = line[start + 7..].find('\"') {
                                        let exe = &line[start + 7..start + 7 + end];
                                        let full_exe = extract_to.join(exe.replace("\\", "/"));
                                        let mut t = tasks.lock().await;
                                        if let Some(task) = t.get_mut(&id) {
                                            task.executable_path = Some(full_exe.to_string_lossy().to_string());
                                        }
                                        break; // Found it
                                    }
                                }
                            }
                        }
                    }

                    // Phase 4: Launch the installer
                    #[cfg(target_os = "windows")]
                    let mut child = std::process::Command::new(&setup_path)
                        .current_dir(&extract_to)
                        .spawn();

                    #[cfg(not(target_os = "windows"))]
                    let mut child = std::process::Command::new("wine")
                        .arg(&setup_path)
                        .current_dir(&extract_to)
                        .spawn();

                    if let Ok(mut c) = child {
                        let _ = c.wait(); // Wait for user to finish installing
                    }
                }
            }
        }
    }
    
    // Mark as completed
    {
        let mut t = tasks.lock().await;
        if let Some(task) = t.get_mut(&id) {
            task.status = "completed".to_string();
            task.extracting_progress = 1.0;
        }
    }
}

#[tauri::command]
pub async fn ff_add_urls(id: String, game_slug: String, urls: Vec<String>, download_dir: Option<String>, state: State<'_, FuckingFastState>) -> Result<bool, String> {
    let token = Arc::new(AtomicBool::new(false));
    let custom_dir = download_dir.clone().map(PathBuf::from);
    {
        let mut tasks = state.tasks.lock().await;
        tasks.insert(id.clone(), FFTask {
            id: id.clone(),
            game_slug: game_slug.clone(),
            urls,
            current_part_idx: 0,
            current_part_bytes: 0,
            current_part_total: 0,
            status: "queued".to_string(),
            total_bytes: 0,
            progress_bytes: 0,
            download_speed: 0,
            token: token.clone(),
            custom_dir,
            extracting_progress: 0.0,
            executable_path: None,
        });
    }

    let t = state.tasks.clone();
    let c = state.client.clone();
    let d = state.download_dir.clone();
    let s = state.speed_limit_kb.clone();
    tokio::spawn(async move {
        start_download(id, d, c, t, s).await;
    });

    Ok(true)
}

#[tauri::command]
pub async fn ff_pause(id: String, state: State<'_, FuckingFastState>) -> Result<(), String> {
    let mut tasks = state.tasks.lock().await;
    if let Some(task) = tasks.get_mut(&id) {
        task.token.store(true, Ordering::SeqCst);
        task.status = "paused".to_string();
        task.download_speed = 0;
    }
    Ok(())
}

#[tauri::command]
pub async fn ff_resume(id: String, state: State<'_, FuckingFastState>) -> Result<(), String> {
    let mut t = state.tasks.lock().await;
    if let Some(task) = t.get_mut(&id) {
        if task.status == "paused" || task.status == "error" || task.status == "extracting" {
            task.token = Arc::new(AtomicBool::new(false));
            task.status = "queued".to_string();
            
            let t_clone = state.tasks.clone();
            let c_clone = state.client.clone();
            let d_clone = state.download_dir.clone();
            let s_clone = state.speed_limit_kb.clone();
            let safe_id = id.clone();
            
            tokio::spawn(async move {
                start_download(safe_id, d_clone, c_clone, t_clone, s_clone).await;
            });
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn ff_remove(id: String, delete_files: bool, state: State<'_, FuckingFastState>) -> Result<(), String> {
    let mut slug_to_delete = None;
    let mut base_dir = state.download_dir.clone();
    {
        let mut tasks = state.tasks.lock().await;
        if let Some(task) = tasks.get(&id) {
            task.token.store(true, Ordering::SeqCst);
            if delete_files {
                slug_to_delete = Some(task.game_slug.clone());
                if let Some(ref custom) = task.custom_dir {
                    base_dir = custom.clone();
                }
            }
        }
        tasks.remove(&id);
    }
    
    if let Some(slug) = slug_to_delete {
        let parent_folder = base_dir.join(&slug);
        let _ = tokio::fs::remove_dir_all(parent_folder).await;
    }
    
    Ok(())
}

#[tauri::command]
pub async fn ff_get_tasks(state: State<'_, FuckingFastState>) -> Result<Vec<FFTaskStats>, String> {
    let tasks = state.tasks.lock().await;
    let mut result = Vec::new();
    
    for (_, task) in tasks.iter() {
        let mut progress = 0.0;
        let mut eta = 0;
        
        let total_parts = task.urls.len() as f64;
        if total_parts > 0.0 {
            let mut part_progress = 0.0;
            if task.current_part_total > 0 {
                part_progress = (task.current_part_bytes as f64) / (task.current_part_total as f64);
            }
            progress = ((task.current_part_idx as f64) + part_progress) / total_parts;
            if progress > 1.0 { progress = 1.0; }
        }

        if task.status == "extracting" {
            progress = task.extracting_progress;
        }
        
        let mut estimated_total_size = task.total_bytes;
        if task.download_speed > 0 || task.total_bytes > 0 {
            // Rough ETA based on remaining parts size assuming homogenous sizing
            let avg_part_size = if task.total_bytes > 0 && task.current_part_idx > 0 {
                task.total_bytes / (task.current_part_idx as u64)
            } else if task.current_part_total > 0 {
                task.current_part_total
            } else {
                0
            };
            
            if avg_part_size > 0 {
                let remaining_parts = if task.current_part_idx + 1 < task.urls.len() {
                    (task.urls.len() - task.current_part_idx - 1) as u64
                } else {
                    0
                };
                
                estimated_total_size += remaining_parts * avg_part_size;
                if estimated_total_size > task.progress_bytes && task.download_speed > 0 {
                    eta = (estimated_total_size - task.progress_bytes) / task.download_speed;
                }
            }
        }

        result.push(FFTaskStats {
            id: task.id.clone(),
            game_slug: task.game_slug.clone(),
            name: task.game_slug.clone(), // Default map
            status: task.status.clone(),
            progress,
            download_speed: task.download_speed,
            eta,
            total_size: estimated_total_size,
            downloaded: task.progress_bytes,
            executable_path: task.executable_path.clone(),
        });
    }

    Ok(result)
}

#[tauri::command]
pub async fn set_download_speed_limit(limit_kbps: u64, state: State<'_, FuckingFastState>) -> Result<(), String> {
    state.speed_limit_kb.store(limit_kbps, std::sync::atomic::Ordering::SeqCst);
    Ok(())
}
