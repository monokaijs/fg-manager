use std::sync::atomic::{AtomicU64, Ordering};
use tokio::sync::Mutex;
use std::time::{Instant, Duration};

pub struct GlobalRateLimiter {
    pub limit_kbps: AtomicU64,
    pub tokens: Mutex<f64>,
    pub last_update: Mutex<Instant>,
}

impl GlobalRateLimiter {
    pub fn new() -> Self {
        Self {
            limit_kbps: AtomicU64::new(0),
            tokens: Mutex::new(0.0),
            last_update: Mutex::new(Instant::now()),
        }
    }

    pub async fn wait_for_bytes(&self, bytes: u64) {
        let limit_kbps = self.limit_kbps.load(Ordering::Relaxed);
        if limit_kbps == 0 { return; }
        
        let limit_bps = (limit_kbps * 1024) as f64;
        
        let wait_dur = {
            let mut last_update = self.last_update.lock().await;
            let mut tokens = self.tokens.lock().await;
            
            let now = Instant::now();
            let elapsed = now.duration_since(*last_update).as_secs_f64();
            *last_update = now;
            
            *tokens += elapsed * limit_bps;
            
            // Allow a tiny burst budget, capped at 1 second of limit_bps
            if *tokens > limit_bps {
                *tokens = limit_bps;
            }
            
            *tokens -= bytes as f64;
            
            if *tokens < 0.0 {
                let debt_bytes = -*tokens;
                let required_time = debt_bytes / limit_bps;
                Duration::from_secs_f64(required_time)
            } else {
                Duration::ZERO
            }
        };
        
        if wait_dur > Duration::ZERO {
            tokio::time::sleep(wait_dur).await;
        }
    }
}
