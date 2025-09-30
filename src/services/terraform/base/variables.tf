variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-south-1"
}

# variable "aws_access_key" {
#   description = "AWS access key"
#   type        = string
#   sensitive   = true
# }

# variable "aws_secret_key" {
#   description = "AWS secret key"
#   type        = string
#   sensitive   = true
# }

# variable "aws_session_token" {
#   description = "AWS session token"
#   type        = string
#   sensitive   = true
# }

# variable "subnet_id" {
#   description = "SUBNET ID"
#   type        = string
#   default     = "subnet-09358ed2c921fa92a"
# }

variable "ec2_instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3a.large"
}

variable "dfm_ami" {
  description = "DFM AMI ID"
  type        = string
  default     = "ami-06537fb8ad5cf5a00"
}

variable "ec2_volume_size" {
  description = "EC2 root volume size in GB"
  type        = number
  default     = 30
}

variable "route53_zone_id" {
  description = "The Route53 hosted zone ID where the record will be created"
  type        = string
  default     = "Z00833442EFNLTOTSQCPI"
}

variable "route53_zone_name" {
  description = "The Route53 hosted Zone Name where the record will be created"
  type        = string
  default     = "cloud.dfmanager.com"
}

variable "user_domain" {
  description = "The domain name (e.g., example.com) associated with the hosted zone"
  type        = string
  default     = "demo"
}

variable "nifi_user" {
  description = "The user name for the NiFi admin user"
  type        = string
  default     = "admin"
}

variable "nifi_pass" {
  description = "The password for the NiFi admin user"
  type        = string
  default     = "adminpass1234"
}


