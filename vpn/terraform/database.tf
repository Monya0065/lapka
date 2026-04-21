# Terraform configuration for PostgreSQL Sharded Cluster
# For 20M users

terraform {
  required_version = ">= 1.0"
  
  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.0"
    }
  }
}

variable "do_token" {
  description = "DigitalOcean API Token"
  type        = string
  sensitive   = true
}

variable "region" {
  default = "ams3"
}

# ============================================================================
# VPC Network
# ============================================================================

resource "digitalocean_vpc" "vpn_network" {
  name   = "vpn-database-network"
  region = var.region
  
  ip_range = "10.0.0.0/16"
}

# ============================================================================
# PostgreSQL Shards (4 nodes for 20M users)
# ============================================================================

resource "digitalocean_database_cluster" "postgres_shard" {
  count       = 4
  name        = "vpn-shard-${count.index + 1}"
  engine      = "pg"
  version     = "16"
  size        = "db-s-4vcpu-8gb"  # $80/month
  region      = var.region
  node_count  = 3  # Primary + 2 replicas
  private_network_uuid = digitalocean_vpc.vpn_network.id
  
  maintain_window_day  = "sunday"
  maintain_window_hour = 3
  
  tags = ["vpn", "database", "shard-${count.index + 1}"]
}

# Database user
resource "digitalocean_database_user" "vpn_user" {
  count  = 4
  name  = "vpn"
  cluster_id = digitalocean_database_cluster.postgres_shard[count.index].id
}

# Database
resource "digitalocean_database_db" "vpn_db" {
  count      = 4
  name      = "vpn"
  cluster_id = digitalocean_database_cluster.postgres_shard[count.index].id
}

# Firewall for PostgreSQL
resource "digitalocean_database_firewall" "postgres_firewall" {
  count = 4
  cluster_id = digitalocean_database_cluster.postgres_shard[count.index].id
  
  rule {
    type  = "ip_addr"
    value = digitalocean_vpc.vpn_network.ip_range
  }
}

# ============================================================================
# Redis Cluster (6 nodes)
# ============================================================================

resource "digitalocean_database_cluster" "redis" {
  name       = "vpn-redis"
  engine     = "redis"
  version    = "7"
  size       = "db-s-2vcpu-4gb"  # $40/month
  region     = var.region
  node_count = 6
  private_network_uuid = digitalocean_vpc.vpn_network.id
  
  redis_maxmemory_policy = "allkeys-lru"
  
  tags = ["vpn", "redis"]
}

resource "digitalocean_database_user" "redis_user" {
  name  = "vpn"
  cluster_id = digitalocean_database_cluster.redis.id
}

resource "digitalocean_database_db" "redis_db" {
  name      = "vpn"
  cluster_id = digitalocean_database_cluster.redis.id
}

# ============================================================================
# Outputs
# ============================================================================

output "postgres_shards" {
  value = {
    for i in range(4) :
    i => {
      host     = digitalocean_database_cluster.postgres_shard[i].host
      port     = digitalocean_database_cluster.postgres_shard[i].port
      uri      = digitalocean_database_cluster.postgres_shard[i].uri
      user     = digitalocean_database_user.vpn_user[i].name
      password = digitalocean_database_user.vpn_user[i].password
    }
  }
}

output "redis_cluster" {
  value = {
    host     = digitalocean_database_cluster.redis.host
    port     = digitalocean_database_cluster.redis.port
    uri      = digitalocean_database_cluster.redis.uri
    user     = digitalocean_database_user.redis_user[0].name
    password = digitalocean_database_user.redis_user[0].password
  }
}

output "connection_string" {
  value = "postgresql://vpn:${digitalocean_database_user.vpn_user[0].password}@${digitalocean_database_cluster.postgres_shard[0].host}:${digitalocean_database_cluster.postgres_shard[0].port}/vpn"
  sensitive = true
}
