# Clip Validation Examples

This document demonstrates the validation and sanitization features implemented for the clip-recap-pipeline.

## POST /clips Endpoint Validation

### Request Size Limits
- **Maximum request body size**: 10MB
- **Maximum clips per request**: 100 clips
- **HTTP 413** returned for oversized requests
- **HTTP 400** returned for too many clips

### Clip Object Validation

#### Valid Clip Example
```json
{
  "clips": [
    {
      "id": "ValidClip123",
      "title": "Amazing Gaming Moment",
      "description": "Check out this incredible play!",
      "tags": ["gaming", "highlight"],
      "category": "Gaming",
      "language": "en",
      "is_public": true,
      "duration": 30,
      "view_count": 1500
    }
  ]
}
```

#### Invalid Examples and Error Responses

**1. Missing ID**
```json
{
  "clips": [
    {
      "title": "Missing ID"
    }
  ]
}
```
Response: `"Invalid clip at index 0: Validation errors: Field 'id' is required"`

**2. Invalid ID Format**
```json
{
  "clips": [
    {
      "id": "invalid/id/with/slashes",
      "title": "Invalid ID"
    }
  ]
}
```
Response: `"Invalid clip at index 0: Validation errors: Field 'id' contains invalid characters"`

**3. Forbidden Fields**
```json
{
  "clips": [
    {
      "id": "ValidClip123",
      "_id": "trying-to-override",
      "owner": "malicious-user"
    }
  ]
}
```
Response: `"Invalid clip at index 0: Field '_id' is not allowed to be modified"`

**4. XSS Attempt**
```json
{
  "clips": [
    {
      "id": "ValidClip123",
      "title": "<script>alert('xss')</script>",
      "description": "&lt;img src=x onerror=alert(1)&gt;"
    }
  ]
}
```
Response: Success, but title is sanitized to: `"Amazing Gaming Moment"`

**5. Duplicate IDs**
```json
{
  "clips": [
    {
      "id": "Duplicate123",
      "title": "First clip"
    },
    {
      "id": "Duplicate123",
      "title": "Second clip"
    }
  ]
}
```
Response: `"Duplicate clip ID found: Duplicate123"`

**6. Too Many Clips**
```json
{
  "clips": [
    // ... 101 clip objects
  ]
}
```
Response: `"Too many clips. Maximum 100 clips per request."`

## PUT /clips Endpoint Validation

### Valid Update Example
```json
{
  "clipId": "ValidClip123",
  "data": {
    "title": "Updated Title",
    "description": "Updated description",
    "tags": ["updated", "tags"]
  }
}
```

### Invalid Update Examples

**1. Forbidden Fields**
```json
{
  "clipId": "ValidClip123",
  "data": {
    "id": "trying-to-change-id",
    "created_at": "2024-01-01"
  }
}
```
Response: `"Field 'id' is not allowed to be modified"`

**2. Invalid Data Types**
```json
{
  "clipId": "ValidClip123",
  "data": {
    "title": 123,
    "tags": "not-an-array"
  }
}
```
Response: `"Validation errors: Field 'title' must be a string, Field 'tags' must be an array"`

## Validation Features

### Security Measures
- **Path traversal prevention**: Clip IDs validated against dangerous characters
- **XSS prevention**: HTML tags and dangerous characters removed from strings
- **Field whitelisting**: Only allowed fields can be modified
- **Type validation**: Strict type checking for all fields
- **Length limits**: Prevents oversized data

### Sanitization
- HTML tags removed: `<script>alert('xss')</script>` → `alert('xss')`
- Dangerous characters removed: `<>"'&` → ``
- Control characters removed: `\x00-\x1F\x7F`
- Whitespace trimmed: `"  hello  "` → `"hello"`

### Allowed Fields for Clips
- `id` (required, string, max 50 chars)
- `title` (string, max 200 chars)
- `description` (string, max 1000 chars)
- `tags` (array, max 20 items)
- `category` (string, max 100 chars)
- `language` (string, max 10 chars)
- `is_public` (boolean)
- `custom_metadata` (object)
- Twitch-specific fields: `url`, `embed_url`, `thumbnail_url`, `duration`, `view_count`, `created_at`, `broadcaster_name`, `creator_name`

### Forbidden Fields (System-managed)
- `_id`, `owner`, `updated_at`, `broadcaster_id`, `creator_id`
