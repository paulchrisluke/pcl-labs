import { Environment } from './types/index.js';

// Declare fetch as available globally (Cloudflare Workers environment)
declare const fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

// Helper function to get real service status from Cloudflare workers
async function getServiceStatus(env: Environment) {
  const now = new Date();
  const formatDate = (date: Date) => date.toLocaleString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit',
    timeZoneName: 'short'
  });

  type ServiceStatus = {
    status: 'online' | 'offline';
    lastTested: string;
    error: string;
  };

  // Production worker URL
  const productionUrl = 'https://clip-recap-pipeline.paulchrisluke.workers.dev';

  // Test Twitch integration against production worker
  let twitchStatus: ServiceStatus = { status: 'offline', lastTested: formatDate(now), error: 'Test failed' };
  try {
    const response = await fetch(`${productionUrl}/validate-twitch`);
    if (response.ok) {
      const result = await response.json() as { success?: boolean; error?: string };
      if (result.success) {
        twitchStatus = { status: 'online', lastTested: formatDate(now), error: '' };
      } else {
        twitchStatus = { status: 'offline', lastTested: formatDate(now), error: result.error || 'Validation failed' };
      }
    } else {
      twitchStatus = { status: 'offline', lastTested: formatDate(now), error: `HTTP ${response.status}` };
    }
  } catch (error) {
    twitchStatus = { status: 'offline', lastTested: formatDate(now), error: 'Connection failed' };
  }

  // Test GitHub integration against production worker
  let githubStatus: ServiceStatus = { status: 'offline', lastTested: formatDate(now), error: 'Test failed' };
  try {
    const response = await fetch(`${productionUrl}/validate-github`);
    if (response.ok) {
      const result = await response.json() as { success?: boolean; error?: string };
      if (result.success) {
        githubStatus = { status: 'online', lastTested: formatDate(now), error: '' };
      } else {
        githubStatus = { status: 'offline', lastTested: formatDate(now), error: result.error || 'Validation failed' };
      }
    } else {
      githubStatus = { status: 'offline', lastTested: formatDate(now), error: `HTTP ${response.status}` };
    }
  } catch (error) {
    githubStatus = { status: 'offline', lastTested: formatDate(now), error: 'Connection failed' };
  }

  // Test AI processing (Workers AI binding)
  let aiStatus: ServiceStatus = { status: 'offline', lastTested: formatDate(now), error: 'Not available' };
  try {
    // Simple test to check if AI binding is available
    if (env.ai) {
      aiStatus = { status: 'online', lastTested: formatDate(now), error: '' };
    }
  } catch (error) {
    aiStatus = { status: 'offline', lastTested: formatDate(now), error: 'Binding not available' };
  }

  // Test Cloud Storage (R2 binding)
  let storageStatus: ServiceStatus = { status: 'offline', lastTested: formatDate(now), error: 'Not available' };
  try {
    // Simple test to check if R2 binding is available
    if (env.R2_BUCKET) {
      storageStatus = { status: 'online', lastTested: formatDate(now), error: '' };
    }
  } catch (error) {
    storageStatus = { status: 'offline', lastTested: formatDate(now), error: 'Binding not available' };
  }

  return {
    twitch: twitchStatus,
    github: githubStatus,
    ai: aiStatus,
    storage: storageStatus
  };
}

export async function generateStatusPage(env: Environment): Promise<string> {
  const statusData = await getServiceStatus(env);
  
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
                <div class="stat-number">24/7</div>
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
                <p>Workers AI for transcription and content generation</p>
                <div class="status-details">
                    <span class="last-tested">Last tested: ${statusData.ai.lastTested}</span>
                    ${statusData.ai.status === 'offline' ? `<span class="error-message">${statusData.ai.error}</span>` : ''}
                </div>
            </div>
            <div class="status-card">
                <h3><span class="status-indicator ${statusData.storage.status === 'online' ? 'status-online' : 'status-offline'}"></span>Cloud Storage</h3>
                <p>R2 storage for clips and transcripts</p>
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
