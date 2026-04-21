# Vault Secret Management
terraform {
  required_version = ">= 1.0"
  
  required_providers {
    vault = {
      source = "hashicorp/vault"
      version = "~> 3.0"
    }
  }
}

provider "vault" {
  address = "https://vault.lapka.ru:8200"
  
  auth_method {
    type = "token"
    token = var.vault_token
  }
}

# KV Secrets Engine v2
resource "vault_kv_secret_v2" "vpn_secrets" {
  mount = "secret"
  name  = "vpn/production"
  
  data = {
    database-url     = var.database_url
    redis-url     = var.redis_url
    jwt-secret   = var.jwt_secret
    yookassa-shop-id    = var.yookassa_shop_id
    yookassa-secret-key = var.yookassa_secret_key
    telegram-bot-token = var.telegram_bot_token
  }
}

# Policy for API service
resource "vault_policy" "vpn_api" {
  name = "vpn-api"
  
  policy = <<-POLICY
    path "secret/data/vpn/production" {
      capabilities = ["read"]
    }
    POLICY
}

# Approle for Kubernetes
resource "vault_approle_auth_backend_role" "k8s_vpn_api" {
  backend          = "approle"
  role_name        = "vpn-api"
  token_policies  = ["vpn-api"]
  
  bind_secret_id = true
  token_ttl = 3600
  token_max_ttl = 86400
  
  secret_id_bound_cidrs = [
    "10.0.0.0/8",
  ]
}