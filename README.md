# Work Permit Hub – PTW Control System

A full-stack Permit-to-Work (PTW) management system for managing workplace permits, approvals, work activities, audit history, and role-based access.

## 🚀 Live Application

https://hasan-tech-26-work-permit-hub.tallyard-ptw.workers.dev

## 📌 Overview

Work Permit Hub digitizes the Permit-to-Work process for a CMMS-style environment.

The application provides a shared permit model with dynamic permit-type fields, role-based approval workflows, lifecycle controls, work logging, audit history, and database-level workflow protection.

## ✨ Key Features

- Secure email/password authentication
- Role-Based Access Control (RBAC)
- PostgreSQL database with Supabase
- Row-Level Security (RLS)
- Shared permit entity with dynamic permit-type fields
- Permit Register with filtering
- Permit creation and detail views
- Multi-step approval workflow
- Server/database-level lifecycle validation
- Self-approval prevention
- Area-based approval permissions
- Work activity logging
- Immutable audit history
- Permit expiry handling
- Dashboard and statistics
- Closure verification
- Responsive interface

## 👥 User Roles

### Requester
- Creates permits
- Submits permits for approval
- Tracks permit status
- Cannot approve their own permit

### Area Owner
- Reviews permits for assigned areas
- Approves applicable permits for their area
- Cannot approve their own permit

### Safety Officer
- Performs safety approval
- Can suspend active permits
- Verifies permit closure

### Admin
- Administrative access
- Can manage the complete permit workflow

## 🔄 Permit Lifecycle

```text
DRAFT
  ↓
PENDING_APPROVAL
  ↓
APPROVED
  ↓
ACTIVE
  ├──→ SUSPENDED ──→ ACTIVE
  ├──→ CLOSED ──→ CLOSED_VERIFIED
  ├──→ CANCELLED
  └──→ EXPIRED

PENDING_APPROVAL ──→ REJECTED

## 🎥 Demo Video

[Watch the Work Permit Hub demo](https://www.loom.com/share/e859b7ab08064f7dac6c267662850219)