/// Fetches the <title> of a web page via an HTTP GET request.
#[tauri::command]
pub async fn fetch_page_title(url: String) -> Result<String, String> {
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
pub async fn list_gemini_models(api_key: String) -> Result<Vec<String>, String> {
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

/// Fetches a web page, strips HTML, and summarises it via the Gemini API.
#[tauri::command]
pub async fn fetch_ai_summary(
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
