terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region     = var.aws_region
  access_key = var.aws_access_key
  secret_key = var.aws_secret_key
  token      = var.aws_session_token
}

# Data source for availability zones
data "aws_availability_zones" "available" {
  state = "available"
}

# Key Pair
resource "aws_key_pair" "ujjwal-dfm-private" {
  key_name   = "vaibhav-dfm-${var.registration_id}"
  public_key = file("~/.ssh/id_rsa.pub")
}

variable "registration_id" {
  type = string
}

# EC2 Instance
resource "aws_instance" "dfm_server" {
  ami                    = var.dfm_ami
  instance_type          = var.ec2_instance_type
  key_name               = aws_key_pair.ujjwal-dfm-private.key_name
  subnet_id              = var.subnet_id
  vpc_security_group_ids = ["sg-0070f08fab28cbfed"]

  user_data = templatefile("${path.module}/user_data.sh", {
    user_domain = var.user_domain,
    nifi_user   = var.nifi_user,
  nifi_pass = var.nifi_pass })

  root_block_device {
    volume_type = "gp3"
    volume_size = var.ec2_volume_size
    encrypted   = true
  }

  tags = {
    Name = "dfm-ami-test"
  }
}

# Tail user_data log until setup completes
resource "null_resource" "wait_for_setup" {
  depends_on = [aws_instance.dfm_server]

  provisioner "local-exec" {
    command = <<-EOT
      set -e
      SSH="ssh -i ~/.ssh/id_rsa -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=5 -o ServerAliveInterval=10 -o ServerAliveCountMax=3 ${var.ssh_user}@${aws_instance.dfm_server.public_ip}"

      echo "Waiting for SSH and /var/log/user_data.log on ${aws_instance.dfm_server.public_ip}..."
      until $SSH 'test -f /var/log/user_data.log' >/dev/null 2>&1; do
        echo "$(date -Is) waiting..."
        sleep 5
      done

      echo "Log detected. Streaming until 'Setup complete'..."
      $SSH "stdbuf -oL -eL awk '{ print; fflush(); } /Setup complete/ { exit 0 }' /var/log/user_data.log"
    EOT
  }
}

# Route 53 record for the EC2 instance
resource "aws_route53_record" "dfm_dns" {
  zone_id = var.route53_zone_id      # e.g., "Z123456ABCDEFG"
  name    = "${var.user_domain}-dfm" # e.g., dfm.example.com
  type    = "A"
  ttl     = 300
  records = [aws_instance.dfm_server.public_ip]
}

resource "aws_route53_record" "nifi_0_dns" {
  zone_id = var.route53_zone_id         # e.g., "Z123456ABCDEFG"
  name    = "${var.user_domain}-nifi-0" # e.g., dfm.example.com
  type    = "A"
  ttl     = 300
  records = [aws_instance.dfm_server.public_ip]
}

resource "aws_route53_record" "nifi_1_dns" {
  zone_id = var.route53_zone_id         # e.g., "Z123456ABCDEFG"
  name    = "${var.user_domain}-nifi-1" # e.g., dfm.example.com
  type    = "A"
  ttl     = 300
  records = [aws_instance.dfm_server.public_ip]
}

resource "aws_route53_record" "nifi_registry_dns" {
  zone_id = var.route53_zone_id                # e.g., "Z123456ABCDEFG"
  name    = "${var.user_domain}-nifi-registry" # e.g., dfm.example.com
  type    = "A"
  ttl     = 300
  records = [aws_instance.dfm_server.public_ip]
}

output "dfm_url" {
  value       = "https://${aws_route53_record.dfm_dns.fqdn}:8443"
  description = "URL to access DFM application"
}

# URLs including ports for NiFi nodes
output "nifi_0_url" {
  value       = format("https://%s:9443", aws_route53_record.nifi_0_dns.fqdn)
  description = "URL to access NiFi-0"
}

output "nifi_1_url" {
  value       = format("https://%s:9445", aws_route53_record.nifi_1_dns.fqdn)
  description = "URL to access NiFi-1"
}

output "nifi_registry_url" {
  value       = "https://${aws_route53_record.nifi_registry_dns.fqdn}:18443"
  description = "URL to access NiFi Registry"
}

output "server_public_ip" {
  value       = aws_instance.dfm_server.public_ip
  description = "Public IP of the server"
}
