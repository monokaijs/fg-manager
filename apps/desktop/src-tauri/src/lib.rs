use tauri::Manager;
mod torrent;
mod fuckingfast;
pub struct HttpClient(pub reqwest::Client);

pub mod cmds {
    use tauri::Manager;

    #[tauri::command]
    pub fn check_autostart_hidden() -> bool {
        std::env::args().any(|arg| arg == "--hidden")
    }

    #[derive(serde::Serialize)]
    pub struct DiskStatus {
        pub active: bool,
        pub setup_path: Option<String>,
        pub executable_path: Option<String>,
        pub meta_executable: Option<String>,
    }

    #[tauri::command]
    pub fn check_game_disk_status(slug: String, library_path: Option<String>, app_handle: tauri::AppHandle) -> DiskStatus {
        let config_dir = app_handle.path().app_data_dir().unwrap_or_else(|_| std::path::PathBuf::from("/tmp"));
        
        let mut check_dirs = vec![
            config_dir.join("downloads").join(&slug)
        ];

        // Ensure user library mounts are iteratively inspected!
        if let Some(custom) = library_path {
            check_dirs.push(std::path::PathBuf::from(&custom).join(&slug));
            check_dirs.push(std::path::PathBuf::from(&custom).join(format!("{}_installed", &slug)));
        }

        let mut final_dir = None;
        for path in &check_dirs {
            if path.exists() {
                final_dir = Some(path.clone());
                break;
            }
        }

        let game_dir = match final_dir {
            Some(d) => d,
            None => return DiskStatus { active: false, setup_path: None, executable_path: None, meta_executable: None },
        };

        let mut setup = None;
        let mut exe = None;
        let mut meta_target = None;

        for path in &check_dirs {
            if let Ok(meta_bytes) = std::fs::read_to_string(path.join("fg_setup_meta.json")) {
                if let Ok(meta_json) = serde_json::from_str::<serde_json::Value>(&meta_bytes) {
                    if let Some(t_exe) = meta_json.get("target_executable").and_then(|v| v.as_str()) {
                        meta_target = Some(t_exe.to_string());
                        break;
                    }
                }
            }
        }

        if let Ok(entries) = std::fs::read_dir(&game_dir) {
            for entry in entries.filter_map(|e| e.ok()) {
                if let Ok(file_name) = entry.file_name().into_string() {
                    if file_name.to_lowercase() == "setup.exe" {
                        setup = Some(entry.path().to_string_lossy().to_string());
                    } else if file_name.to_lowercase().ends_with(".exe") && !file_name.to_lowercase().starts_with("unins") {
                        if exe.is_none() {
                            exe = Some(entry.path().to_string_lossy().to_string());
                        }
                    }
                }
            }
        }

        DiskStatus {
            active: true,
            setup_path: setup,
            executable_path: exe,
            meta_executable: meta_target,
        }
    }

    #[tauri::command]
    pub fn launch_file(path: String) -> Result<(), String> {
        let parent_dir = std::path::Path::new(&path).parent().unwrap_or(std::path::Path::new(""));
        std::process::Command::new(&path)
            .current_dir(parent_dir)
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

#[allow(dead_code)]
#[tauri::command]
async fn native_fetch(url: String, http: tauri::State<'_, HttpClient>) -> Result<String, String> {
    http.0.get(&url).send().await.map_err(|e| e.to_string())?.text().await.map_err(|e| e.to_string())
}

#[allow(dead_code)]
#[tauri::command]
async fn native_fetch_bytes(url: String, http: tauri::State<'_, HttpClient>) -> Result<Vec<u8>, String> {
    http.0.get(&url).send().await.map_err(|e| e.to_string())?.bytes().await.map_err(|e| e.to_string()).map(|b| b.to_vec())
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(HttpClient(
      reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 fg-manager")
        .connect_timeout(std::time::Duration::from_secs(3))
        .build()
        .unwrap(),
    ))
    .plugin(tauri_plugin_log::Builder::default().level(log::LevelFilter::Info).build())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_http::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec!["--hidden"])))
    .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }))
    .setup(|app| {
        let handle = app.handle().clone();

        if !std::env::args().any(|arg| arg == "--hidden") {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }

        let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
        let show_i = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
        let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

        let _tray = TrayIconBuilder::new()
            .icon(app.default_window_icon().unwrap().clone())
            .menu(&menu)
            .on_menu_event(|app, event| match event.id.as_ref() {
                "quit" => {
                    app.exit(0);
                }
                "show" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                _ => {}
            })
            .on_tray_icon_event(|tray, event| {
                if let TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                } = event
                {
                    if let Some(window) = tray.app_handle().get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            })
            .build(app)?;
        
        let config_dir = handle.path().app_data_dir().unwrap_or_else(|_| std::path::PathBuf::from("/tmp"));
        let downloads_dir = config_dir.join("downloads");
        std::fs::create_dir_all(&downloads_dir).unwrap_or_default();
        
        let ff_state = fuckingfast::FuckingFastState::new(downloads_dir.clone());
        app.manage(ff_state);
        
        tauri::async_runtime::spawn(async move {
            match torrent::TorrentState::new(downloads_dir).await {
                Ok(state) => {
                    handle.manage(state);
                    println!("Torrent Session Initialized successfully!");
                }
                Err(e) => {
                    eprintln!("Failed to init Torrent session: {}", e);
                }
            }
        });
        Ok(())
    })
    .invoke_handler(tauri::generate_handler![
        torrent::torrent_ping,
        torrent::torrent_add_magnet,
        torrent::torrent_add_url,
        torrent::torrent_get_tasks,
        torrent::torrent_pause,
        torrent::torrent_resume,
        torrent::torrent_remove,
        fuckingfast::ff_add_urls,
        fuckingfast::ff_pause,
        fuckingfast::ff_resume,
        fuckingfast::ff_remove,
        fuckingfast::ff_get_tasks,
        cmds::check_autostart_hidden,
        cmds::check_game_disk_status,
        cmds::launch_file,
        native_fetch,
        native_fetch_bytes,
        quit_app
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

// Commands moved
