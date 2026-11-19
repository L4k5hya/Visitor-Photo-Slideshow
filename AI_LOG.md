# AI Development Log

## 1. Introduction

AI tools were used during the development of the Visitor Photo Slideshow project for understanding requirements, planning the application architecture, generating code suggestions, debugging errors, improving security, and preparing documentation.

AI-generated suggestions were reviewed and tested before being included in the project.

## 2. AI Tools Used

- ChatGPT: Technical explanations, code suggestions, debugging assistance, testing guidance, and documentation.
- Other AI tools: Add any other tools actually used during development.

## 3. Development Log

### Entry 1: Project Architecture and Technology Selection

- **Prompt / Interaction:** Asked AI to help plan the Visitor Photo Slideshow application and select an appropriate technology stack.
- **What the AI produced:** Suggested Node.js, Express, SQLite, Multer, Sharp, and plain HTML, CSS, and JavaScript.
- **Was it wrong?** No major issue identified.
- **How I noticed:** Reviewed the proposed architecture against the project requirements.
- **What I changed:** Used the suggested technologies as the foundation of the project.
- **What I learned:** Selecting technologies according to project requirements helps keep development manageable.

### Entry 2: Image Validation and Test Data

- **Prompt / Interaction:** Asked AI to help create image upload validation and automated tests.
- **What the AI produced:** Initially suggested test images that used image signatures but did not contain complete valid image data.
- **Was it wrong?** Yes, the original test fixtures were insufficient for testing complete image decoding.
- **How I noticed:** Stricter image processing using Sharp exposed problems with the fake image fixtures.
- **What I changed:** Replaced fake image data with real generated JPEG, PNG, and WebP images and added tests for corrupted image content.
- **What I learned:** Test data must represent realistic inputs, especially when testing file processing and validation.

### Entry 3: Returning Visitor Recognition

- **Prompt / Interaction:** Asked AI how to recognize visitors when they upload photos again.
- **What the AI produced:** Suggested generating a random visitor token, storing it in localStorage, and keeping only its hash in the database.
- **Was it wrong?** No major issue identified.
- **How I noticed:** Tested the upload API with a new visitor and then uploaded again using the saved visitor token.
- **What I changed:** Implemented token-based visitor recognition.
- **What I learned:** Random tokens can identify returning visitors without requiring traditional account registration.

### Entry 4: Content Security Policy and External JavaScript

- **Prompt / Interaction:** Asked AI to help resolve a failing security test that checked for inline JavaScript.
- **What the AI produced:** Suggested moving inline JavaScript into external JavaScript files.
- **Was it wrong?** The initial guidance was incomplete because the actual HTML file still contained inline JavaScript, and the static file URL also needed to match the Express configuration.
- **How I noticed:** The hardening test continued to fail and showed the inline script in the returned HTML.
- **What I changed:** Separated frontend JavaScript into external files and checked the correct static paths.
- **What I learned:** Security tests must verify the actual HTML served by the application, not just the intended source changes.

### Entry 5: Static File Path Configuration

- **Prompt / Interaction:** Asked AI how to reference frontend JavaScript files served by Express.
- **What the AI produced:** Initially gave ambiguous guidance about using `/public/` in browser URLs.
- **Was it wrong?** Yes, the URL did not match the application's `express.static('public')` configuration.
- **How I noticed:** Compared the actual project folder structure with the Express static middleware configuration.
- **What I changed:** Used URLs such as `/display.js` and `/upload.js` for files inside the public folder.
- **What I learned:** Express static middleware exposes files relative to the configured static directory.

### Entry 6: Automated Testing and Debugging

- **Prompt / Interaction:** Asked AI to help interpret Jest and Supertest output when automated tests failed.
- **What the AI produced:** Explained test failures and suggested checking the relevant application code rather than removing security tests.
- **Was it wrong?** No major issue identified.
- **How I noticed:** Compared the suggested changes with the actual test output.
- **What I changed:** Used test failures to identify and correct application issues.
- **What I learned:** Automated tests help identify problems early and make debugging more systematic.

## 4. Overall Learning

Using AI tools helped accelerate development and improve understanding of backend development, image processing, database operations, security, and automated testing.

However, AI-generated code was not treated as automatically correct. Suggestions were reviewed, tested, and modified when necessary.

The development process demonstrated the importance of understanding the code, checking assumptions, and using automated tests to verify application behaviour.