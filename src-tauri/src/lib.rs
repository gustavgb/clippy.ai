use std::sync::Mutex;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{Emitter, Manager};

/// Holds the file path passed as a CLI argument (or via file-manager association).
struct AppState {
    initial_file: Mutex<Option<String>>,
}

/// Called by the frontend on startup to retrieve and consume the initial file path.
#[tauri::command]
fn get_initial_file(state: tauri::State<AppState>) -> Option<String> {
    state.initial_file.lock().unwrap().take()
}

/// Sets the window title.
#[tauri::command]
fn set_title(app: tauri::AppHandle, title: String) {
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
fn close_app(app: tauri::AppHandle) {
    app.exit(0)
}

/// Returns the path to ~/.config/clippy.ai/settings.json, creating the
/// directory if it does not yet exist.
#[tauri::command]
fn get_settings_path() -> Result<String, String> {
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

/// Fetches the <title> of a web page via an HTTP GET request.
#[tauri::command]
async fn fetch_page_title(url: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (compatible; clippy.ai/1.0)")
        .timeout(std::time::Duration::from_secs(10))
        .danger_accept_invalid_certs(false)
        .build()
        .map_err(|e| e.to_string())?;

    let response = client.get(&url).send().await.map_err(|e| e.to_string())?;

    let body = response.text().await.map_err(|e| e.to_string())?;

    // Simple title extraction — find <title>...</title>
    let lower = body.to_lowercase();
    if let Some(start) = lower.find("<title") {
        if let Some(gt) = lower[start..].find('>') {
            let after_gt = &body[start + gt + 1..];
            let lower_after = after_gt.to_lowercase();
            if let Some(end) = lower_after.find("</title>") {
                let raw_title = &after_gt[..end];
                // Decode common HTML entities
                let title = raw_title
                    .replace("&amp;", "&")
                    .replace("&lt;", "<")
                    .replace("&gt;", ">")
                    .replace("&quot;", "\"")
                    .replace("&#39;", "'")
                    .replace("&nbsp;", " ");
                let title = title.trim().to_string();
                if !title.is_empty() {
                    return Ok(title);
                }
            }
        }
    }

    // Fall back to hostname
    if let Ok(parsed) = url::Url::parse(&url) {
        if let Some(host) = parsed.host_str() {
            return Ok(host.to_string());
        }
    }

    Ok(url)
}

#[tauri::command]
async fn list_gemini_models(api_key: String) -> Result<Vec<String>, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (compatible; clippy.ai/1.0)")
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models?key={}",
        api_key
    );
    let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let names = json["models"]
        .as_array()
        .ok_or("Unexpected response from models endpoint")?
        .iter()
        .filter_map(|m| {
            let name = m["name"].as_str()?;
            let supported = m["supportedGenerationMethods"]
                .as_array()
                .map(|a| a.iter().any(|v| v.as_str() == Some("generateContent")))
                .unwrap_or(false);
            if supported {
                Some(name.to_string())
            } else {
                None
            }
        })
        .collect();
    Ok(names)
}

/// Opens a URL in the system's default browser.
#[tauri::command]
async fn fetch_ai_summary(
    url: String,
    api_key: String,
    model: String,
    prompt_template: String,
) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (compatible; clippy.ai/1.0)")
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;

    // Fetch page content
    let response = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let html = response.text().await.map_err(|e| e.to_string())?;

    // Strip HTML tags to get plain text
    let mut text = String::with_capacity(html.len());
    let mut in_tag = false;
    let mut in_script = false;
    let mut tag_buf = String::new();
    for ch in html.chars() {
        if ch == '<' {
            in_tag = true;
            tag_buf.clear();
        } else if ch == '>' {
            let tag_lower = tag_buf.to_lowercase();
            if tag_lower.starts_with("script") || tag_lower.starts_with("style") {
                in_script = true;
            } else if tag_lower.starts_with("/script") || tag_lower.starts_with("/style") {
                in_script = false;
            }
            in_tag = false;
            text.push(' ');
        } else if in_tag {
            tag_buf.push(ch);
        } else if !in_script {
            text.push(ch);
        }
    }
    // Collapse whitespace
    let text: String = text.split_whitespace().collect::<Vec<_>>().join(" ");
    let text = if text.len() > 10_000 {
        &text[..10_000]
    } else {
        &text
    };

    // Call Gemini API
    let prompt = prompt_template.replace("{content}", text);
    let body = serde_json::json!({
        "contents": [{"parts": [{"text": prompt}]}]
    });
    let gemini_url = format!(
        "https://generativelanguage.googleapis.com/v1beta/{}:generateContent?key={}",
        model, api_key
    );
    let resp = client
        .post(&gemini_url)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = resp.status();
    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    if !status.is_success() {
        let msg = json["error"]["message"]
            .as_str()
            .unwrap_or("Unknown Gemini API error");
        return Err(format!("Gemini API error {}: {}", status, msg));
    }

    let summary = json["candidates"][0]["content"]["parts"][0]["text"]
        .as_str()
        .ok_or_else(|| format!("Unexpected Gemini response: {}", json))?
        .to_string();
    Ok(summary)
}

#[tauri::command]
async fn open_url(url: String) -> Result<(), String> {
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "linux")]
    if std::env::var("WEBKIT_DISABLE_DMABUF_RENDERER").is_err() {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }

    let initial_file = std::env::args().skip(1).find(|a| !a.starts_with('-'));

    tauri::Builder::default()
        .manage(AppState {
            initial_file: Mutex::new(initial_file),
        })
        .invoke_handler(tauri::generate_handler![
            get_initial_file,
            set_title,
            close_app,
            get_settings_path,
            fetch_page_title,
            fetch_ai_summary,
            list_gemini_models,
            open_url,
        ])
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let new_i = MenuItem::with_id(app, "new", "New Data File", true, Some("CmdOrCtrl+N"))?;
            let open_i = MenuItem::with_id(
                app,
                "open",
                "Open Data File\u{2026}",
                true,
                Some("CmdOrCtrl+O"),
            )?;
            let save_i = MenuItem::with_id(app, "save", "Save", true, Some("CmdOrCtrl+S"))?;
            let save_as_i = MenuItem::with_id(
                app,
                "save_as",
                "Save As\u{2026}",
                true,
                Some("CmdOrCtrl+Shift+S"),
            )?;
            let sep = PredefinedMenuItem::separator(app)?;
            let prefs_i =
                MenuItem::with_id(app, "preferences", "Preferences", true, Some("CmdOrCtrl+,"))?;
            let sep2 = PredefinedMenuItem::separator(app)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, Some("CmdOrCtrl+Q"))?;

            let file_menu = Submenu::with_items(
                app,
                "File",
                true,
                &[
                    &new_i, &open_i, &save_i, &save_as_i, &sep, &prefs_i, &sep2, &quit_i,
                ],
            )?;

            let menu = Menu::with_items(app, &[&file_menu])?;
            app.set_menu(menu)?;

            app.on_menu_event(|app, event| match event.id().as_ref() {
                id => {
                    app.emit("menu-action", id).ok();
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
