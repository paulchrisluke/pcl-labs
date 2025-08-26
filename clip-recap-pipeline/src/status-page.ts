import type { Environment } from './types/index.js';
import { calculateUptime } from './utils/uptime.js';

// Declare fetch as available globally (Cloudflare Workers environment)
declare const fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type ServiceStatus = {
  status: 'online' | 'offline';
  lastTested: string;
  error: string;
};

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return date.toLocaleString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit',
    timeZoneName: 'short'
  });
}

/**
 * Helper function to validate service endpoints
 */
async function validateServiceEndpoint(endpoint: string, serviceName: string, now: Date): Promise<ServiceStatus> {
  let status: ServiceStatus = { status: 'offline', lastTested: formatDate(now), error: 'Test failed' };
  
  // Create AbortController with 5 second timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  
  try {
    const response = await fetch(endpoint, {
      signal: controller.signal
    });
    
    // Clear timeout since fetch completed
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const result = await response.json() as { success?: boolean; error?: string };
      if (result.success) {
        status = { status: 'online', lastTested: formatDate(now), error: '' };
      } else {
        status = { status: 'offline', lastTested: formatDate(now), error: result.error || 'Validation failed' };
      }
    } else {
      status = { status: 'offline', lastTested: formatDate(now), error: `HTTP ${response.status}` };
    }
  } catch (error) {
    // Clear timeout in case of error
    clearTimeout(timeoutId);
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        status = { status: 'offline', lastTested: formatDate(now), error: 'Timeout after 5s' };
      } else {
        status = { status: 'offline', lastTested: formatDate(now), error: error.message };
      }
    } else {
      status = { status: 'offline', lastTested: formatDate(now), error: 'Connection failed' };
    }
  }
  
  return status;
}

/**
 * Helper function to check binding availability
 */
function checkBindingStatus(binding: unknown, now: Date): ServiceStatus {
  try {
    if (binding) {
      return { status: 'online', lastTested: formatDate(now), error: '' };
    } else {
      return { status: 'offline', lastTested: formatDate(now), error: 'Not available' };
    }
  } catch {
    return { status: 'offline', lastTested: formatDate(now), error: 'Binding not available' };
  }
}

// Helper function to get real service status from Cloudflare workers
async function getServiceStatus(env: Environment, baseUrl?: string) {
  const now = new Date();

  // Use provided baseUrl or default to production worker URL
  const serviceUrl = baseUrl || 'https://clip-recap-pipeline.paulchrisluke.workers.dev';

  // Test Twitch integration against the service URL
  const twitchStatus = await validateServiceEndpoint(
    `${serviceUrl}/validate-twitch`,
    'Twitch',
    now
  );

  // Test GitHub integration against the service URL
  const githubStatus = await validateServiceEndpoint(
    `${serviceUrl}/validate-github`,
    'GitHub',
    now
  );

  // Test AI processing (Workers AI binding)
  const aiStatus = checkBindingStatus(env.ai, now);

  // Test Cloud Storage (R2 binding)
  const storageStatus = checkBindingStatus(env.R2_BUCKET, now);

  return {
    twitch: twitchStatus,
    github: githubStatus,
    ai: aiStatus,
    storage: storageStatus
  };
}

export async function generateStatusPage(env: Environment, baseUrl?: string): Promise<string> {
  const statusData = await getServiceStatus(env, baseUrl);
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Twitch Clip Recap Pipeline - API Status</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #333;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }
        
        .header {
            text-align: center;
            margin-bottom: 3rem;
            color: white;
        }
        
        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
            font-weight: 700;
        }
        
        .header p {
            font-size: 1.2rem;
            opacity: 0.9;
        }
        
        .status-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1.5rem;
            margin-bottom: 3rem;
        }
        
        .status-card {
            background: white;
            border-radius: 12px;
            padding: 1.5rem;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            transition: transform 0.2s ease;
        }
        
        .status-card:hover {
            transform: translateY(-2px);
        }
        
        .status-card h3 {
            color: #667eea;
            margin-bottom: 1rem;
            font-size: 1.3rem;
        }
        
        .status-indicator {
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-right: 0.5rem;
        }
        
        .status-online {
            background: #10b981;
        }
        
        .status-offline {
            background: #ef4444;
        }
        
        .status-details {
            margin-top: 0.5rem;
            font-size: 0.875rem;
            color: #6b7280;
        }
        
        .last-tested {
            display: block;
            margin-bottom: 0.25rem;
        }
        
        .error-message {
            display: block;
            color: #ef4444;
            font-weight: 500;
        }
        
        .endpoints {
            background: white;
            border-radius: 12px;
            padding: 2rem;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        .endpoints h2 {
            color: #667eea;
            margin-bottom: 1.5rem;
            font-size: 1.8rem;
        }
        
        .endpoint {
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            margin-bottom: 1rem;
            overflow: hidden;
        }
        
        .endpoint-header {
            background: #f9fafb;
            padding: 1rem;
            border-bottom: 1px solid #e5e7eb;
            display: flex;
            align-items: center;
            gap: 1rem;
        }
        
        .method {
            padding: 0.25rem 0.75rem;
            border-radius: 4px;
            font-weight: 600;
            font-size: 0.875rem;
        }
        
        .method.get { background: #dbeafe; color: #1d4ed8; }
        .method.post { background: #dcfce7; color: #15803d; }
        .method.put { background: #fef3c7; color: #d97706; }
        
        .endpoint-path {
            font-family: 'Monaco', 'Menlo', monospace;
            font-weight: 600;
        }
        
        .endpoint-description {
            padding: 1rem;
            color: #6b7280;
        }
        
        .footer {
            text-align: center;
            margin-top: 3rem;
            color: white;
            opacity: 0.8;
        }
        
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin-bottom: 2rem;
        }
        
        .stat-card {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            padding: 1.5rem;
            text-align: center;
            color: white;
        }
        
        .stat-number {
            font-size: 2rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
        }
        
        .stat-label {
            opacity: 0.9;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎬 Twitch Clip Recap Pipeline</h1>
            <p>Automated daily blog post generation from Twitch clips</p>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <div class="stat-number">7</div>
                <div class="stat-label">API Endpoints</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${calculateUptime()}</div>
                <div class="stat-label">Uptime</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">AI</div>
                <div class="stat-label">Powered</div>
            </div>
        </div>
        
        <div class="status-grid">
            <div class="status-card">
                <h3><span class="status-indicator ${statusData.twitch.status === 'online' ? 'status-online' : 'status-offline'}"></span>Twitch Integration</h3>
                <p>Connected to Twitch API for clip fetching and processing</p>
                <div class="status-details">
                    <span class="last-tested">Last tested: ${statusData.twitch.lastTested}</span>
                    ${statusData.twitch.status === 'offline' ? `<span class="error-message">${statusData.twitch.error}</span>` : ''}
                </div>
            </div>
            <div class="status-card">
                <h3><span class="status-indicator ${statusData.github.status === 'online' ? 'status-online' : 'status-offline'}"></span>GitHub Integration</h3>
                <p>Connected to GitHub for content repository management</p>
                <div class="status-details">
                    <span class="last-tested">Last tested: ${statusData.github.lastTested}</span>
                    ${statusData.github.status === 'offline' ? `<span class="error-message">${statusData.github.error}</span>` : ''}
                </div>
            </div>
            <div class="status-card">
                <h3><span class="status-indicator ${statusData.ai.status === 'online' ? 'status-online' : 'status-offline'}"></span>AI Processing</h3>
                <p>Workers AI for content generation</p>
                <div class="status-details">
                    <span class="last-tested">Last tested: ${statusData.ai.lastTested}</span>
                    ${statusData.ai.status === 'offline' ? `<span class="error-message">${statusData.ai.error}</span>` : ''}
                </div>
            </div>
            <div class="status-card">
                <h3><span class="status-indicator ${statusData.storage.status === 'online' ? 'status-online' : 'status-offline'}"></span>Cloud Storage</h3>
                <p>R2 storage for clips</p>
                <div class="status-details">
                    <span class="last-tested">Last tested: ${statusData.storage.lastTested}</span>
                    ${statusData.storage.status === 'offline' ? `<span class="error-message">${statusData.storage.error}</span>` : ''}
                </div>
            </div>
        </div>
        
        <div class="endpoints">
            <h2>📡 API Endpoints</h2>
            
            <div class="endpoint">
                <div class="endpoint-header">
                    <span class="method get">GET</span>
                    <span class="endpoint-path">/health</span>
                </div>
                <div class="endpoint-description">
                    Health check endpoint to verify service status
                </div>
            </div>
            
            <div class="endpoint">
                <div class="endpoint-header">
                    <span class="method get">GET</span>
                    <span class="endpoint-path">/validate-twitch</span>
                </div>
                <div class="endpoint-description">
                    Validate Twitch API credentials and connection
                </div>
            </div>
            
            <div class="endpoint">
                <div class="endpoint-header">
                    <span class="method get">GET</span>
                    <span class="endpoint-path">/validate-github</span>
                </div>
                <div class="endpoint-description">
                    Validate GitHub API credentials and repository access
                </div>
            </div>
            
            <div class="endpoint">
                <div class="endpoint-header">
                    <span class="method get">GET</span>
                    <span class="endpoint-path">/api/github/activity</span>
                </div>
                <div class="endpoint-description">
                    Get daily GitHub activity and repository statistics
                </div>
            </div>
            
            <div class="endpoint">
                <div class="endpoint-header">
                    <span class="method get">GET</span>
                    <span class="endpoint-path">/api/twitch/clips</span>
                </div>
                <div class="endpoint-description">
                    Fetch recent Twitch clips from the last 24 hours
                </div>
            </div>
            
            <div class="endpoint">
                <div class="endpoint-header">
                    <span class="method post">POST</span>
                    <span class="endpoint-path">/api/twitch/clips</span>
                </div>
                <div class="endpoint-description">
                    Store clips data to R2 storage
                </div>
            </div>
            
            <div class="endpoint">
                <div class="endpoint-header">
                    <span class="method get">GET</span>
                    <span class="endpoint-path">/api/twitch/clips/stored</span>
                </div>
                <div class="endpoint-description">
                    List all stored clips from R2 storage
                </div>
            </div>
            
            <div class="endpoint">
                <div class="endpoint-header">
                    <span class="method post">POST</span>
                    <span class="endpoint-path">/webhook/github</span>
                </div>
                <div class="endpoint-description">
                    GitHub webhook handler for repository events
                </div>
            </div>
        </div>
        
        <div class="footer">
            <p>Built with Cloudflare Workers • AI-Powered Content Generation</p>
        </div>
    </div>
</body>
</html>`;
}
