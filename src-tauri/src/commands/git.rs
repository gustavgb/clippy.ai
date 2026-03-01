/// Formats the current UTC time as "YYYY-MM-DD HH:MM:SS" without any external crates.
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

/// Helper: run a git sub-command in `dir` and return stdout or a trimmed error.
fn git_run(args: &[&str], dir: &std::path::Path) -> Result<String, String> {
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
}

/// Stages the workspace file, commits with a timestamped message, and pushes.
#[tauri::command]
pub fn git_push(file_path: String) -> Result<String, String> {
    let path = std::path::Path::new(&file_path);
    let dir = path
        .parent()
        .ok_or_else(|| "Invalid workspace file path".to_string())?;

    // Step 1: Confirm it's a git repo and there are pending changes
    let status_out = git_run(&["status", "--porcelain"], dir)
        .map_err(|e| format!("git status failed — is this a git repository?\n{}", e))?;

    if status_out.trim().is_empty() {
        return Err("No changes to commit.".to_string());
    }

    // Step 2: git add <workspace file>
    git_run(&["add", &file_path], dir).map_err(|e| format!("git add failed:\n{}", e))?;

    // Step 3: git commit
    let commit_msg = format!("Backup bookmarks {}", format_utc_now());
    git_run(&["commit", "-m", &commit_msg], dir)
        .map_err(|e| format!("git commit failed:\n{}", e))?;

    // Step 4: git push
    git_run(&["push"], dir).map_err(|e| format!("git push failed:\n{}", e))?;

    Ok(format!(
        "Bookmarks backed up successfully ({})",
        format_utc_now()
    ))
}

/// Runs `git pull --ff` in the workspace file's directory.
#[tauri::command]
pub fn git_pull(file_path: String) -> Result<String, String> {
    let path = std::path::Path::new(&file_path);
    let dir = path
        .parent()
        .ok_or_else(|| "Invalid workspace file path".to_string())?;

    // Verify this is a git repository
    git_run(&["status"], dir).map_err(|e| format!("Not a git repository:\n{}", e))?;

    let out = git_run(&["pull", "--ff"], dir).map_err(|e| format!("git pull failed:\n{}", e))?;

    Ok(out.trim().to_string())
}
