---
"@ledgerhq/device-management-kit": patch
---

Use audited Exodus bytes for Base64 and hex conversion instead of handwritten
conversion and runtime fallback code. Preserve Base64 whitespace and padding-bit
tolerance, odd-length hex padding, and null results for invalid encoded input.
