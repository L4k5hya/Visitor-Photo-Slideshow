# Assumptions and Limitations

This document describes the assumptions, design decisions, and limitations considered while developing the Visitor Photo Slideshow application.

## 1. Product Assumptions

| Requirement Gap | Decision Made | Reason |
|---|---|---|
| Photo display duration was not specified | One global duration configured through `SLIDE_DURATION_SECONDS`, defaulting to 10 seconds | Keeps the slideshow simple and configurable |
| Multiple visitors upload simultaneously | Photos are added to a First-In, First-Out (FIFO) queue | Prevents incoming photos from overlapping |
| Returning visitor uploads new photos | New photos are displayed first, followed by earlier photos | Allows new uploads to appear immediately while retaining earlier visitor photos |
| Display has no photos | Show a waiting message | Provides feedback when the slideshow is idle |
| Display reloads while photos are queued | Pending slides in browser memory are lost | The slideshow queue is maintained in the browser rather than persisted |
| Upload happens while display is closed | The upload is saved, but its live slideshow event is not replayed automatically | Keeps the real-time display implementation simple |
| Maximum photo size and count | JPEG, PNG and WebP; maximum 5 files per upload and 5 MB per photo | Controls storage and memory usage |
| Large images | Images are resized to a maximum dimension of 1920 pixels | Reduces storage requirements while maintaining display quality |
| HEIC images | HEIC is not supported | The application currently accepts JPEG, PNG and WebP formats |

## 2. Returning Visitor Recognition

- Returning visitors are identified using a randomly generated token.
- The token is stored in the visitor's browser using localStorage.
- Only the SHA-256 hash of the token is stored in the database.
- Visitor names are display labels and are not used as unique identifiers.

### Limitations

- A visitor using a different device or browser will be treated as a new visitor.
- Clearing browser storage removes the saved visitor token.
- There is no email or PIN-based account recovery.
- The "Not you?" option allows another person using the same device to start a new visitor session.
- An invalid or expired token with a newly supplied name creates a new visitor record.

## 3. Privacy and Consent

- Visitors must accept the consent checkbox before uploading photos.
- Consent is also validated on the server.
- The consent timestamp is stored with each photo.
- Visitors confirm that other people appearing in their uploaded photos agree to public display.
- The application does not independently verify the identity of people appearing in photos.

### Photo Privacy

- Photos appear on the display after a successful upload.
- There is no manual approval process before displaying photos.
- Visitors can delete individual photos.
- Visitors can also delete all their photos and their visitor record.
- An administrator can remove uploaded photos.
- Image re-encoding removes EXIF metadata, including GPS information.
- The ICC colour profile is not retained, which may slightly change wide-gamut colours.
- Animated WebP images are converted into still images.

### Data Retention

There is currently no automatic photo-retention period.

**Organiser responsibility:** The event organiser should periodically review stored photos and remove data that is no longer required.

## 4. Security Assumptions

- The administrator uses a shared password for administrative operations.
- The admin password is supplied through an HTTP request header.
- HTTPS should be used when deploying the application publicly.
- Content Security Policy restricts JavaScript execution to permitted sources.
- Inline styles are permitted by the current CSP configuration.
- Uploads are restricted by file count, size, type and image validation.
- Random filenames help prevent filename collisions and guessing.
- Rate limiting helps reduce repeated abusive requests.

### Security Limitations

- Rate-limit information is stored in memory and resets when the server restarts.
- Multiple server instances do not share rate-limit information.
- Visitors sharing the same public IP address may share an upload rate limit.
- The display page and Server-Sent Events endpoint do not require visitor authentication.
- Anyone with access to the display URL can view live slideshow updates.

## 5. Deployment Assumptions

- The application is designed for a single-server deployment.
- SQLite database storage must remain persistent.
- The uploads directory must remain persistent.
- The application requires Node.js and its installed dependencies.
- When deployed behind a reverse proxy, the `TRUST_PROXY` setting must be configured appropriately.
- A publicly accessible deployment should use HTTPS.

## 6. Future Improvements

The following features could be considered in future versions:

1. HEIC image support.
2. Automatic photo deletion after a configurable retention period.
3. Persistent slideshow queues so pending photos survive display reloads.
4. Admin dashboard with authentication.
5. Photo moderation before public display.
6. Improved support for multiple server instances.
7. Visitor account recovery using email or PIN.
8. Better monitoring and logging for production deployments.