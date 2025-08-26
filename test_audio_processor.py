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
BASE_URL = "https://pcl-labs-cgjr4doid-pcl-labs.vercel.app"
API_BASE = f"{BASE_URL}/api/audio_processor"

def test_health_check():
    """Test the health check endpoint"""
    print("🔍 Testing health check...")
    
    try:
        response = requests.get(API_BASE)
        response.raise_for_status()
        
        data = response.json()
        print(f"✅ Health check passed: {data['status']}")
        print(f"   Service: {data['service']}")
        print(f"   Version: {data['version']}")
        print(f"   R2 Configured: {data['r2_configured']}")
        print(f"   Note: {data['note']}")
        
        return data['r2_configured']
        
    except Exception as e:
        print(f"❌ Health check failed: {e}")
        return False

def get_latest_clip():
    """Get the latest clip from R2 storage"""
    print("\n🔍 Getting latest clip from R2 storage...")
    
    try:
        response = requests.get(f"{API_BASE}/latest")
        response.raise_for_status()
        
        data = response.json()
        
        if data.get('success'):
            latest_clip = data['latest_clip']
            print(f"✅ Found latest clip: {latest_clip['clip_id']}")
            print(f"   File: {latest_clip['key']}")
            print(f"   Size: {latest_clip['size']} bytes")
            print(f"   Uploaded: {latest_clip['uploaded']}")
            return latest_clip['clip_id']
        else:
            print(f"❌ No clips found: {data['message']}")
            return None
            
    except Exception as e:
        print(f"❌ Failed to get latest clip: {e}")
        return None

def list_all_clips():
    """List all clips in R2 storage"""
    print("\n🔍 Listing all clips in R2 storage...")
    
    try:
        response = requests.get(f"{API_BASE}/clips")
        response.raise_for_status()
        
        data = response.json()
        
        if data.get('success'):
            clips = data['clips']
            print(f"✅ Found {data['total_clips']} clips:")
            
            for i, clip in enumerate(clips[:5], 1):  # Show first 5 clips
                print(f"   {i}. {clip['clip_id']} ({clip['size']} bytes)")
            
            if len(clips) > 5:
                print(f"   ... and {len(clips) - 5} more")
            
            return clips
        else:
            print(f"❌ Failed to list clips: {data.get('message', 'Unknown error')}")
            return []
            
    except Exception as e:
        print(f"❌ Failed to list clips: {e}")
        return []

def test_audio_processing(clip_id):
    """Test audio processing with the given clip ID"""
    print(f"\n🎵 Testing audio processing with clip: {clip_id}")
    
    payload = {
        "clip_ids": [clip_id],
        "background": False
    }
    
    try:
        print("   Sending processing request...")
        response = requests.post(
            API_BASE,
            headers={'Content-Type': 'application/json'},
            data=json.dumps(payload)
        )
        response.raise_for_status()
        
        data = response.json()
        
        if data.get('success'):
            print(f"✅ Processing successful: {data['message']}")
            
            results = data.get('results', {})
            print(f"   Total: {results.get('total', 0)}")
            print(f"   Successful: {results.get('successful', 0)}")
            print(f"   Failed: {results.get('failed', 0)}")
            
            # Show detailed results
            for result in results.get('results', []):
                if result.get('success'):
                    clip_info = result.get('clip_info', {})
                    print(f"   ✅ {result['clip_id']}: {result.get('note', 'Processed successfully')}")
                    if clip_info.get('file_path'):
                        print(f"      File: {clip_info['file_path']}")
                else:
                    print(f"   ❌ {result['clip_id']}: {result.get('error', 'Unknown error')}")
        else:
            print(f"❌ Processing failed: {data['message']}")
            
    except Exception as e:
        print(f"❌ Processing request failed: {e}")

def main():
    """Main test function"""
    print("🚀 Starting Audio Processor API Test")
    print("=" * 50)
    
    # Test health check first
    r2_configured = test_health_check()
    
    if not r2_configured:
        print("\n⚠️  R2 storage is not configured. Cannot test with real clips.")
        print("   Please configure the following environment variables:")
        print("   - CLOUDFLARE_ACCOUNT_ID")
        print("   - CLOUDFLARE_ZONE_ID") 
        print("   - CLOUDFLARE_API_TOKEN")
        print("   - R2_BUCKET")
        return
    
    # List all clips
    clips = list_all_clips()
    
    if not clips:
        print("\n⚠️  No clips found in R2 storage.")
        print("   Please upload some clips first before testing.")
        return
    
    # Get latest clip
    latest_clip_id = get_latest_clip()
    
    if not latest_clip_id:
        print("\n⚠️  Could not retrieve latest clip.")
        return
    
    # Test audio processing with the latest clip
    test_audio_processing(latest_clip_id)
    
    print("\n" + "=" * 50)
    print("✅ Test completed!")

if __name__ == "__main__":
    main()
