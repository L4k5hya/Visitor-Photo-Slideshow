# Test Plan – Visitor Photo Slideshow

## 1. Introduction

This document describes the testing strategy for the Visitor Photo Slideshow application. The purpose is to verify that the application's main features work correctly and that security and privacy requirements are followed.

Testing includes manual functional testing and automated testing using Jest and Supertest.

## 2. Testing Objectives

- Verify that visitors can upload photos successfully.
- Check that invalid files are rejected.
- Verify visitor recognition using visitor tokens.
- Check photo deletion functionality.
- Verify that uploaded images are processed securely.
- Test slideshow updates and reconnection behaviour.
- Verify administrator operations.
- Check application security and privacy protections.

## 3. Testing Environment

| Component | Technology |
|---|---|
| Operating System | Windows |
| Runtime | Node.js |
| Backend | Express.js |
| Database | SQLite |
| Frontend | HTML, CSS, JavaScript |
| Testing Framework | Jest |
| HTTP Testing | Supertest |
| Image Processing | Sharp |
| Browser | Chrome |

## 4. Manual Test Cases

The following test cases should be executed manually.

| Test ID | Test Scenario | Test Steps | Expected Result |
|---|---|---|---|
| TC-01 | Open visitor page | Open the application homepage in a browser. | Visitor upload page loads successfully. |
| TC-02 | Open slideshow page | Visit `/display.html`. | Slideshow display page loads successfully. |
| TC-03 | Upload valid photo | Enter a visitor name, provide consent, select a valid JPEG image, and upload it. | Photo uploads successfully. |
| TC-04 | Upload multiple photos | Select multiple valid images within the configured limits and upload them. | All valid selected photos are uploaded successfully. |
| TC-05 | Upload without visitor name | Leave the visitor name empty and attempt an upload. | Application rejects the request with a validation message. |
| TC-06 | Upload without consent | Select an image without accepting the consent requirement. | Application prevents the upload. |
| TC-07 | Upload unsupported file | Try uploading an unsupported file type. | Application rejects the file. |
| TC-08 | Upload oversized file | Attempt to upload a file exceeding the configured size limit. | Application rejects the oversized file. |
| TC-09 | Returning visitor | Upload a photo, refresh the page, and upload again using the saved visitor token. | Application recognizes the returning visitor. |
| TC-10 | Delete individual photo | Open the visitor's photo list and delete one uploaded photo. | Selected photo is removed. |
| TC-11 | Delete all visitor photos | Use the delete-all option for the current visitor. | All photos belonging to that visitor are removed. |
| TC-12 | Administrator authentication | Send an administrator request with an incorrect password. | Request is rejected. |
| TC-13 | Administrator photo removal | Authenticate as administrator and remove a photo. | Selected photo is removed. |
| TC-14 | Slideshow updates | Keep the slideshow open and upload a new photo from another browser or device. | Slideshow receives and displays the new photo. |
| TC-15 | Image metadata removal | Upload a JPEG containing EXIF metadata and inspect the processed image. | Original EXIF metadata, including GPS information, is not retained. |

## 5. Automated Testing

Automated tests are implemented using Jest and Supertest.

Run the following command from the project root:

```bash
npm test
```

The automated tests cover areas such as:

- Application health endpoint.
- Security headers and Content Security Policy.
- Visitor privacy functionality.
- Photo upload validation.
- Photo deletion.
- Slideshow functionality.
- Invalid and corrupted image handling.

## 6. Test Results

Record the actual result after executing each test.

| Test ID | Actual Result | Status |
|---|---|---|
| TC-01 | __________________ | Pass / Fail |
| TC-02 | __________________ | Pass / Fail |
| TC-03 | __________________ | Pass / Fail |
| TC-04 | __________________ | Pass / Fail |
| TC-05 | __________________ | Pass / Fail |
| TC-06 | __________________ | Pass / Fail |
| TC-07 | __________________ | Pass / Fail |
| TC-08 | __________________ | Pass / Fail |
| TC-09 | __________________ | Pass / Fail |
| TC-10 | __________________ | Pass / Fail |
| TC-11 | __________________ | Pass / Fail |
| TC-12 | __________________ | Pass / Fail |
| TC-13 | __________________ | Pass / Fail |
| TC-14 | __________________ | Pass / Fail |
| TC-15 | __________________ | Pass / Fail |

## 7. Security Testing

The following security checks are included:

1. Validate uploaded file types and sizes.
2. Reject invalid or corrupted image files.
3. Check that security headers are configured.
4. Verify that inline JavaScript is not used where blocked by the Content Security Policy.
5. Verify that visitor tokens are not stored as plain-text database values.
6. Verify that visitors cannot delete another visitor's photos using their own token.
7. Verify that administrator routes require authentication.
8. Verify that image metadata is removed during processing.

## 8. Conclusion

The test plan covers the major functional, security, and privacy requirements of the Visitor Photo Slideshow application.

Manual and automated testing help verify application behaviour, identify errors, and improve the reliability and security of the system.