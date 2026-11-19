# Visitor Photo Slideshow

Visitors scan a QR code or open a link, enter their name, tick a consent box and upload photos.
The photos appear within moments on a shared display (smart TV or computer browser).
Returning visitors are recognised automatically, and their earlier photos play again after the new ones.

**Deployed link:** <!-- TODO: URL, or "not deployed, run locally" -->

## Tech stack
Node.js 18+, Express, SQLite (better-sqlite3), Multer (uploads), sharp (image re-encoding),
helmet + express-rate-limit (hardening), Server-Sent Events (live updates),
plain HTML/JS front end, Jest + Supertest (tests).
Reasons for each choice are in [ARCHITECTURE.md](ARCHITECTURE.md).

## Setup
```bash
git clone <your-repo-url>
cd visitor-slideshow
npm install
cp .env.example .env      # then set ADMIN_PASSWORD to something real
npm start
```

## Use it
| Who | URL |
|---|---|
| Visitors (phones) | `http://<server-address>:3000/` |
| Display (TV browser, full screen) | `http://<server-address>:3000/display.html` |

On a local network use your computer's LAN IP, not `localhost`, so phones can reach it.

## Configuration (`.env`)
| Variable | Meaning | Default |
|---|---|---|
| `PORT` | Server port | 3000 |
| `DB_PATH` | SQLite file | ./data.db |
| `UPLOAD_DIR` | Where photos are stored | ./uploads |
| `MAX_FILE_SIZE_MB` | Per-photo size limit | 5 |
| `SLIDE_DURATION_SECONDS` | How long each photo is shown | 10 |
| `ADMIN_PASSWORD` | Enables admin removal (disabled if unset or `change-me`) | none |
| `TRUST_PROXY` | Set to `1` behind a reverse proxy | empty |
| `UPLOAD_RATE_LIMIT` | Uploads per IP per 10 minutes | 60 |

## Tests
```bash
npm test
```
Manual test plan and results: [docs/TEST_PLAN.md](docs/TEST_PLAN.md)

## Privacy summary
Consent is required (checked on the server) and recorded with a timestamp. Uploads are re-encoded,
which strips EXIF/GPS data. Visitors can delete single photos or erase everything about themselves.
An admin can remove any photo. Full details are in ASSUMPTIONS.md.

## Admin
```bash
curl -H "x-admin-password: YOUR_PASSWORD" http://localhost:3000/api/admin/photos
curl -X DELETE -H "x-admin-password: YOUR_PASSWORD" http://localhost:3000/api/admin/photos/<id>
```

## Documents
ASSUMPTIONS.md · ARCHITECTURE.md · AI_LOG.md · docs/TEST_PLAN.md