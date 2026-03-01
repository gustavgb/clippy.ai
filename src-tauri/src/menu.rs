use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::Emitter;

/// Builds and sets the native application menu, then wires up the menu-event
/// emitter that forwards every action to the frontend as a `menu-action` event.
pub fn build_menu(app: &mut tauri::App) -> tauri::Result<()> {
    // File menu
    let new_i = MenuItem::with_id(app, "new", "New workspace", true, Some("CmdOrCtrl+Shift+N"))?;
    let open_i = MenuItem::with_id(app, "open", "Open workspace", true, Some("CmdOrCtrl+O"))?;
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

    let menu = Menu::with_items(app, &[&file_menu, &bm_menu, &git_menu])?;
    app.set_menu(menu)?;

    app.on_menu_event(|app, event| {
        app.emit("menu-action", event.id().as_ref()).ok();
    });

    Ok(())
}
