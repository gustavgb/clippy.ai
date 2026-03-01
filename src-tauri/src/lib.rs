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

/// Formats the current UTC time as "YYYY-MM-DD HH:MM:SS".
fn format_utc_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let sec = (secs % 60) as u32;
    let min = ((secs / 60) % 60) as u32;
    let hour = ((secs / 3600) % 24) as u32;
    let mut days = secs / 86400;

    let mut year = 1970u32;
    loop {
        let leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
        let days_in_year: u64 = if leap { 366 } else { 365 };
        if days < days_in_year {
            break;
        }
        days -= days_in_year;
        year += 1;
    }

    let leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
    let days_in_month: [u64; 12] = [
        31,
        if leap { 29 } else { 28 },
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    ];
    let mut month = 1u32;
    for &dim in &days_in_month {
        if days < dim {
            break;
        }
        days -= dim;
        month += 1;
    }
    let day = (days + 1) as u32;

    format!(
        "{:04}-{:02}-{:02} {:02}:{:02}:{:02}",
        year, month, day, hour, min, sec
    )
}

/// Runs `git add`, `git commit`, and `git push` for the given workspace file.
/// Returns Ok with a success message, or Err with a description of what failed.
#[tauri::command]
fn git_push(file_path: String) -> Result<String, String> {
    let path = std::path::Path::new(&file_path);
    let dir = path
        .parent()
        .ok_or_else(|| "Invalid workspace file path".to_string())?;

    let run = |args: &[&str]| -> Result<String, String> {
        let output = std::process::Command::new("git")
            .args(args)
            .current_dir(dir)
            .output()
            .map_err(|e| format!("Failed to run git: {}", e))?;
        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).into_owned())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let stdout = String::from_utf8_lossy(&output.stdout);
            let combined = format!("{}{}", stdout, stderr);
            Err(combined.trim().to_string())
        }
    };

    // Step 1: Check git repo and whether there are any changes
    let status_out = run(&["status", "--porcelain"])
        .map_err(|e| format!("git status failed — is this a git repository?\n{}", e))?;

    if status_out.trim().is_empty() {
        return Err("No changes to commit.".to_string());
    }

    // Step 2: git add <workspace file>
    run(&["add", &file_path]).map_err(|e| format!("git add failed:\n{}", e))?;

    // Step 3: git commit
    let commit_msg = format!("Backup bookmarks {}", format_utc_now());
    run(&["commit", "-m", &commit_msg]).map_err(|e| format!("git commit failed:\n{}", e))?;

    // Step 4: git push
    run(&["push"]).map_err(|e| format!("git push failed:\n{}", e))?;

    Ok(format!(
        "Bookmarks backed up successfully ({})",
        format_utc_now()
    ))
}

/// Runs `git pull --ff` for the given workspace file's directory.
#[tauri::command]
fn git_pull(file_path: String) -> Result<String, String> {
    let path = std::path::Path::new(&file_path);
    let dir = path
        .parent()
        .ok_or_else(|| "Invalid workspace file path".to_string())?;

    let run = |args: &[&str]| -> Result<String, String> {
        let output = std::process::Command::new("git")
            .args(args)
            .current_dir(dir)
            .output()
            .map_err(|e| format!("Failed to run git: {}", e))?;
        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).into_owned())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let stdout = String::from_utf8_lossy(&output.stdout);
            Err(format!("{}{}", stdout, stderr).trim().to_string())
        }
    };

    // Verify this is a git repository
    run(&["status"]).map_err(|e| format!("Not a git repository:\n{}", e))?;

    let out = run(&["pull", "--ff"]).map_err(|e| format!("git pull failed:\n{}", e))?;

    Ok(out.trim().to_string())
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
            git_push,
            git_pull,
        ])
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // File menu
            let new_i =
                MenuItem::with_id(app, "new", "New workspace", true, Some("CmdOrCtrl+Shift+N"))?;
            let open_i =
                MenuItem::with_id(app, "open", "Open workspace", true, Some("CmdOrCtrl+O"))?;
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
                &[&new_i, &open_i, &save_as_i, &sep, &prefs_i, &sep2, &quit_i],
            )?;

            // Bookmarks menu
            let bm_new_i = MenuItem::with_id(
                app,
                "new_bookmark",
                "Add bookmark",
                true,
                Some("CmdOrCtrl+N"),
            )?;

            let bm_menu = Submenu::with_items(app, "Bookmarks", true, &[&bm_new_i])?;

            // Git menu
            let git_pull_i = MenuItem::with_id(app, "git_pull", "Pull", true, None::<&str>)?;
            let git_push_i = MenuItem::with_id(app, "git_push", "Push", true, None::<&str>)?;
            let git_menu = Submenu::with_items(app, "Git", true, &[&git_pull_i, &git_push_i])?;

            // App menu

            let menu = Menu::with_items(app, &[&file_menu, &bm_menu, &git_menu])?;
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
