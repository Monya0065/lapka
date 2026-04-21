#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

struct AppState {
    access_token: Mutex<Option<String>>,
}

#[derive(Serialize, Deserialize)]
struct LoginRequest {
    email: String,
    password: String,
}

#[derive(Serialize, Deserialize)]
struct LoginResponse {
    access_token: String,
    refresh_token: String,
}

#[tauri::command]
async fn login(
    email: String,
    password: String,
    state: State<'_, AppState>,
) -> Result<LoginResponse, String> {
    let client = reqwest::Client::new();
    
    let res = client
        .post("http://localhost:8001/api/auth/login")
        .json(&LoginRequest { email, password })
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    if res.status().is_success() {
        let data: LoginResponse = res.json().await.map_err(|e| e.to_string())?;
        *state.access_token.lock().unwrap() = Some(data.access_token.clone());
        Ok(data)
    } else {
        Err("Login failed".to_string())
    }
}

#[tauri::command]
async fn get_subscription(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let token = state.access_token.lock().unwrap();
    let token = token.as_ref().ok_or("Not authenticated")?;
    
    let client = reqwest::Client::new();
    let res = client
        .get("http://localhost:8001/api/billing/subscription")
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    if res.status().is_success() {
        let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
        Ok(data)
    } else {
        Err("Failed to get subscription".to_string())
    }
}

#[tauri::command]
async fn get_devices(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let token = state.access_token.lock().unwrap();
    let token = token.as_ref().ok_or("Not authenticated")?;
    
    let client = reqwest::Client::new();
    let res = client
        .get("http://localhost:8001/api/devices")
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    if res.status().is_success() {
        let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
        Ok(data)
    } else {
        Err("Failed to get devices".to_string())
    }
}

#[tauri::command]
async fn create_device(
    name: String,
    platform: String,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let token = state.access_token.lock().unwrap();
    let token = token.as_ref().ok_or("Not authenticated")?;
    
    #[derive(Serialize)]
    struct DeviceRequest {
        name: String,
        platform: String,
    }
    
    let client = reqwest::Client::new();
    let res = client
        .post("http://localhost:8001/api/devices")
        .header("Authorization", format!("Bearer {}", token))
        .json(&DeviceRequest { name, platform })
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    if res.status().is_success() {
        let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
        Ok(data)
    } else {
        Err("Failed to create device".to_string())
    }
}

#[tauri::command]
fn logout(state: State<'_, AppState>) -> Result<(), String> {
    *state.access_token.lock().unwrap() = None;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .manage(AppState {
            access_token: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            login,
            get_subscription,
            get_devices,
            create_device,
            logout,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}