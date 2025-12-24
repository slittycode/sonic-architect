## 2024-05-23 - Missing File Input Validation
**Vulnerability:** The application accepts any file upload without validation on size or type.
**Learning:** Even client-side apps need input validation to prevent browser crashes (DoS) and API abuse.
**Prevention:** Always validate `file.size` and `file.type` before processing or sending to an API.
