use std::env;
use std::fs;
use std::path::PathBuf;

fn main() {
    // Standard Tauri build
    tauri_build::build();

    // Load .env.local at build time and set as compile-time env vars
    // This ensures Windows builds have the config baked in
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let env_local = manifest_dir.parent().unwrap().join(".env.local");

    if env_local.exists() {
        println!("cargo:rerun-if-changed=../.env.local");
        
        if let Ok(content) = fs::read_to_string(&env_local) {
            for line in content.lines() {
                let line = line.trim();
                
                // Skip comments and empty lines
                if line.is_empty() || line.starts_with('#') {
                    continue;
                }
                
                // Parse KEY=VALUE
                if let Some((key, value)) = line.split_once('=') {
                    let key = key.trim();
                    let value = value.trim();
                    
                    // Only set VITE_ prefixed vars for the app
                    if key.starts_with("VITE_") {
                        // Remove quotes if present
                        let value = value.trim_matches('"').trim_matches('\'');
                        println!("cargo:rustc-env={}={}", key, value);
                        println!("cargo:warning=Bundled env var: {}", key);
                    }
                }
            }
        }
    } else {
        println!("cargo:warning=.env.local not found at build time, will use runtime loading");
    }
}
