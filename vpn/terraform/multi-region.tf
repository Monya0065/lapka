# Multi-Region Deployment
terraform {
  required_version = ">= 1.0"
  
  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.0"
    }
  }
}

locals {
  regions = {
    ams = { name = "Amsterdam", country = "NL", priority = 1 }
    nyc = { name = "New York", country = "US", priority = 2 }
    sgp = { name = "Singapore", country = "SG", priority = 3 }
    fra = { name = "Frankfurt", country = "DE", priority = 4 }
    lon = { name = "London", country = "GB", priority = 5 }
  }
}

# Primary region (Amsterdam)
resource "digitalocean_kubernetes_cluster" "primary" {
  name   = "vpn-primary"
  region = "ams3"
  version = "1.28.4-do.0"
  
  node_pool {
    name       = "primary-pool"
    size       = "s-4vcpu-8gb"
    node_count = 5
    
    labels = {
      role   = "primary"
      region = "ams"
    }
  }
  
  tags = ["vpn", "primary"]
}

# Secondary regions
resource "digitalocean_kubernetes_cluster" "secondary" {
  for_each = { for k, v in local.regions : k => v if k != "ams" }
  
  name   = "vpn-${each.key}"
  region = each.key == "nyc" ? "nyc3" : each.key == "sgp" ? "sgp1" : each.key == "fra" ? "fra1" : "lon1"
  version = "1.28.4-do.0"
  
  node_pool {
    name       = "secondary-pool"
    size       = "s-2vcpu-4gb"
    node_count = 2
    
    labels = {
      role   = "secondary"
      region = each.key
    }
  }
  
  tags = ["vpn", "secondary", each.key]
}

# Primary database
resource "digitalocean_database_cluster" "primary_db" {
  name       = "vpn-primary-db"
  engine    = "pg"
  version   = "16"
  size      = "db-s-4vcpu-8gb"
  region    = "ams3"
  node_count = 3
  
  tags = ["vpn", "database", "primary"]
}

# Read replicas in each region
resource "digitalocean_database_cluster" "read_replica" {
  for_each = { for k, v in local.regions : k => v if k != "ams" }
  
  name       = "vpn-read-${each.key}"
  engine    = "pg"
  version   = "16"
  size      = "db-s-2vcpu-4gb"
  region    = each.key == "nyc" ? "nyc3" : each.key == "sgp" ? "sgp1" : each.key == "fra" ? "fra1" : "lon1"
  primary_cluster = digitalocean_database_cluster.primary_db.id
  
  tags = ["vpn", "database", "replica", each.key]
}

# Global Load Balancer
resource "digitalocean_loadbalancer" "global" {
  name   = "vpn-global-lb"
  region = "ams3"
  
  forwarding_rule {
    entry_port     = 443
    entry_protocol = "https"
    target_port  = 443
    target_protocol = "https"
    tls_protocol = "http"
  }
  
  forwarding_rule {
    entry_port     = 80
    entry_protocol = "http"
    target_port  = 80
    target_protocol = "http"
  }
  
  healthcheck {
    protocol = "tcp"
    port     = 443
  }
  
  dns_name = "vpn-global"
  
  tags = ["vpn", "global"]
}

# DNS Failover records
resource "cloudflare_record" "primary" {
  zone_id = var.cloudflare_zone_id
  name   = "api"
  value  = digitalocean_loadbalancer.global.ip
  type   = "A"
  proxied = true
  
  failover {
    type = "primary"
  }
}

resource "cloudflare_record" "secondary" {
  for_each = { for k, v in local.regions : k => v if k != "ams" }
  
  zone_id = var.cloudflare_zone_id
  name   = "api-${each.key}"
  value  = "0.0.0.0"
  type   = "A"
  proxied = false
  
  failover {
    type = "secondary"
  }
}

output "primary_cluster" {
  value = digitalocean_kubernetes_cluster.primary.id
}

output "global_lb_ip" {
  value = digitalocean_loadbalancer.global.ip
}