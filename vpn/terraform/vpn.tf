# Terraform configuration for VPN Nodes Infrastructure
# 500 nodes across 5 regions for 20M users

terraform {
  required_version = ">= 1.0"

  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

variable "do_token" {
  description = "DigitalOcean API Token"
  type        = string
  sensitive   = true
}

variable "cloudflare_token" {
  description = "Cloudflare API Token"
  type        = string
  sensitive   = true
}

variable "ssh_key_fingerprint" {
  description = "SSH key fingerprint for droplets"
  type        = string
}

# Regions for multi-region deployment
locals {
  regions = {
    ams = { name = "Amsterdam", country = "NL", latency_target = 50 }
    nyc = { name = "New York", country = "US", latency_target = 80 }
    sgp = { name = "Singapore", country = "SG", latency_target = 120 }
    fra = { name = "Frankfurt", country = "DE", latency_target = 60 }
    lon = { name = "London", country = "GB", latency_target = 40 }
  }
}

# ============================================================================
# VPC Network for VPN nodes
# ============================================================================

resource "digitalocean_vpc" "vpn_nodes" {
  name   = "vpn-nodes-network"
  region = "ams3"
  ip_range = "10.8.0.0/16"
}

# ============================================================================
# VPN Node Pools (100 nodes each region = 500 total)
# ============================================================================

resource "digitalocean_kubernetes_cluster" "vpn_nodes" {
  for_each = local.regions

  name       = "vpn-nodes-${each.key}"
  region     = each.key == "ams" ? "ams3" : each.key == "nyc" ? "nyc3" : each.key == "sgp" ? "sgp1" : each.key == "fra" ? "fra1" : "lon1"
  version    = "1.28.4-do.0"
  vpc_uuid   = digitalocean_vpc.vpn_nodes.id

  node_pool {
    name       = "vpn-pool"
    size       = "s-2vcpu-2gb"  # $10/month per node
    node_count = 100
    auto_scale = true
    min_nodes = 50
    max_nodes = 200

    labels = {
      role  = "vpn-node"
      region = each.key
    }

    taints {
      key    = "node-role"
      value  = "vpn"
      effect = "NoSchedule"
    }

    tags = ["vpn", "node", each.key]
  }

  tags = ["vpn", "nodes", each.key]
}

# ============================================================================
# Load Balancer for VPN
# ============================================================================

resource "digitalocean_loadbalancer" "vpn_lb" {
  for_each = local.regions

  name     = "vpn-lb-${each.key}"
  region   = each.key == "ams" ? "ams3" : each.key == "nyc" ? "nyc3" : each.key == "sgp" ? "sgp1" : each.key == "fra" ? "fra1" : "lon1"
  vpc_uuid = digitalocean_vpc.vpn_nodes.id

  forwarding_rule {
    entry_port     = 51820
    entry_protocol = "udp"
    target_port    = 51820
    target_protocol = "udp"
  }

  healthcheck {
    protocol = "udp"
    port     = 51820
  }

 droplet_tag = "vpn-node-${each.key}"

  tags = ["vpn", "lb", each.key]
}

# ============================================================================
# Firewall rules
# ============================================================================

resource "digitalocean_firewall" "vpn_nodes" {
  for_each = local.regions

  name = "vpn-nodes-${each.key}"
  tags = ["vpn", "nodes", each.key]

  inbound_rule {
    protocol         = "udp"
    port_range      = "51820"
    droplet_ids    = digitalocean_kubernetes_cluster.vpn_nodes[each.key].id
  }

  inbound_rule {
    protocol         = "tcp"
    port_range      = "22"
    sources {
      addresses = ["0.0.0.0/0"]
    }
  }

  outbound_rule {
    protocol          = "udp"
    port_range       = "51820"
    destinations {
      addresses = ["0.0.0.0/0"]
    }
  }

  outbound_rule {
    protocol          = "tcp"
    port_range       = "443"
    destinations {
      addresses = ["0.0.0.0/0"]
    }
  }
}

# ============================================================================
# Cloudflare DNS records
# ============================================================================

resource "cloudflare_record" "vpn_ams" {
  zone_id = var.cloudflare_zone_id
  name    = "ams.vpn.nodes"
  value   = digitalocean_loadbalancer.vpn_lb["ams"].ip
  type    = "A"
  proxied = true
}

resource "cloudflare_record" "vpn_nyc" {
  zone_id = var.cloudflare_zone_id
  name    = "nyc.vpn.nodes"
  value   = digitalocean_loadbalancer.vpn_lb["nyc"].ip
  type    = "A"
  proxied = true
}

resource "cloudflare_record" "vpn_sgp" {
  zone_id = var.cloudflare_zone_id
  name    = "sgp.vpn.nodes"
  value   = digitalocean_loadbalancer.vpn_lb["sgp"].ip
  type    = "A"
  proxied = true
}

resource "cloudflare_record" "vpn_fra" {
  zone_id = var.cloudflare_zone_id
  name    = "fra.vpn.nodes"
  value   = digitalocean_loadbalancer.vpn_lb["fra"].ip
  type    = "A"
  proxied = true
}

resource "cloudflare_record" "vpn_lon" {
  zone_id = var.cloudflare_zone_id
  name    = "lon.vpn.nodes"
  value   = digitalocean_loadbalancer.vpn_lb["lon"].ip
  type    = "A"
  proxied = true
}

# ============================================================================
# Outputs
# ============================================================================

output "vpn_clusters" {
  value = {
    for key, cluster in digitalocean_kubernetes_cluster.vpn_nodes :
    key => {
      id       = cluster.id
      endpoint = cluster.endpoint
      version  = cluster.version
    }
  }
}

output "load_balancers" {
  value = {
    for key, lb in digitalocean_loadbalancer.vpn_lb :
    key => {
      ip        = lb.ip
      algorithm = lb.algorithm
    }
  }
}