terraform {
  required_version = ">= 1.0"
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
  }
}

provider "docker" {}

# Docker network
resource "docker_network" "local_stack_network" {
  name = "local_stack_network"
}

# PostgreSQL container
resource "docker_container" "postgres" {
  name  = "local_postgres"
  image = "postgres:15"
  restart = "always"

  env = [
    "POSTGRES_USER=postgres",
    "POSTGRES_PASSWORD=secret",
    "POSTGRES_DB=mydb"
  ]

  ports {
    internal = 5432
    external = 5432
  }

  volumes {
    host_path      = "./pgdata"
    container_path = "/var/lib/postgresql/data"
  }

  networks_advanced {
    name = docker_network.local_stack_network.name
  }
}

# NiFi container
resource "docker_container" "nifi" {
  name  = "local_nifi"
  image = "apache/nifi:1.28.1"
  restart = "always"

  ports {
    internal = 8080
    external = 8080
  }

  networks_advanced {
    name = docker_network.local_stack_network.name
  }
}

# Node app container
resource "docker_image" "node_app" {
  name = "node_app:latest"
  build {
    context = "${path.module}/node_app"
  }
}

resource "docker_container" "node_app" {
  name  = "node_app"
  image = docker_image.node_app.latest

  ports {
    internal = 3000
    external = 3000
  }

  env = [
    "DB_HOST=local_postgres",
    "DB_USER=postgres",
    "DB_PASSWORD=secret",
    "DB_NAME=mydb"
  ]

  networks_advanced {
    name = docker_network.local_stack_network.name
  }

  depends_on = [docker_container.postgres]
}
