#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

struct AppState {
    is_connected: Mutex<bool>,
    selected_server: Mutex<String>,
}

#[derive(Serialize, Deserialize)]
struct LoginRequest {
    email: String,
    password: String,
}

#[derive(Serialize, Deserialize)]
struct LoginResponse {
    access_token: String,
    user: UserResponse,
}

#[derive(Serialize, Deserialize)]
struct UserResponse {
    id: String,
    email: String,
    name: String,
}

#[tauri::command]
async fn login(email: String, password: String) -> Result<LoginResponse, String> {
    let client = reqwest::Client::new();
    
    let response = client
        .post("https://api.lapka.ru/api/auth/login")
        .json(&LoginRequest { email, password })
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    if response.status() == 200 {
        response
            .json::<LoginResponse>()
            .await
            .map_err(|e| e.to_string())
    } else {
        Err("Login failed".to_string())
    }
}

#[tauri::command]
fn get_connection_status(state: State<AppState>) -> bool {
    *state.is_connected.lock().unwrap()
}

#[tauri::command]
fn toggle_connection(state: State<AppState>) -> bool {
    let mut connected = state.is_connected.lock().unwrap();
    *connected = !*connected;
    *connected
}

#[tauri::command]
fn get_selected_server(state: State<AppState>) -> String {
    state.selected_server.lock().unwrap().clone()
}

#[tauri::command]
fn set_selected_server(state: State<AppState>, server: String) {
    *state.selected_server.lock().unwrap() = server;
}

fn main() {
    env_logger::init();
    log::info!("Starting Lapka VPN desktop app");

    tauri::Builder::default()
        .manage(AppState {
            is_connected: Mutex::new(false),
            selected_server: Mutex::new("Netherlands".to_string()),
        })
        .invoke_handler(tauri::generate_handler![
            login,
            get_connection_status,
            toggle_connection,
            get_selected_server,
            set_selected_server,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}