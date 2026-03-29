use tauri::Manager;
mod torrent;
mod fuckingfast;
mod rate_limiter;

pub mod cmds {
    #[tauri::command]
    pub fn check_autostart_hidden() -> bool {
        std::env::args().any(|arg| arg == "--hidden")
    }

    #[tauri::command]
    pub async fn set_download_speed_limit(limit_kbps: u64, rate_limiter: tauri::State<'_, std::sync::Arc<crate::rate_limiter::GlobalRateLimiter>>) -> Result<(), String> {
        rate_limiter.limit_kbps.store(limit_kbps, std::sync::atomic::Ordering::SeqCst);
        Ok(())
    }
}
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

#[allow(dead_code)]
#[tauri::command]
async fn native_fetch(url: String) -> Result<String, String> {
    let client = reqwest::Client::builder().user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 fg-manager").build().unwrap();
    client.get(&url).send().await.map_err(|e| e.to_string())?.text().await.map_err(|e| e.to_string())
}

#[allow(dead_code)]
#[tauri::command]
async fn native_fetch_bytes(url: String) -> Result<Vec<u8>, String> {
    let client = reqwest::Client::builder().user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 fg-manager").build().unwrap();
    client.get(&url).send().await.map_err(|e| e.to_string())?.bytes().await.map_err(|e| e.to_string()).map(|b| b.to_vec())
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(std::sync::Arc::new(rate_limiter::GlobalRateLimiter::new()))
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
        cmds::set_download_speed_limit,
        cmds::check_autostart_hidden,
        native_fetch,
        native_fetch_bytes,
        quit_app
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

// Commands moved
