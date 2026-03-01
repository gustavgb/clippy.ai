mod commands;
mod menu;

use commands::window::AppState;
use std::sync::Mutex;

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
            commands::window::get_initial_file,
            commands::window::set_title,
            commands::window::close_app,
            commands::window::get_settings_path,
            commands::window::open_url,
            commands::web::fetch_page_title,
            commands::web::fetch_ai_summary,
            commands::web::list_gemini_models,
            commands::git::git_push,
            commands::git::git_pull,
        ])
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| Ok(menu::build_menu(app)?))
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
