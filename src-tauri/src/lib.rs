use std::collections::HashMap;
use std::sync::Mutex;
use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager, RunEvent};
use tauri::menu::{Menu, Submenu, MenuItem, PredefinedMenuItem};
use tauri_plugin_dialog::DialogExt;

#[derive(Clone, Serialize)]
struct PendingFile {
    text: String,
    file_path: String,
    base_path: String,
}

struct PendingFiles(Mutex<Vec<PendingFile>>);

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ExportConfig {
    id: String,
    name: String,
    export_type: String,
    file_name: String,
    output_dir: String,
    include_css: bool,
    include_frontmatter: bool,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ImageUploadConfig {
    id: String,
    name: String,
    provider: String,
    host: String,
    port: u16,
    username: String,
    password: String,
    remote_path: String,
    base_url: String,
}

fn theme_json(theme: tauri::Theme) -> serde_json::Value {
    let (theme_name, bg_color) = match theme {
        tauri::Theme::Dark => ("Dark", (30, 30, 30, 255)),
        _ => ("Light", (255, 255, 255, 255)),
    };
    serde_json::json!({
        "theme": theme_name,
        "accentColor": { "r": 68, "g": 138, "b": 255, "a": 1 },
        "background": { "R": bg_color.0, "G": bg_color.1, "B": bg_color.2, "A": bg_color.3 }
    })
}

#[tauri::command]
fn get_current_theme(window: tauri::Window) -> serde_json::Value {
    let theme = window.theme().unwrap_or(tauri::Theme::Light);
    theme_json(theme)
}

#[tauri::command]
fn content_loaded(app: tauri::AppHandle) -> Option<PendingFile> {
    app.state::<PendingFiles>().0.lock().unwrap().pop()
}

#[tauri::command]
fn export_callback(app: tauri::AppHandle, html: String, _context: serde_json::Value) -> Result<(), String> {
    app.dialog()
        .file()
        .add_filter("HTML", &["html", "htm"])
        .set_file_name("export.html")
        .save_file(move |file| {
            if let Some(path) = file.and_then(|f| f.as_path().map(|p| p.to_path_buf())) {
                let _ = std::fs::write(&path, &html);
            }
        });
    Ok(())
}

#[tauri::command]
fn print_html(app: tauri::AppHandle, html: String, _context: serde_json::Value) -> Result<(), String> {
    let label = format!(
        "print-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0)
    );
    let script = format!(
        "document.open();document.write({});document.close();setTimeout(function(){{window.print();}},500);",
        serde_json::to_string(&html).map_err(|e| e.to_string())?
    );
    let blank: tauri::Url = "about:blank".parse().unwrap();
    let builder = tauri::WebviewWindowBuilder::new(
        &app,
        label,
        tauri::WebviewUrl::External(blank),
    )
    .title("Print")
    .inner_size(900.0, 700.0)
    .on_page_load(move |window, payload| {
        if let tauri::webview::PageLoadEvent::Finished = payload.event() {
            let _ = window.eval(&script);
        }
    });
    builder.build().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn open_new_window(url: String) {
    let _ = open::that(&url);
}

#[tauri::command]
fn resize_table(rows: i32, columns: i32) -> serde_json::Value {
    serde_json::json!({ "row": rows - 1, "column": columns - 1 })
}

#[tauri::command]
fn set_always_on_top(window: tauri::Window, on_top: bool) -> Result<(), String> {
    window.set_always_on_top(on_top).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_compact_mode(window: tauri::Window, compact: bool) -> Result<(), String> {
    window.set_decorations(!compact).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_window_state(app: tauri::AppHandle, state: serde_json::Value) -> Result<(), String> {
    let mut settings = load_settings_raw(&app);
    settings.insert("windowState".into(), state);
    save_settings_raw(&app, settings)
}

fn settings_path(app: &tauri::AppHandle) -> std::path::PathBuf {
    let dir = app.path()
        .app_config_dir()
        .unwrap_or_else(|_| std::env::temp_dir().join("typeleft"));
    let _ = std::fs::create_dir_all(&dir);
    let path = dir.join("settings.json");
    // One-time migration from the pre-rename identifier.
    if !path.exists() {
        if let Some(parent) = dir.parent() {
            let legacy = parent.join("com.typedown.desktop").join("settings.json");
            if legacy.exists() {
                let _ = std::fs::copy(&legacy, &path);
            }
        }
    }
    path
}

fn load_settings_raw(app: &tauri::AppHandle) -> HashMap<String, serde_json::Value> {
    let path = settings_path(app);
    std::fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_else(default_settings)
}

fn default_settings() -> HashMap<String, serde_json::Value> {
    let mut s = HashMap::new();
    s.insert("sourceCode".into(), serde_json::json!(false));
    s.insert("lang".into(), serde_json::json!("en"));
    s.insert("basePath".into(), serde_json::json!(""));
    s.insert("markdown".into(), serde_json::json!("# Hello Typeleft\n\nStart typing..."));
    s.insert("autoSave".into(), serde_json::json!(true));
    s
}

#[tauri::command]
fn get_settings(app: tauri::AppHandle) -> HashMap<String, serde_json::Value> {
    let mut s = load_settings_raw(&app);
    // Migrate the legacy welcome document (from the pre-rename builds).
    if let Some(serde_json::Value::String(md)) = s.get("markdown") {
        if md == "# Hello Typedown\n\nStart typing..." {
            s.insert("markdown".into(), serde_json::json!("# Hello Typeleft\n\nStart typing..."));
        }
    }
    for (k, v) in default_settings() {
        s.entry(k).or_insert(v);
    }
    s
}

fn save_settings_raw(app: &tauri::AppHandle, settings: HashMap<String, serde_json::Value>) -> Result<(), String> {
    let path = settings_path(app);
    let json = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    std::fs::write(&path, &json).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_settings(app: tauri::AppHandle, settings: HashMap<String, serde_json::Value>) -> Result<(), String> {
    // Merge with existing settings so partial updates never drop fields such as
    // `markdown` or `basePath`.
    let mut merged = load_settings_raw(&app);
    for (k, v) in settings {
        merged.insert(k, v);
    }
    save_settings_raw(&app, merged)
}

use std::sync::OnceLock;

#[derive(Deserialize)]
struct I18nEntry {
    #[serde(default)]
    en: String,
    #[serde(default)]
    zh: String,
}

static I18N: OnceLock<HashMap<String, I18nEntry>> = OnceLock::new();

fn i18n() -> &'static HashMap<String, I18nEntry> {
    I18N.get_or_init(|| {
        let raw = include_str!("../resources/i18n.json");
        serde_json::from_str(raw).unwrap_or_default()
    })
}

#[tauri::command]
fn get_string_resources(app: tauri::AppHandle, names: Vec<String>) -> HashMap<String, String> {
    let settings = load_settings_raw(&app);
    let lang = settings.get("lang").and_then(|v| v.as_str()).unwrap_or("en");
    let dict = i18n();
    names.into_iter().map(|n| {
        let val = dict.get(&n).map(|entry| {
            match lang {
                "zh" if !entry.zh.is_empty() => entry.zh.clone(),
                _ => entry.en.clone(),
            }
        });
        (n.clone(), val.unwrap_or(n))
    }).collect()
}

#[tauri::command]
fn set_clipboard(r#type: String, data: serde_json::Value) -> bool {
    let text = match &data {
        serde_json::Value::String(s) => s.clone(),
        _ => return false,
    };
    match arboard::Clipboard::new() {
        Ok(mut ctx) => {
            if r#type == "text/html" {
                let _ = ctx.set().html(text, None);
            } else {
                let _ = ctx.set_text(text);
            }
            true
        }
        Err(_) => false,
    }
}

#[tauri::command]
fn get_clipboard_text() -> Option<String> {
    arboard::Clipboard::new().ok().and_then(|mut ctx| ctx.get_text().ok())
}

fn detect_image_type(bytes: &[u8]) -> &'static str {
    if bytes.len() < 4 { return "png"; }
    match &bytes[0..4] {
        [0x89, 0x50, 0x4E, 0x47] => "png",
        [0xFF, 0xD8, 0xFF, _] => "jpg",
        [0x52, 0x49, 0x46, 0x46] => "webp",
        [0x47, 0x49, 0x46, _] => "gif",
        [0x00, 0x00, 0x01, 0x00] => "ico",
        _ if bytes.len() > 6 => {
            match &bytes[0..6] {
                [0x42, 0x4D, _, _, _, _] => "bmp",
                [0x3C, 0x3F, 0x78, 0x6D, 0x6C, _] => "svg",
                [0x3C, 0x73, 0x76, 0x67, _, _] => "svg",
                _ => "png",
            }
        }
        _ => "png",
    }
}

fn ensure_unique_path(path: std::path::PathBuf) -> std::path::PathBuf {
    if !path.exists() { return path; }
    let stem = path.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
    let ext = path.extension().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
    let parent = path.parent().unwrap_or(std::path::Path::new("."));
    for i in 1..1000 {
        let candidate = parent.join(format!("{}_{}.{}", stem, i, ext));
        if !candidate.exists() { return candidate; }
    }
    path
}

#[tauri::command]
fn save_image(app: tauri::AppHandle, file_name: String, base64_data: String, sub_dir: String, base_path: Option<String>) -> Result<String, String> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&base64_data)
        .map_err(|e| format!("base64 decode error: {}", e))?;
    let ext = detect_image_type(&bytes);
    let base_path = match base_path {
        Some(p) if !p.trim().is_empty() => p,
        _ => {
            let base_settings = load_settings_raw(&app);
            base_settings.get("basePath").and_then(|v| v.as_str()).unwrap_or("").to_string()
        }
    };
    let images_dir = if sub_dir.is_empty() {
        std::path::PathBuf::from(&base_path).join("images")
    } else {
        std::path::PathBuf::from(&base_path).join(&sub_dir)
    };
    std::fs::create_dir_all(&images_dir).map_err(|e| format!("create dir error: {}", e))?;
    let file_stem = std::path::Path::new(&file_name).file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "image".to_string());
    let save_name = format!("{}.{}", file_stem, ext);
    let save_path = ensure_unique_path(images_dir.join(&save_name));
    std::fs::write(&save_path, &bytes).map_err(|e| format!("write error: {}", e))?;
    Ok(save_path.to_string_lossy().to_string())
}

#[tauri::command]
fn copy_image(source_path: String, dest_dir: String) -> Result<String, String> {
    let src = std::path::Path::new(&source_path);
    if !src.exists() { return Err("source file not found".into()); }
    let dest = std::path::PathBuf::from(&dest_dir);
    std::fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
    let name = src.file_name().ok_or("invalid source filename")?;
    let dest_path = ensure_unique_path(dest.join(name));
    std::fs::copy(src, &dest_path).map_err(|e| e.to_string())?;
    Ok(dest_path.to_string_lossy().to_string())
}

#[tauri::command]
fn get_clipboard_image() -> Option<String> {
    let mut ctx = arboard::Clipboard::new().ok()?;
    let img = ctx.get_image().ok()?;
    let w = img.width as u32;
    let h = img.height as u32;
    let rgba = img.bytes.as_ref();
    let mut png_data = Vec::new();
    {
        let mut encoder = png::Encoder::new(&mut png_data, w, h);
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);
        let mut writer = encoder.write_header().ok()?;
        writer.write_image_data(rgba).ok()?;
    }
    use base64::Engine;
    Some(base64::engine::general_purpose::STANDARD.encode(&png_data))
}

#[tauri::command]
fn load_image(path: String) -> Result<serde_json::Value, String> {
    use base64::Engine as _;
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    let ext = std::path::Path::new(&path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    let mime = match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "bmp" => "image/bmp",
        _ => "application/octet-stream",
    };
    let encoded = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(serde_json::json!({
        "url": format!("data:{};base64,{}", mime, encoded),
        "mime": mime,
        "size": bytes.len(),
    }))
}

#[derive(Serialize)]
struct FileEntry {
    name: String,
    path: String,
    is_dir: bool,
}

#[tauri::command]
fn list_directory(path: String) -> Result<Vec<FileEntry>, String> {
    let dir = std::path::Path::new(&path);
    if !dir.is_dir() {
        return Err("not a directory".into());
    }
    let mut entries = Vec::new();
    for entry in std::fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let ft = entry.file_type().map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') { continue; }
        entries.push(FileEntry {
            name,
            path: entry.path().to_string_lossy().to_string(),
            is_dir: ft.is_dir(),
        });
    }
    entries.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then(a.name.cmp(&b.name)));
    Ok(entries)
}

#[tauri::command]
fn open_folder_dialog(app: tauri::AppHandle) {
    let handle = app.clone();
    app.dialog().file().pick_folder(move |folder| {
        if let Some(path) = folder.and_then(|f| f.as_path().map(|p| p.to_path_buf())) {
            let path_str = path.to_string_lossy().to_string();
            let _ = save_recent_folder(handle.clone(), path_str.clone());
            let _ = handle.emit("FolderOpened", serde_json::json!({
                "path": path_str,
            }));
        }
    });
}

#[tauri::command]
fn pick_folder(app: tauri::AppHandle, default_path: Option<String>) {
    let handle = app.clone();
    let mut builder = app.dialog().file();
    if let Some(dir) = default_path {
        let expanded = expand_tilde(&dir);
        if !expanded.trim().is_empty() && std::path::Path::new(&expanded).is_dir() {
            builder = builder.set_directory(expanded);
        }
    }
    builder.pick_folder(move |folder| {
        let path = folder.and_then(|f| f.as_path().map(|p| p.to_string_lossy().to_string()));
        let _ = handle.emit("FolderPicked", path);
    });
}

#[tauri::command]
fn unhandled_exception(message: String) {
    let msg = &message;
    eprintln!("[Typeleft] Unhandled exception from editor: {}", msg);
    let _ = std::fs::OpenOptions::new()
        .append(true).create(true)
        .open(std::env::temp_dir().join("typeleft_errors.log"))
        .and_then(|f| {
            use std::io::Write;
            writeln!(&f, "[Typeleft] {}", msg)
        });
}

fn add_recent_file(app: &tauri::AppHandle, path: &str) {
    let mut settings = load_settings_raw(app);
    let mut recent: Vec<String> = settings.get("recentFiles")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_default();
    recent.retain(|p| p != path);
    recent.insert(0, path.to_string());
    if recent.len() > 10 { recent.truncate(10); }
    settings.insert("recentFiles".into(), serde_json::to_value(&recent).unwrap_or_default());
    let _ = save_settings_raw(app, settings);
    let _ = app.emit("RecentFilesUpdated", serde_json::json!({"files": recent}));
    let _ = setup_menu(app);
}

#[tauri::command]
fn get_recent_files(app: tauri::AppHandle) -> Vec<String> {
    let settings = load_settings_raw(&app);
    settings.get("recentFiles")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_default()
}

#[tauri::command]
fn clear_recent_files(app: tauri::AppHandle) -> Result<(), String> {
    let mut settings = load_settings_raw(&app);
    settings.insert("recentFiles".into(), serde_json::json!([]));
    save_settings_raw(&app, settings)
}

#[tauri::command]
fn check_file_exists(path: String) -> bool {
    std::path::Path::new(&path).exists()
}

fn expand_tilde(path: &str) -> String {
    if path == "~" || path.starts_with("~/") {
        if let Some(home) = std::env::var_os("HOME").or_else(|| std::env::var_os("USERPROFILE")) {
            let mut buf = std::path::PathBuf::from(home);
            if path.len() > 2 {
                buf.push(&path[2..]);
            }
            return buf.to_string_lossy().to_string();
        }
    }
    path.to_string()
}

#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    let path = expand_tilde(&path);
    if let Some(parent) = std::path::Path::new(&path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_file_dialog(app: tauri::AppHandle) {
    let handle = app.clone();
    app.dialog()
        .file()
        .add_filter("Markdown", &["md", "markdown", "mdown", "mkdn", "mkd", "mdwn", "mdtxt", "mdtext"])
        .add_filter("Text", &["txt", "text"])
        .add_filter("All Files", &["*"])
        .pick_file(move |file| {
            if let Some(path) = file.and_then(|f| f.as_path().map(|p| p.to_path_buf())) {
                match std::fs::read_to_string(&path) {
                    Ok(content) => {
                        let path_str = path.to_string_lossy().to_string();
                        let base_path = path.parent()
                            .map(|p| p.to_string_lossy().to_string())
                            .unwrap_or_default();
                        add_recent_file(&handle, &path_str);
                        let _ = handle.emit("LoadFile", serde_json::json!({
                            "text": content,
                            "basePath": base_path,
                            "filePath": path_str,
                        }));
                    }
                    Err(e) => eprintln!("[Typeleft] failed to read file: {}", e),
                }
            }
        });
}

fn file_mtime_ms(path: &std::path::Path) -> Result<i64, String> {
    let modified = std::fs::metadata(path)
        .map_err(|e| e.to_string())?
        .modified()
        .map_err(|e| e.to_string())?;
    modified
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .map_err(|e| e.to_string())
}

fn atomic_write(path: &std::path::Path, content: &str) -> Result<(), String> {
    let parent = path.parent().filter(|p| !p.as_os_str().is_empty()).unwrap_or_else(|| std::path::Path::new("."));
    std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "file".to_string());
    let tmp = parent.join(format!(".{}.tmp.{}", name, std::process::id()));
    std::fs::write(&tmp, content).map_err(|e| e.to_string())?;
    if let Err(e) = std::fs::rename(&tmp, path) {
        let _ = std::fs::remove_file(&tmp);
        return Err(e.to_string());
    }
    Ok(())
}

#[tauri::command]
fn save_file(
    app: tauri::AppHandle,
    file_path: String,
    content: String,
    expected_mtime: Option<i64>,
    force: Option<bool>,
) -> Result<i64, String> {
    let path = expand_tilde(&file_path);
    let p = std::path::Path::new(&path);

    if let Some(expected) = expected_mtime {
        if !force.unwrap_or(false) && p.exists() {
            let actual = file_mtime_ms(p)?;
            if actual != expected {
                return Err(format!("conflict:{}", actual));
            }
        }
    }

    atomic_write(p, &content)?;
    let mtime = file_mtime_ms(p)?;
    let _ = app.emit("FileSaved", serde_json::json!({ "filePath": file_path }));
    Ok(mtime)
}

#[tauri::command]
fn save_file_as(app: tauri::AppHandle, content: String) -> Result<(), String> {
    app.dialog()
        .file()
        .add_filter("Markdown", &["md", "markdown", "mdown", "mkdn", "mkd", "mdwn", "mdtxt", "mdtext"])
        .add_filter("Text", &["txt", "text"])
        .add_filter("All Files", &["*"])
        .set_file_name("untitled.md")
        .save_file(move |file| {
            if let Some(path) = file.and_then(|f| f.as_path().map(|p| p.to_path_buf())) {
                let path_str = path.to_string_lossy().to_string();
                let _ = std::fs::write(&path, &content);
                add_recent_file(&app, &path_str);
                let _ = app.emit("FileSaved", serde_json::json!({
                    "filePath": path_str,
                }));
            }
        });
    Ok(())
}

#[tauri::command]
fn rename_file(old_path: String, new_name: String) -> Result<String, String> {
    let old = std::path::Path::new(&old_path);
    let parent = old.parent().ok_or("no parent directory")?;
    let new_path = parent.join(&new_name);
    if new_path.exists() {
        return Err("target already exists".into());
    }
    std::fs::rename(&old, &new_path).map_err(|e| e.to_string())?;
    Ok(new_path.to_string_lossy().to_string())
}

#[tauri::command]
fn move_file(source: String, dest: String) -> Result<(), String> {
    let src = std::path::Path::new(&source);
    let dst = std::path::Path::new(&dest);
    if dst.exists() {
        return Err("target already exists".into());
    }
    if let Some(parent) = dst.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::rename(src, dst).map_err(|e| e.to_string())
}

#[tauri::command]
fn copy_file(source: String, dest: String) -> Result<(), String> {
    let src = std::path::Path::new(&source);
    let dst = std::path::Path::new(&dest);
    if src.is_dir() {
        copy_dir_recursive(src, dst).map_err(|e| e.to_string())
    } else {
        std::fs::copy(src, dst).map_err(|e| e.to_string())?;
        Ok(())
    }
}

fn copy_dir_recursive(src: &std::path::Path, dst: &std::path::Path) -> std::io::Result<()> {
    if !dst.exists() {
        std::fs::create_dir_all(dst)?;
    }
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let ft = entry.file_type()?;
        let dest_path = dst.join(entry.file_name());
        if ft.is_dir() {
            copy_dir_recursive(&entry.path(), &dest_path)?;
        } else {
            std::fs::copy(&entry.path(), &dest_path)?;
        }
    }
    Ok(())
}

#[tauri::command]
fn delete_file(path: String, use_trash: bool) -> Result<(), String> {
    if use_trash {
        trash::delete(&path).map_err(|e| e.to_string())
    } else {
        let p = std::path::Path::new(&path);
        if p.is_dir() {
            std::fs::remove_dir_all(p).map_err(|e| e.to_string())
        } else {
            std::fs::remove_file(p).map_err(|e| e.to_string())
        }
    }
}

#[tauri::command]
fn create_file(path: String) -> Result<(), String> {
    if std::path::Path::new(&path).exists() {
        return Err("target already exists".into());
    }
    if let Some(parent) = std::path::Path::new(&path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&path, "").map_err(|e| e.to_string())
}

#[tauri::command]
fn create_dir(path: String) -> Result<(), String> {
    if std::path::Path::new(&path).exists() {
        return Err("target already exists".into());
    }
    std::fs::create_dir_all(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn is_filename_valid(name: String) -> bool {
    let invalid_chars = &['/', '\\', ':', '*', '?', '"', '<', '>', '|', '\0'];
    !name.is_empty() && !name.contains(invalid_chars) && name != "." && name != ".."
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BackupMeta {
    id: String,
    created: i64,
    size: u64,
    is_newer: bool,
}

fn backup_dir(app: &tauri::AppHandle, path: &str) -> std::path::PathBuf {
    use std::hash::{Hash, Hasher};
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    path.hash(&mut hasher);
    let key = format!("{:016x}", hasher.finish());
    let base = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| std::env::temp_dir().join("typeleft"));
    base.join("backups").join(key)
}

fn backup_entries(dir: &std::path::Path) -> Vec<(String, i64, u64)> {
    let mut entries: Vec<(String, i64, u64)> = std::fs::read_dir(dir)
        .ok()
        .into_iter()
        .flatten()
        .flatten()
        .filter_map(|entry| {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("bak") {
                return None;
            }
            let id = path.file_stem()?.to_string_lossy().to_string();
            let created = id.parse::<i64>().ok()?;
            let size = entry.metadata().ok()?.len();
            Some((id, created, size))
        })
        .collect();
    entries.sort_by(|a, b| b.1.cmp(&a.1));
    entries
}

fn prune_backups(dir: &std::path::Path, keep: usize) {
    let entries = backup_entries(dir);
    for (id, _, _) in entries.into_iter().skip(keep) {
        let _ = std::fs::remove_file(dir.join(format!("{}.bak", id)));
    }
}

#[tauri::command]
fn save_backup(app: tauri::AppHandle, path: String, content: String) -> Result<(), String> {
    let dir = backup_dir(&app, &path);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);
    std::fs::write(dir.join(format!("{}.bak", now)), &content).map_err(|e| e.to_string())?;
    prune_backups(&dir, 20);
    Ok(())
}

#[tauri::command]
fn list_backups(app: tauri::AppHandle, path: String) -> Vec<BackupMeta> {
    let dir = backup_dir(&app, &path);
    let file_mtime = file_mtime_ms(std::path::Path::new(&path)).unwrap_or(0);
    backup_entries(&dir)
        .into_iter()
        .map(|(id, created, size)| BackupMeta {
            id,
            created,
            size,
            is_newer: created > file_mtime,
        })
        .collect()
}

#[tauri::command]
fn latest_backup(app: tauri::AppHandle, path: String) -> Option<BackupMeta> {
    list_backups(app, path).into_iter().next()
}

#[tauri::command]
fn get_file_mtime(path: String) -> Option<i64> {
    file_mtime_ms(std::path::Path::new(&expand_tilde(&path))).ok()
}

#[tauri::command]
fn read_backup(app: tauri::AppHandle, path: String, id: String) -> Result<String, String> {
    let file = backup_dir(&app, &path).join(format!("{}.bak", id));
    std::fs::read_to_string(&file).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_backup(app: tauri::AppHandle, path: String, id: String) -> Result<(), String> {
    let file = backup_dir(&app, &path).join(format!("{}.bak", id));
    if file.exists() {
        std::fs::remove_file(&file).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn clear_backups(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let dir = backup_dir(&app, &path);
    for (id, _, _) in backup_entries(&dir) {
        let _ = std::fs::remove_file(dir.join(format!("{}.bak", id)));
    }
    Ok(())
}

fn load_list<T: for<'de> serde::Deserialize<'de>>(app: &tauri::AppHandle, key: &str) -> Vec<T> {
    let settings = load_settings_raw(app);
    settings.get(key)
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_default()
}

fn save_list<T: serde::Serialize>(app: &tauri::AppHandle, key: &str, list: Vec<T>) -> Result<(), String> {
    let mut settings = load_settings_raw(app);
    settings.insert(key.into(), serde_json::to_value(&list).map_err(|e| e.to_string())?);
    save_settings_raw(app, settings)
}

#[tauri::command]
fn get_export_configs(app: tauri::AppHandle) -> Vec<ExportConfig> {
    load_list(&app, "exportConfigs")
}

#[tauri::command]
fn save_export_config(app: tauri::AppHandle, config: ExportConfig) -> Result<(), String> {
    let mut configs: Vec<ExportConfig> = load_list(&app, "exportConfigs");
    if let Some(existing) = configs.iter_mut().find(|c| c.id == config.id) {
        *existing = config;
    } else {
        configs.push(config);
    }
    save_list(&app, "exportConfigs", configs)
}

#[tauri::command]
fn delete_export_config(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let mut configs: Vec<ExportConfig> = load_list(&app, "exportConfigs");
    configs.retain(|c| c.id != id);
    save_list(&app, "exportConfigs", configs)
}

#[tauri::command]
fn get_image_upload_configs(app: tauri::AppHandle) -> Vec<ImageUploadConfig> {
    load_list(&app, "imageUploadConfigs")
}

#[tauri::command]
fn save_image_upload_config(app: tauri::AppHandle, config: ImageUploadConfig) -> Result<(), String> {
    let mut configs: Vec<ImageUploadConfig> = load_list(&app, "imageUploadConfigs");
    if let Some(existing) = configs.iter_mut().find(|c| c.id == config.id) {
        *existing = config;
    } else {
        configs.push(config);
    }
    save_list(&app, "imageUploadConfigs", configs)
}

#[tauri::command]
fn delete_image_upload_config(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let mut configs: Vec<ImageUploadConfig> = load_list(&app, "imageUploadConfigs");
    configs.retain(|c| c.id != id);
    save_list(&app, "imageUploadConfigs", configs)
}

#[tauri::command]
fn upload_image(app: tauri::AppHandle, base64_data: String, file_name: String) -> Result<String, String> {
    use base64::Engine as _;
    let configs: Vec<ImageUploadConfig> = load_list(&app, "imageUploadConfigs");
    let cfg = configs.into_iter().next().ok_or("no upload configuration")?;
    if cfg.provider != "http" {
        return Err(format!("unsupported provider: {}", cfg.provider));
    }
    if cfg.host.trim().is_empty() {
        return Err("upload url is empty".into());
    }
    let raw = base64_data
        .split(',')
        .last()
        .unwrap_or(&base64_data)
        .to_string();
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(raw.as_bytes())
        .map_err(|e| e.to_string())?;
    let safe_name = file_name
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '.' || c == '-' || c == '_' { c } else { '_' })
        .collect::<String>();
    let tmp = std::env::temp_dir().join(format!("typeleft-upload-{}-{}", std::process::id(), safe_name));
    std::fs::write(&tmp, &bytes).map_err(|e| e.to_string())?;

    let mut cmd = std::process::Command::new("curl");
    cmd.arg("-sS").arg("-X").arg("POST");
    if !cfg.password.trim().is_empty() {
        cmd.arg("-H").arg(format!("Authorization: Bearer {}", cfg.password.trim()));
    }
    cmd.arg("-F").arg(format!("file=@{};filename={}", tmp.to_string_lossy(), safe_name));
    cmd.arg(&cfg.host);

    let output = cmd.output().map_err(|e| e.to_string());
    let _ = std::fs::remove_file(&tmp);
    let output = output?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    let text = String::from_utf8_lossy(&output.stdout).to_string();
    let json: serde_json::Value = serde_json::from_str(&text).unwrap_or(serde_json::Value::Null);
    let url = json.get("url")
        .and_then(|v| v.as_str())
        .or_else(|| json.pointer("/data/url").and_then(|v| v.as_str()))
        .or_else(|| json.get("data").and_then(|v| v.as_str()))
        .unwrap_or("")
        .to_string();
    if url.is_empty() {
        return Err(format!("upload response has no url: {}", text));
    }
    if !cfg.base_url.trim().is_empty() && url.starts_with('/') {
        return Ok(format!("{}{}", cfg.base_url.trim_end_matches('/'), url));
    }
    Ok(url)
}

#[tauri::command]
fn list_recent_folders(app: tauri::AppHandle) -> Vec<String> {
    load_list(&app, "recentFolders")
}

#[tauri::command]
fn save_recent_folder(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let mut folders: Vec<String> = load_list(&app, "recentFolders");
    folders.retain(|p| p != &path);
    folders.insert(0, path);
    if folders.len() > 10 { folders.truncate(10); }
    save_list(&app, "recentFolders", folders)
}

#[tauri::command]
fn clear_recent_folders(app: tauri::AppHandle) -> Result<(), String> {
    save_list(&app, "recentFolders", Vec::<String>::new())
}

fn load_and_queue_file(app: &tauri::AppHandle, path: &std::path::Path) {
    let text = match std::fs::read_to_string(path) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("[Typeleft] Failed to read file: {}", e);
            return;
        }
    };
    let file_path = path.to_string_lossy().to_string();
    let base_path = path.parent().map(|p| p.to_string_lossy().to_string()).unwrap_or_default();
    add_recent_file(app, &file_path);
    let pending = PendingFile {
        text: text.clone(),
        file_path: file_path.clone(),
        base_path: base_path.clone(),
    };
    // Queue for frontend startup (`content_loaded`), and also notify a running
    // frontend so opening a file while the app is already open actually loads it.
    app.state::<PendingFiles>().0.lock().unwrap().push(pending);
    let _ = app.emit("LoadFile", serde_json::json!({
        "text": text,
        "basePath": base_path,
        "filePath": file_path,
    }));
}

fn tr(lang: &str, en: &'static str) -> &'static str {
    if lang != "zh" {
        return en;
    }
    match en {
        "File" => "文件",
        "New" => "新建",
        "Open..." => "打开...",
        "Save" => "保存",
        "Save As..." => "另存为...",
        "Import HTML..." => "导入 HTML...",
        "Export HTML..." => "导出 HTML...",
        "Print..." => "打印...",
        "Close Window" => "关闭窗口",
        "Edit" => "编辑",
        "Undo" => "撤销",
        "Redo" => "重做",
        "Cut" => "剪切",
        "Copy" => "复制",
        "Paste" => "粘贴",
        "Select All" => "全选",
        "Find..." => "查找...",
        "Replace..." => "替换...",
        "Format" => "格式",
        "Bold" => "加粗",
        "Italic" => "斜体",
        "Code" => "行内代码",
        "Strikethrough" => "删除线",
        "Link" => "链接",
        "Image" => "图片",
        "Clear Format" => "清除格式",
        "Paragraph" => "段落",
        "Heading 1" => "一级标题",
        "Heading 2" => "二级标题",
        "Heading 3" => "三级标题",
        "Heading 4" => "四级标题",
        "Heading 5" => "五级标题",
        "Heading 6" => "六级标题",
        "Quote Block" => "引用块",
        "Code Block" => "代码块",
        "Ordered List" => "有序列表",
        "Bullet List" => "无序列表",
        "Task List" => "任务列表",
        "Table" => "表格",
        "Math Block" => "数学块",
        "Horizontal Rule" => "分隔线",
        "View" => "视图",
        "Source Code" => "源码模式",
        "Toggle Sidebar" => "切换侧边栏",
        "Show Outline" => "显示大纲",
        "Settings..." => "设置...",
        "Window" => "窗口",
        "Compact Mode" => "紧凑模式",
        "Always on Top" => "窗口置顶",
        "New Window" => "新建窗口",
        "Quit" => "退出",
        "Recent Files" => "最近文件",
        "Image Hosting..." => "图床配置...",
        "Clear Recent" => "清空最近文件",
        "(empty)" => "（空）",
        _ => en,
    }
}

fn setup_menu(app: &tauri::AppHandle) -> Result<(), tauri::Error> {
    let lang = load_settings_raw(app)
        .get("lang")
        .and_then(|v| v.as_str())
        .unwrap_or("en")
        .to_string();
    let tr = move |en: &'static str| tr(&lang, en);

    let new_file = MenuItem::with_id(app, "new_file", tr("New"), true, Some("CmdOrCtrl+N"))?;
    let open_file = MenuItem::with_id(app, "open_file", tr("Open..."), true, Some("CmdOrCtrl+O"))?;
    let save = MenuItem::with_id(app, "save", tr("Save"), true, Some("CmdOrCtrl+S"))?;
    let save_as = MenuItem::with_id(app, "save_as", tr("Save As..."), true, Some("CmdOrCtrl+Shift+S"))?;
    let import_html = MenuItem::with_id(app, "import_html", tr("Import HTML..."), true, None::<&str>)?;
    let export_html = MenuItem::with_id(app, "export_html", tr("Export HTML..."), true, None::<&str>)?;
    let print_item = MenuItem::with_id(app, "print", tr("Print..."), true, Some("CmdOrCtrl+P"))?;
    let image_hosting = MenuItem::with_id(app, "image_hosting", tr("Image Hosting..."), true, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(app)?;
    let close = MenuItem::with_id(app, "close_window", tr("Close Window"), true, Some("CmdOrCtrl+W"))?;

    let recent_menu = Submenu::with_items(app, tr("Recent Files"), true, &[])?;
    let recent_files: Vec<String> = load_list(app, "recentFiles");
    if recent_files.is_empty() {
        let empty = MenuItem::with_id(app, "recent_empty", tr("(empty)"), false, None::<&str>)?;
        recent_menu.append(&empty)?;
    } else {
        for (i, path) in recent_files.iter().take(10).enumerate() {
            let label = std::path::Path::new(path)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| path.clone());
            let item = MenuItem::with_id(app, format!("recent_file_{}", i), label, true, None::<&str>)?;
            recent_menu.append(&item)?;
        }
        recent_menu.append(&PredefinedMenuItem::separator(app)?)?;
        let clear_recent = MenuItem::with_id(app, "recent_clear", tr("Clear Recent"), true, None::<&str>)?;
        recent_menu.append(&clear_recent)?;
    }

    let file_menu = Submenu::with_items(app, tr("File"), true, &[
        &new_file, &open_file, &recent_menu, &import_html, &export_html, &print_item, &image_hosting, &sep1, &save, &save_as, &PredefinedMenuItem::separator(app)?, &close,
    ])?;

    let undo = MenuItem::with_id(app, "undo", tr("Undo"), true, None::<&str>)?;
    let redo = MenuItem::with_id(app, "redo", tr("Redo"), true, None::<&str>)?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let cut = MenuItem::with_id(app, "cut", tr("Cut"), true, Some("CmdOrCtrl+X"))?;
    let copy = MenuItem::with_id(app, "copy", tr("Copy"), true, Some("CmdOrCtrl+C"))?;
    let paste = MenuItem::with_id(app, "paste", tr("Paste"), true, Some("CmdOrCtrl+V"))?;
    let select_all = MenuItem::with_id(app, "select_all", tr("Select All"), true, Some("CmdOrCtrl+A"))?;
    let sep3 = PredefinedMenuItem::separator(app)?;
    let find = MenuItem::with_id(app, "find", tr("Find..."), true, Some("CmdOrCtrl+F"))?;
    let replace = MenuItem::with_id(app, "replace", tr("Replace..."), true, Some("CmdOrCtrl+H"))?;

    let edit_menu = Submenu::with_items(app, tr("Edit"), true, &[
        &undo, &redo, &sep2, &cut, &copy, &paste, &select_all, &sep3, &find, &replace,
    ])?;

    let bold = MenuItem::with_id(app, "bold", tr("Bold"), true, Some("CmdOrCtrl+B"))?;
    let italic = MenuItem::with_id(app, "italic", tr("Italic"), true, Some("CmdOrCtrl+I"))?;
    let code = MenuItem::with_id(app, "code", tr("Code"), true, None::<&str>)?;
    let strike = MenuItem::with_id(app, "strike", tr("Strikethrough"), true, None::<&str>)?;
    let hyperlink = MenuItem::with_id(app, "hyperlink", tr("Link"), true, Some("CmdOrCtrl+K"))?;
    let image = MenuItem::with_id(app, "image", tr("Image"), true, None::<&str>)?;
    let clear = MenuItem::with_id(app, "clear_format", tr("Clear Format"), true, None::<&str>)?;

    let format_menu = Submenu::with_items(app, tr("Format"), true, &[
        &bold, &italic, &code, &strike, &PredefinedMenuItem::separator(app)?,
        &hyperlink, &image, &PredefinedMenuItem::separator(app)?, &clear,
    ])?;

    let h1 = MenuItem::with_id(app, "heading_1", tr("Heading 1"), true, Some("CmdOrCtrl+1"))?;
    let h2 = MenuItem::with_id(app, "heading_2", tr("Heading 2"), true, Some("CmdOrCtrl+2"))?;
    let h3 = MenuItem::with_id(app, "heading_3", tr("Heading 3"), true, Some("CmdOrCtrl+3"))?;
    let h4 = MenuItem::with_id(app, "heading_4", tr("Heading 4"), true, Some("CmdOrCtrl+4"))?;
    let h5 = MenuItem::with_id(app, "heading_5", tr("Heading 5"), true, Some("CmdOrCtrl+5"))?;
    let h6 = MenuItem::with_id(app, "heading_6", tr("Heading 6"), true, Some("CmdOrCtrl+6"))?;
    let sep4 = PredefinedMenuItem::separator(app)?;
    let quote = MenuItem::with_id(app, "quote", tr("Quote Block"), true, None::<&str>)?;
    let code_block = MenuItem::with_id(app, "code_block", tr("Code Block"), true, None::<&str>)?;
    let ordered_list = MenuItem::with_id(app, "ordered_list", tr("Ordered List"), true, None::<&str>)?;
    let bullet_list = MenuItem::with_id(app, "bullet_list", tr("Bullet List"), true, None::<&str>)?;
    let task_list = MenuItem::with_id(app, "task_list", tr("Task List"), true, None::<&str>)?;
    let table = MenuItem::with_id(app, "table", tr("Table"), true, None::<&str>)?;
    let math = MenuItem::with_id(app, "math_block", tr("Math Block"), true, None::<&str>)?;
    let hr = MenuItem::with_id(app, "horizontal_rule", tr("Horizontal Rule"), true, None::<&str>)?;

    let paragraph_menu = Submenu::with_items(app, tr("Paragraph"), true, &[
        &h1, &h2, &h3, &h4, &h5, &h6, &sep4,
        &quote, &code_block, &ordered_list, &bullet_list, &task_list,
        &table, &math, &hr,
    ])?;

    let view_source = MenuItem::with_id(app, "view_source", tr("Source Code"), true, None::<&str>)?;
    let view_sidebar = MenuItem::with_id(app, "view_sidebar", tr("Toggle Sidebar"), true, None::<&str>)?;
    let view_outline = MenuItem::with_id(app, "view_outline", tr("Show Outline"), true, None::<&str>)?;
    let sep_view = PredefinedMenuItem::separator(app)?;
    let view_settings = MenuItem::with_id(app, "view_settings", tr("Settings..."), true, Some("CmdOrCtrl+,"))?;

    let view_menu = Submenu::with_items(app, tr("View"), true, &[
        &view_source, &view_sidebar, &view_outline, &sep_view, &view_settings,
    ])?;

    let compact_mode = MenuItem::with_id(app, "compact_mode", tr("Compact Mode"), true, None::<&str>)?;
    let always_on_top = MenuItem::with_id(app, "always_on_top", tr("Always on Top"), true, None::<&str>)?;
    let sep_win = PredefinedMenuItem::separator(app)?;
    let new_window = MenuItem::with_id(app, "new_window", tr("New Window"), true, Some("CmdOrCtrl+Shift+N"))?;

    let window_menu = Submenu::with_items(app, tr("Window"), true, &[
        &compact_mode, &always_on_top, &sep_win, &new_window,
    ])?;

    // On macOS the first submenu is used as the application menu, so provide one
    // explicitly; otherwise the File menu would be swallowed by it.
    let app_menu = Submenu::with_items(app, "Typeleft", true, &[
        &PredefinedMenuItem::separator(app)?,
        &PredefinedMenuItem::hide(app, None)?,
        &PredefinedMenuItem::hide_others(app, None)?,
        &PredefinedMenuItem::separator(app)?,
        &PredefinedMenuItem::quit(app, Some(tr("Quit")))?,
    ])?;

    let menu = Menu::with_items(app, &[&app_menu, &file_menu, &edit_menu, &format_menu, &paragraph_menu, &view_menu, &window_menu])?;
    app.set_menu(menu)?;
    Ok(())
}

use tauri_plugin_global_shortcut::GlobalShortcutExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    eprintln!("[Typeleft] Rust main() started");
    let _ = std::fs::write(std::env::temp_dir().join("typeleft_errors.log"), "[Typeleft] Rust main() started\n");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(PendingFiles(Mutex::new(Vec::new())))
        .on_window_event(|window, event| {
            match event {
                tauri::WindowEvent::ThemeChanged(theme) => {
                    let _ = window.emit("ThemeChanged", theme_json(*theme));
                }
                tauri::WindowEvent::CloseRequested { .. } => {
                    if let Ok(pos) = window.outer_position() {
                        if let Ok(size) = window.outer_size() {
                            let _ = window.emit("SaveWindowState", serde_json::json!({
                                "x": pos.x, "y": pos.y,
                                "width": size.width, "height": size.height,
                            }));
                        }
                    }
                }
                _ => {}
            }
        })
        .setup(|app| {
            setup_menu(app.handle())?;

            {
                use tauri::Listener;
                let handle = app.handle().clone();
                let _ = app.listen("LanguageChanged", move |_event| {
                    if let Err(e) = setup_menu(&handle) {
                        eprintln!("[Typeleft] failed to rebuild menu: {}", e);
                    }
                });
            }

            if let Some(window) = app.get_webview_window("main") {
                let settings = load_settings_raw(app.handle());
                if let Some(state) = settings.get("windowState") {
                    let x = state.get("x").and_then(|v| v.as_i64());
                    let y = state.get("y").and_then(|v| v.as_i64());
                    let w = state.get("width").and_then(|v| v.as_u64());
                    let h = state.get("height").and_then(|v| v.as_u64());
                    if let (Some(w), Some(h)) = (w, h) {
                        let _ = window.set_size(tauri::PhysicalSize { width: w as u32, height: h as u32 });
                    }
                    if let (Some(x), Some(y)) = (x, y) {
                        let _ = window.set_position(tauri::PhysicalPosition { x: x as i32, y: y as i32 });
                    }
                }
                let compact = settings.get("compactMode").and_then(|v| v.as_bool()).unwrap_or(false);
                let topmost = settings.get("alwaysOnTop").and_then(|v| v.as_bool()).unwrap_or(false);
                if compact { let _ = window.set_decorations(false); }
                if topmost { let _ = window.set_always_on_top(true); }

                // Startup actions
                let file_action = settings.get("fileStartupAction")
                    .and_then(|v| v.as_str()).unwrap_or("");
                let folder_action = settings.get("folderStartupAction")
                    .and_then(|v| v.as_str()).unwrap_or("openLast");

                if file_action == "openLast" {
                    if let Some(recent) = settings.get("recentFiles")
                        .and_then(|v| v.as_array())
                        .and_then(|a| a.first())
                        .and_then(|v| v.as_str())
                    {
                        let p = std::path::Path::new(recent);
                        if p.exists() {
                            load_and_queue_file(app.handle(), p);
                        }
                    }
                }
                if folder_action == "openLast" {
                    if let Some(recent) = settings.get("recentFolders")
                        .and_then(|v| v.as_array())
                        .and_then(|a| a.first())
                        .and_then(|v| v.as_str())
                    {
                        let p = std::path::Path::new(recent);
                        if p.exists() {
                            let _ = window.emit("FolderOpened", serde_json::json!({"path": recent}));
                        }
                    }
                }
            }

            let app_handle = app.handle().clone();
            if let Err(e) = app.global_shortcut().on_shortcut("Shift+F", move |_app, _shortcut, event| {
                let _ = app_handle.emit("GlobalShortcut", serde_json::json!({
                    "id": event.id,
                    "state": format!("{:?}", event.state),
                }));
            }) {
                eprintln!("[Typeleft] Failed to register shortcut Shift+F: {}", e);
            }

            Ok(())
        })
        .on_menu_event(|app, event| {
            let menu_id = event.id().as_ref().to_string();
            if let Some(rest) = menu_id.strip_prefix("recent_file_") {
                if let Ok(idx) = rest.parse::<usize>() {
                    let files: Vec<String> = load_list(app, "recentFiles");
                    if let Some(path) = files.get(idx) {
                        let p = std::path::Path::new(path);
                        if p.exists() {
                            load_and_queue_file(app, p);
                        } else {
                            eprintln!("[Typeleft] recent file missing: {}", path);
                        }
                    }
                }
                return;
            }
            if menu_id == "recent_clear" {
                let _ = save_list(app, "recentFiles", Vec::<String>::new());
                let _ = setup_menu(app);
                return;
            }
            match menu_id.as_str() {
                "new_file" => { let _ = app.emit("NewFile", ()); }
                "open_file" => { open_file_dialog(app.clone()); }
                "save" => { let _ = app.emit("MenuSave", ()); }
                "save_as" => { let _ = app.emit("MenuSaveAs", ()); }
                "close_window" => { if let Some(window) = app.get_webview_window("main") { let _ = window.close(); } }
                "import_html" => { let _ = app.emit("ImportHTMLDialog", ()); }
                "export_html" => { let _ = app.emit("OpenExportDialog", ()); }
                "print" => { let _ = app.emit("Export", serde_json::json!({"type": "print", "context": {}})); }
                "image_hosting" => { let _ = app.emit("OpenImageConfigDialog", ()); }
                "undo" => { let _ = app.emit("Undo", ()); }
                "redo" => { let _ = app.emit("Redo", ()); }
                "cut" => { let _ = app.emit("Cut", serde_json::json!({"type": "normal"})); }
                "copy" => { let _ = app.emit("Copy", serde_json::json!({"type": "normal"})); }
                "paste" => { let _ = app.emit("Paste", serde_json::json!({"type": "normal"})); }
                "select_all" => { let _ = app.emit("SelectAll", ()); }
                "find" => { let _ = app.emit("SearchOpenChange", serde_json::json!({"open": 1})); }
                "replace" => { let _ = app.emit("SearchOpenChange", serde_json::json!({"open": 2})); }
                "bold" => { let _ = app.emit("Format", "bold"); }
                "italic" => { let _ = app.emit("Format", "italic"); }
                "code" => { let _ = app.emit("Format", "inline_code"); }
                "strike" => { let _ = app.emit("Format", "strike"); }
                "hyperlink" => { let _ = app.emit("Format", "link"); }
                "image" => { let _ = app.emit("InsertImage", ""); }
                "clear_format" => { let _ = app.emit("Format", "clear"); }
                "heading_1" => { let _ = app.emit("UpdateParagraph", "heading 1"); }
                "heading_2" => { let _ = app.emit("UpdateParagraph", "heading 2"); }
                "heading_3" => { let _ = app.emit("UpdateParagraph", "heading 3"); }
                "heading_4" => { let _ = app.emit("UpdateParagraph", "heading 4"); }
                "heading_5" => { let _ = app.emit("UpdateParagraph", "heading 5"); }
                "heading_6" => { let _ = app.emit("UpdateParagraph", "heading 6"); }
                "quote" => { let _ = app.emit("UpdateParagraph", "blockquote"); }
                "code_block" => { let _ = app.emit("UpdateParagraph", "pre"); }
                "ordered_list" => { let _ = app.emit("UpdateParagraph", "ol-order"); }
                "bullet_list" => { let _ = app.emit("UpdateParagraph", "ul-bullet"); }
                "task_list" => { let _ = app.emit("UpdateParagraph", "ul-task"); }
                "table" => { let _ = app.emit("UpdateParagraph", "table"); }
                "math_block" => { let _ = app.emit("UpdateParagraph", "mathblock"); }
                "horizontal_rule" => { let _ = app.emit("InsertParagraph", "hr"); }
                "view_source" => { let _ = app.emit("ToggleSourceCode", ()); }
                "view_sidebar" => { let _ = app.emit("SidebarToggle", ()); }
                "view_outline" => { let _ = app.emit("SidebarSection", serde_json::json!({"section": "toc"})); }
                "view_settings" => { let _ = app.emit("OpenSettings", ()); }
                "compact_mode" => { let _ = app.emit("ToggleCompactMode", ()); }
                "always_on_top" => { let _ = app.emit("ToggleAlwaysOnTop", ()); }
                "new_window" => { let _ = app.emit("NewWindow", ()); }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_current_theme,
            content_loaded,
            export_callback,
            print_html,
            open_new_window,
            resize_table,
            get_settings,
            save_settings,
            save_window_state,
            set_always_on_top,
            set_compact_mode,
            get_string_resources,
            set_clipboard,
            get_clipboard_text,
            save_image,
            copy_image,
            get_clipboard_image,
            load_image,
            unhandled_exception,
            open_file_dialog,
            read_text_file,
            write_text_file,
            save_file,
            save_file_as,
            get_recent_files,
            clear_recent_files,
            check_file_exists,
            list_directory,
            open_folder_dialog,
            pick_folder,
            rename_file,
            move_file,
            copy_file,
            delete_file,
            create_file,
            create_dir,
            is_filename_valid,
            save_backup,
            list_backups,
            latest_backup,
            read_backup,
            get_file_mtime,
            delete_backup,
            clear_backups,
            get_export_configs,
            save_export_config,
            delete_export_config,
            get_image_upload_configs,
            save_image_upload_config,
            delete_image_upload_config,
            upload_image,
            list_recent_folders,
            save_recent_folder,
            clear_recent_folders,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            // `RunEvent::Opened` only exists on macOS (file association / open with).
            #[cfg(target_os = "macos")]
            {
                if let RunEvent::Opened { urls } = event {
                    for url in urls {
                        if let Ok(path) = url.to_file_path() {
                            load_and_queue_file(app_handle, &path);
                        }
                    }
                }
            }
            #[cfg(not(target_os = "macos"))]
            {
                let _ = (app_handle, event);
            }
        });
}
