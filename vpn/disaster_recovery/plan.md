# Lapka VPN - Disaster Recovery Plan

## RTO / RPO Targets

| Component | RTO | RPO |
|----------|-----|-----|
| API | 15 min | 1 hour |
| Database | 30 min | 1 hour |
| VPN Nodes | 1 hour | 24 hours |
| Monitoring | 1 hour | 24 hours |

## Backup Strategy

### Database
- **Frequency**: Hourly + Daily + Weekly
- **Retention**: 7 days (hourly), 30 days (daily), 1 year (weekly)
- **Storage**: S3 with cross-region replication
- **Testing**: Monthly restore test

### Redis
- **Frequency**: Every 5 minutes
- **Type**: RDB snapshots + AOF
- **Storage**: S3

### Configuration
- **Frequency**: On every change (GitOps)
- **Storage**: Git repository with encrypted secrets

## Recovery Procedures

### 1. Database Recovery
```bash
# Stop API
kubectl scale deployment vpn-api --replicas=0 -n vpn-production

# Restore from backup
aws s3 cp s3://lapka-vpn-backups/postgres/latest.sql.gz .
gunzip latest.sql.gz | psql -h postgres -U vpn -d vpn

# Start API
kubectl scale deployment vpn-api --replicas=10 -n vpn-production
```

### 2. Full Region Recovery
```bash
# Deploy to fallback region
kubectl config use-context fallback-region

# Update DNS
aws route53 change-resource-record-sets --hosted-zone-id ZONE_ID --change-batch file://dns-failover.json

# Verify
./verify.sh
```

### 3. VPN Nodes Recovery
```bash
# Recreate nodes from Terraform
terraform apply -var-file=production.tfvars

# Update DNS for new nodes
./update-dns.sh
```

## Failover Scenarios

### Database Failure
1. Detect failure (Prometheus alert)
2. Promote replica to primary
3. Update connection string
4. Verify application

### Region Failure
1. Detect failure (health check)
2. Activate DNS failover
3. Scale up API in fallback region
4. Verify VPN nodes

### Complete Outage
1. Activate DR region
2. Update all DNS records
3. Scale all components
4. Verify functionality

## Testing

- **Monthly**: Full DR drill
- **Weekly**: Database restore test
- **Daily**: Backup verification

## Contacts

| Role | Name | Phone | Email |
|------|------|-------|-------|
| On-Call | | | oncall@lapka.ru |
| DBA | | | dba@lapka.ru |
| DevOps | | | devops@lapka.ru |