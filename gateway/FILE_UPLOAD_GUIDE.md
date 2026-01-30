# File Attachment System

This document describes the file attachment system implemented in the gateway server.

## Overview

The file attachment system allows users to upload files to research sessions. These files are stored in a session-specific directory structure and can be attached to ChatGPT research sessions.

## Directory Structure

Each session has the following directory structure:

```
sessions/
└── {sessionId}/
    ├── uploads/              # User-uploaded files
    │   ├── file1.pdf
    │   └── file2.txt
    ├── reports/              # Generated reports
    │   ├── detailed-report.md
    │   └── chatgpt-final-report.md
    ├── metadata.json         # Session metadata
    └── final_report.md       # Final research report
```

## API Endpoints

### POST /api/sessions/:id/files

Upload files to a session.

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Field name: `files` (array)
- Max file size: 50MB per file

**Example:**
```bash
curl -X POST http://localhost:3001/api/sessions/{sessionId}/files \
  -F "files=@document1.pdf" \
  -F "files=@document2.txt"
```

**Response:**
```json
{
  "success": true,
  "files": [
    {
      "originalName": "document1.pdf",
      "filename": "document1.pdf",
      "size": 1234567,
      "mimetype": "application/pdf",
      "path": "/path/to/sessions/{sessionId}/uploads/document1.pdf"
    }
  ]
}
```

### GET /api/sessions/:id/files

List all uploaded files for a session.

**Request:**
- Method: `GET`

**Example:**
```bash
curl http://localhost:3001/api/sessions/{sessionId}/files
```

**Response:**
```json
{
  "files": [
    {
      "filename": "document1.pdf",
      "path": "/path/to/sessions/{sessionId}/uploads/document1.pdf"
    }
  ]
}
```

## Implementation Details

### Multer Configuration

File uploads are handled using [multer](https://github.com/expressjs/multer) middleware:

```typescript
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const sessionId = req.params.id;
    const uploadDir = join(sessionsDir, sessionId, 'uploads');
    mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname); // Keep original filename
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});
```

### Session Manager Methods

The `SessionManager` class provides helper methods for file management:

#### listSessionFiles(sessionId: string): string[]

Returns an array of filenames in the session's uploads directory.

#### getSessionFilePaths(sessionId: string): string[]

Returns an array of absolute file paths for all uploaded files.

#### saveSessionReport(sessionId: string, reportType: 'detailed' | 'chatgpt', content: string): void

Saves a generated report to the session's reports directory.

### Playwright Integration

Files can be attached to ChatGPT sessions via the Playwright controller:

```typescript
// In PlaywrightController
async attachFiles(filePaths: string[]): Promise<void> {
  const fileInput = await this.page.locator('input[type="file"]');
  await fileInput.setInputFiles(filePaths);
}

// Called during session start
async startResearch(topic: string, maxRounds: number, files?: string[]): Promise<void> {
  if (files && files.length > 0) {
    await this.attachFiles(files);
  }
  // ... continue with research
}
```

## Usage Flow

1. **Create Session**: Client creates a new research session
2. **Upload Files**: Client uploads files to the session using POST /api/sessions/:id/files
3. **Start Research**: The session automatically attaches uploaded files to ChatGPT
4. **Monitor Progress**: Client monitors progress via GET /api/sessions/:id/progress
5. **Download Reports**: Client downloads generated reports from the reports directory

## Security Considerations

- **File Size Limit**: 50MB per file to prevent disk space exhaustion
- **File Type Validation**: Currently not implemented - consider adding validation based on requirements
- **Path Traversal**: Prevented by using `path.join()` and session-specific directories
- **Disk Space**: No automatic cleanup - consider implementing retention policies

## Error Handling

The system handles common error scenarios:

- **Session Not Found**: Returns 404 if session doesn't exist
- **No Files Uploaded**: Returns 400 if no files are provided
- **File Size Exceeded**: Multer automatically rejects files over 50MB
- **Disk Space**: Standard file system errors are caught and logged

## Future Enhancements

1. **File Type Validation**: Add whitelist/blacklist for file types
2. **Virus Scanning**: Integration with antivirus tools
3. **File Compression**: Automatic compression for large files
4. **Retention Policy**: Automatic cleanup of old session files
5. **Cloud Storage**: Integration with S3 or similar services
6. **Progress Tracking**: Upload progress for large files
7. **File Metadata**: Store additional metadata (upload time, user, etc.)
