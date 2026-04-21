# CI/CD Workflow Variables and Secrets
# Add these as GitHub Secrets (NOT as plain variables)

# Required Secrets (GitHub -> Settings -> Secrets)
secrets:
  # AWS
  AWS_ACCESS_KEY_ID: "AKIA..."           # For S3 backups, ECR
  AWS_SECRET_ACCESS_KEY: "..."
  
  # Kubernetes
  KUBECONFIG: |
    apiVersion: v1
    kind: Config
    ...
  
  # Container Registry
  GHCR_TOKEN: "ghp_..."                    # GitHub Packages token
  
  # Cloud
  CLOUDFLARE_TOKEN: "..."                 # For DNS
  DIGITALOCEAN_TOKEN: "..."               # For Terraform
  
  # Monitoring
  PAGERDUTY_KEY: "..."                   # For alerts
  SLACK_WEBHOOK: "https://hooks.slack.com/..."
  
  # External Services
  VAULT_TOKEN: "..."                      # For secrets
  YOOKASSA_SHOP_ID: "..."
  YOOKASSA_SECRET_KEY: "..."
  TELEGRAM_BOT_TOKEN: "..."
  FCM_API_KEY: "..."                      # Firebase Cloud Messaging
  APPLE_P8_KEY: "..."                     # Apple Push

# Protected Variables (can use in workflows, not secrets)
variables:
  AWS_REGION: "eu-central-1"
  DOCKER_REGISTRY: "ghcr.io/lapka"
  HELM_CHART_VERSION: "1.0.0"
  
  PRODUCTION_URL: "https://api.lapka.ru"
  STAGING_URL: "https://api-staging.lapka.ru"
  
  # Feature flags
  ENABLE_TELEGRAM: "true"
  ENABLE_SOCIAL_LOGIN: "true"
  ENABLE_2FA: "true"
  
  # Monitoring
  PROMETHEUS_RETENTION: "30d"
  LOG_RETENTION: "90d"