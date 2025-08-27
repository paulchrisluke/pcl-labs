#!/usr/bin/env python3
"""
Test script for the Audio Processor API that uses the latest clip from R2 storage
instead of hardcoded test IDs.
"""

import requests
import json
import time
import sys

# Configuration
BASE_URL = "http://localhost:8000"
API_BASE = BASE_URL

def test_health_check():
    """Test the health check endpoint"""
    print("\n🔍 Testing health check...")
    
    try:
        response = requests.get(f"{API_BASE}/health")
        response.raise_for_status()
        
        data = response.json()
        print(f"✅ Health check passed: {data.get('status', 'unknown')}")
        print(f"   FFmpeg Available: {data.get('ffmpeg_available', 'Unknown')}")
        print(f"   R2 Configured: {data.get('r2_configured', 'Unknown')}")
        print(f"   Cache Healthy: {data.get('cache_healthy', 'Unknown')}")
        print(f"   Cache Type: {data.get('cache_type', 'Unknown')}")
        
        return True
    except Exception as e:
        print(f"❌ Health check failed: {e}")
        return False

def list_all_clips():
    """List all clips from Cloudflare Worker API"""
    print("\n🔍 Listing all clips from Cloudflare Worker API...")
    
    try:
        # Get clips from your Cloudflare Worker API
        response = requests.get("https://clip-recap-pipeline.paulchrisluke.workers.dev/api/twitch/clips/stored")
        response.raise_for_status()
        
        data = response.json()
        
        if data.get('success') and data.get('clips'):
            clips = data['clips']
            print(f"✅ Found {len(clips)} clips:")
            
            for i, clip in enumerate(clips, 1):
                video_exists = clip.get('video_file', {}).get('exists', False)
                status = "✅" if video_exists else "❌"
                clip_id = clip.get('id', 'unknown')
                title = clip.get('title', 'Untitled')
                duration = clip.get('duration', 0)
                print(f"   {i}. {status} {clip_id} - {title} ({duration}s)")
            
            return [clip['id'] for clip in clips if 'id' in clip]
        else:
            print(f"❌ No clips found: {data.get('message', 'Unknown error')}")
            return []
            
    except Exception as e:
        print(f"❌ Failed to list clips: {e}")
        return []

def process_all_clips(clip_ids):
    """Process all clips through the local audio processor"""
    print(f"\n🎵 Processing all {len(clip_ids)} clips through local audio processor...")
    
    try:
        # Process all clips at once
        response = requests.post(f"{API_BASE}/process-clips", json={
            "clip_ids": clip_ids,
            "background": False
        })
        response.raise_for_status()
        
        data = response.json()
        print(f"✅ Processing result: {data.get('message', 'Unknown')}")
        
        # Handle nested results structure
        results_data = data.get('results', {})
        if isinstance(results_data, dict):
            print(f"   Total: {results_data.get('total', 0)}")
            print(f"   Successful: {results_data.get('successful', 0)}")
            print(f"   Failed: {results_data.get('failed', 0)}")
            
            # Show detailed results
            for result in results_data.get('results', []):
                status = "✅" if result.get('success') else "❌"
                print(f"   {status} {result['clip_id']}: {result.get('error', 'Processed successfully')}")
                if result.get('files_uploaded'):
                    print(f"      Files: {', '.join(result['files_uploaded'])}")
        else:
            print(f"   Response: {data}")
        
        return True
    except Exception as e:
        print(f"❌ Failed to process clips: {e}")
        return False

def main():
    print("🚀 Starting Audio Processor API Test")
    print("=" * 50)
    
    # Test health check
    if not test_health_check():
        print("❌ Health check failed, aborting test")
        return
    
    # Get all clips
    clip_ids = list_all_clips()
    if not clip_ids:
        print("❌ No clips found, aborting test")
        return
    
    # Process all clips
    if not process_all_clips(clip_ids):
        print("❌ Failed to process clips")
        return
    
    print("\n" + "=" * 50)
    print("✅ Test completed!")

if __name__ == "__main__":
    main()
