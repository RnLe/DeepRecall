use std::collections::HashMap;
use std::net::{TcpListener, TcpStream};
use std::io::{Read, Write};
use std::sync::Mutex;
use std::thread;
use tauri::{AppHandle, Emitter};
use crate::app_log;

/// OAuth server state - manages the running HTTP server
static OAUTH_SERVER: Mutex<Option<OAuthServerHandle>> = Mutex::new(None);

struct OAuthServerHandle {
    port: u16,
    shutdown_sender: std::sync::mpsc::Sender<()>,
}

/// Start an ephemeral HTTP server for OAuth loopback
/// Returns the port number it's listening on
#[tauri::command]
pub async fn start_oauth_loopback(app: AppHandle) -> Result<u16, String> {
    // Find an available port
    let listener = TcpListener::bind("127.0.0.1:0")
        .map_err(|e| format!("Failed to bind to localhost: {}", e))?;
    
    let port = listener.local_addr()
        .map_err(|e| format!("Failed to get local address: {}", e))?
        .port();
    
    app_log!("[OAuth] Starting loopback server on port {}", port);
    
    // Create shutdown channel
    let (shutdown_tx, shutdown_rx) = std::sync::mpsc::channel();
    
    // Store the handle
    {
        let mut server = OAUTH_SERVER.lock().unwrap();
        *server = Some(OAuthServerHandle {
            port,
            shutdown_sender: shutdown_tx,
        });
    }
    
    // Spawn server thread
    thread::spawn(move || {
        handle_oauth_server(listener, app, shutdown_rx);
    });
    
    Ok(port)
}

/// Stop the OAuth loopback server
#[tauri::command]
pub async fn stop_oauth_loopback() -> Result<(), String> {
    let mut server = OAUTH_SERVER.lock().unwrap();
    
    if let Some(handle) = server.take() {
        app_log!("[OAuth] Stopping loopback server on port {}", handle.port);
        let _ = handle.shutdown_sender.send(());
    }
    
    Ok(())
}

/// Handle incoming OAuth requests
fn handle_oauth_server(
    listener: TcpListener,
    app: AppHandle,
    shutdown_rx: std::sync::mpsc::Receiver<()>,
) {
    // Set non-blocking mode so we can check for shutdown
    listener.set_nonblocking(true)
        .expect("Cannot set non-blocking");
    
    loop {
        // Check for shutdown signal
        if shutdown_rx.try_recv().is_ok() {
            app_log!("[OAuth] Server received shutdown signal");
            break;
        }
        
        // Accept incoming connections
        match listener.accept() {
            Ok((stream, addr)) => {
                app_log!("[OAuth] Connection from {}", addr);
                handle_oauth_request(stream, &app);
                
                // After handling one request, shut down automatically
                app_log!("[OAuth] Request handled, shutting down server");
                break;
            }
            Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                // No connection ready, sleep briefly and check again
                thread::sleep(std::time::Duration::from_millis(100));
                continue;
            }
            Err(e) => {
                app_log!("[OAuth] Error accepting connection: {}", e);
                break;
            }
        }
    }
    
    app_log!("[OAuth] Server thread exiting");
}

/// Handle a single OAuth callback request
fn handle_oauth_request(mut stream: TcpStream, app: &AppHandle) {
    let mut buffer = [0; 4096];
    
    match stream.read(&mut buffer) {
        Ok(size) => {
            let request = String::from_utf8_lossy(&buffer[..size]);
            app_log!("[OAuth] Received request:\n{}", request);
            
            // Parse the request line
            let first_line = request.lines().next().unwrap_or("");
            let parts: Vec<&str> = first_line.split_whitespace().collect();
            
            if parts.len() >= 2 {
                let path = parts[1];
                
                // Check if it's the OAuth callback
                if path.starts_with("/oauth2/callback") {
                    // Parse query parameters
                    if let Some(query_start) = path.find('?') {
                        let query = &path[query_start + 1..];
                        let params = parse_query_string(query);
                        
                        app_log!("[OAuth] Parsed params: {:?}", params);
                        
                        // Check for OAuth error
                        if let Some(error) = params.get("error") {
                            let error_desc = params.get("error_description")
                                .map(|s| s.as_str())
                                .unwrap_or("Unknown error");
                            
                            app_log!("[OAuth] Error: {} - {}", error, error_desc);
                            
                            // Emit error event
                            let _ = app.emit("oauth-error", serde_json::json!({
                                "error": error,
                                "error_description": error_desc,
                            }));
                            
                            // Send error response
                            send_response(&mut stream, "OAuth Error", 
                                &format!("<h1>OAuth Error</h1><p>{}</p><p>You can close this window.</p>", error_desc));
                        } else if let Some(code) = params.get("code") {
                            // Success! Emit the authorization code
                            app_log!("[OAuth] Got authorization code: {}...", &code[..code.len().min(20)]);
                            
                            let _ = app.emit("oauth-callback", serde_json::json!({
                                "code": code,
                                "state": params.get("state"),
                            }));
                            
                            // Send success response
                            send_response(&mut stream, "Sign In Successful", 
                                "<h1>✓ Sign In Successful</h1><p>You can close this window and return to the app.</p>");
                        } else {
                            app_log!("[OAuth] No code or error in callback");
                            send_response(&mut stream, "Invalid Request", 
                                "<h1>Invalid OAuth Callback</h1><p>Missing authorization code.</p>");
                        }
                    } else {
                        send_response(&mut stream, "Invalid Request", 
                            "<h1>Invalid OAuth Callback</h1><p>Missing query parameters.</p>");
                    }
                } else {
                    // Not the OAuth callback path
                    send_response(&mut stream, "Not Found", 
                        "<h1>404 Not Found</h1><p>OAuth callback should be at /oauth2/callback</p>");
                }
            }
        }
        Err(e) => {
            app_log!("[OAuth] Error reading request: {}", e);
        }
    }
}

/// Parse URL query string into a HashMap
fn parse_query_string(query: &str) -> HashMap<String, String> {
    query
        .split('&')
        .filter_map(|pair| {
            let mut parts = pair.splitn(2, '=');
            let key = parts.next()?;
            let value = parts.next()?;
            
            // URL decode
            let key = urlencoding::decode(key).ok()?.into_owned();
            let value = urlencoding::decode(value).ok()?.into_owned();
            
            Some((key, value))
        })
        .collect()
}

/// Send an HTML response to the browser
fn send_response(stream: &mut TcpStream, title: &str, body: &str) {
    let html = format!(
        r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{}</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }}
        .container {{
            text-align: center;
            background: rgba(255, 255, 255, 0.1);
            padding: 3rem;
            border-radius: 1rem;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }}
        h1 {{
            margin: 0 0 1rem 0;
            font-size: 2rem;
        }}
        p {{
            margin: 0;
            font-size: 1.1rem;
            opacity: 0.9;
        }}
    </style>
</head>
<body>
    <div class="container">
        {}
    </div>
    <script>
        // Auto-close after 2 seconds
        setTimeout(() => {{
            window.close();
        }}, 2000);
    </script>
</body>
</html>"#,
        title, body
    );
    
    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\n\r\n{}",
        html.len(),
        html
    );
    
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();
}
