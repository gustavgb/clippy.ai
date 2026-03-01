use std::sync::Mutex;
use tauri::Manager;

/// Holds the file path passed as a CLI argument (or via file-manager association).
pub struct AppState {
    pub initial_file: Mutex<Option<String>>,
}

/// Called by the frontend on startup to retrieve and consume the initial file path.
#[tauri::command]
pub fn get_initial_file(state: tauri::State<AppState>) -> Option<String> {
    state.initial_file.lock().unwrap().take()
}

/// Sets the window title.
#[tauri::command]
pub fn set_title(app: tauri::AppHandle, title: String) {
    let app2 = app.clone();
    app.run_on_main_thread(move || {
        if let Some(win) = app2.get_webview_window("main") {
            win.set_title(&title).ok();
            #[cfg(target_os = "linux")]
            if let Ok(gtk_win) = win.gtk_window() {
                use gtk::prelude::{BinExt, Cast, GtkWindowExt, WidgetExt};
                if let Some(titlebar) = gtk_win.titlebar() {
                    match titlebar.dynamic_cast::<gtk::EventBox>() {
                        Ok(eb) => {
                            if let Some(child) = BinExt::child(&eb) {
                                if let Ok(hb) = child.dynamic_cast::<gtk::HeaderBar>() {
                                    gtk::prelude::HeaderBarExt::set_title(&hb, Some(&title));
                                }
                            }
                        }
                        Err(titlebar) => {
                            if let Ok(hb) = titlebar.dynamic_cast::<gtk::HeaderBar>() {
                                gtk::prelude::HeaderBarExt::set_title(&hb, Some(&title));
                            }
                        }
                    }
                }
                gtk_win.queue_draw();
            }
        }
    })
    .ok();
}

#[tauri::command]
pub fn close_app(app: tauri::AppHandle) {
    app.exit(0)
}

/// Returns the path to ~/.config/clippy.ai/settings.json, creating the
/// directory if it does not yet exist.
#[tauri::command]
pub fn get_settings_path() -> Result<String, String> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| "Could not determine home directory".to_string())?;
    let config_dir = std::path::Path::new(&home)
        .join(".config")
        .join("clippy.ai");
    if !config_dir.exists() {
        std::fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    }
    let settings_path = config_dir.join("settings.json");
    Ok(settings_path.to_string_lossy().into_owned())
}

/// Opens a URL in the system's default browser.
#[tauri::command]
pub async fn open_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/c", "start", "", &url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
