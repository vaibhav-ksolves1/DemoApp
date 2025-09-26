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
resource "aws_key_pair" "vaibhav-dfm-private" {
  key_name   = "vaibhav-dfm-ami-test"
  public_key = file("~/.ssh/id_rsa.pub")
}

# EC2 Instance
resource "aws_instance" "dfm_server" {
  ami                    = var.dfm_ami
  instance_type          = var.ec2_instance_type
  key_name              = aws_key_pair.vaibhav-dfm-private.key_name
  subnet_id              = var.subnet_id
  vpc_security_group_ids = ["sg-0070f08fab28cbfed"]
  user_data             = templatefile("./user_data.sh", {})

  root_block_device {
    volume_type = "gp3"
    volume_size = var.ec2_volume_size
    encrypted   = true
  }

  tags = {
    Name = "dfm-ami-test"
  }
}

# Output the public IP
output "dfm_public_ip" {
  value = aws_instance.dfm_server.public_ip
  description = "Public IP address of the DFM server"
}

output "dfm_url" {
  value = "http://${aws_instance.dfm_server.public_ip}:8443"
  description = "URL to access DFM application"
}
