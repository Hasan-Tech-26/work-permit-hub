# Work Permit Hub – PTW Control System

A full-stack Permit-to-Work (PTW) management system designed to digitize, manage, approve, and monitor workplace permit workflows.

## 📌 Overview

Work Permit Hub is a web-based Permit-to-Work management platform that replaces manual permit handling with a centralized digital workflow.

The system allows authorized users to create permits, submit them for approval, track permit status, manage work activities, maintain audit history, and control access based on user roles.

## ✨ Key Features

- 🔐 Secure authentication
- 👥 Role-Based Access Control (RBAC)
- 🛡️ PostgreSQL Row-Level Security (RLS)
- 📋 Permit creation and management
- 🔄 Permit lifecycle management
- ✅ Multi-role approval workflow
- 🚫 Unauthorized approval prevention
- 📝 Work activity logs
- 📜 Audit trail
- ⏱️ Permit expiry handling
- 📊 Dashboard and permit statistics
- 🔎 Permit register and tracking
- ⚙️ Application settings
- 📱 Responsive user interface

## 👤 User Roles

### Requester
- Creates work permits
- Submits permits for approval
- Tracks permit status
- Manages permitted work information

### Area Owner
- Reviews permits for assigned areas
- Approves or rejects applicable permits

### Safety Officer
- Reviews safety-related permit requirements
- Performs safety approval

### Admin
- Manages administrative operations
- Has elevated system privileges

## 🔄 Permit Workflow

```text
Create Permit
      ↓
Draft
      ↓
Submit for Approval
      ↓
Pending Approval
      ↓
Area / Safety / Admin Approval
      ↓
Approved
      ↓
Active
      ↓
Suspended / Closed / Cancelled
      ↓
Closed Verified