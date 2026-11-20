# Security Specification — Thread Calculation Firestore

## 1. Data Invariants
1. Every `/workspaces/{workspaceId}` document must belong to a verified authenticated user (`ownerId == request.auth.uid` and `request.auth.token.email_verified == true`).
2. Every `/workspaces/{workspaceId}/projectRows/{rowId}` and `/workspaces/{workspaceId}/wireInspections/{inspectionId}` document must belong to an existing parent `/workspaces/{workspaceId}` owned by `request.auth.uid`.
3. `ownerId`, `workspaceId`, and `createdAt` are immutable after creation.
4. All server timestamps (`createdAt`, `updatedAt`, `inspectedAt`) must equal `request.time`.
5. No unbounded strings or maps; every string has explicit `.size()` bounds and IDs match `^[a-zA-Z0-9_-]+$`.
6. `wireInspections` are immutable QC audit records (`allow update: if false`).

## 2. "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Workspace Read/Write**: `request.auth == null` attempting to read or write `/workspaces/ws1`.
2. **Unverified Email Spoof**: `request.auth != null` with `email_verified: false` attempting to create `/workspaces/ws1`.
3. **Owner Hijack (Identity Spoofing)**: Authenticated user `userA` creating `/workspaces/ws1` with `ownerId: "userB"`.
4. **Ghost / Shadow Field Injection**: Creating `/workspaces/ws1` with valid required fields plus `"isAdmin": true`.
5. **Client Timestamp Forgery**: Creating `/workspaces/ws1` with `createdAt` set to a past date instead of `request.time`.
6. **Oversized ID Poisoning**: Creating `/workspaces/` + 200-char string or invalid characters (`ws/../../evil`).
7. **Oversized String DoS**: Updating `projectName` with a 5,000-character string (> 200 max).
8. **Orphaned Subcollection Write**: Creating `/workspaces/nonexistent/projectRows/row1` when parent workspace does not exist.
9. **Cross-Tenant Subcollection Access**: `userB` attempting to create/read/list `/workspaces/ws_userA/projectRows/row1`.
10. **Immutable Field Mutation**: Updating `ownerId` or `createdAt` on an existing `/workspaces/ws1` or `/workspaces/ws1/projectRows/row1`.
11. **QC Log Tampering**: Attempting to `update` an existing `/workspaces/ws1/wireInspections/qc1` record.
12. **Blanket Unfiltered List Query**: `userB` listing `/workspaces` without `where('ownerId', '==', 'userB')`.
