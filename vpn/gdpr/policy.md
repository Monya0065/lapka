# GDPR Compliance for Lapka VPN

## Data Processing

### Personal Data Collected
| Data Type | Purpose | Legal Basis | Retention |
|----------|---------|------------|-----------|
| Email | Account creation | Consent | Until account deletion |
| Name | Account creation | Consent | Until account deletion |
| Payment data | Subscription | Contract | 7 years (legal) |
| IP addresses | Security | Legitimate interest | 1 year |
| Usage logs | Service delivery | Contract | 2 years |
| Device info | Service delivery | Until deletion |

### Data Subject Rights

#### Right to Access (Article 15)
Users can request all personal data via `/api/user/data-export`

#### Right to Erasure (Article 17)
Users can delete account via `/api/user/delete` 
- All personal data deleted within 30 days
- Backup deletion within 90 days

#### Right to Rectification (Article 16)
Users can update profile via `/api/user/profile`

#### Data Portability (Article 20)
Users can export data in JSON format

## Consent Management

```
POST /api/consent
{
  "consent_type": "marketing",
  "granted": true,
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## Data Protection Measures

### Encryption
- **At rest**: AES-256 for all databases
- **In transit**: TLS 1.3 required
- **Backups**: Encrypted with separate key

### Access Control
- Role-based access (RBAC)
- Two-factor authentication for admin
- Audit logging for all data access

### Incident Response
1. Detect breach within 24 hours
2. Notify DPA within 72 hours
3. Affected users notified within 7 days

## Data Processing Agreement

We use only GDPR-compliant subprocessors:
- DigitalOcean (hosting)
- YooKassa (payments)
- SendGrid (email)
- Cloudflare (CDN)

## Contact

Data Protection Officer: dpo@lapka.ru
Complaints: gdpr@lapka.ru