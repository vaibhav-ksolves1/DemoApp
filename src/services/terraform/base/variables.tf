variable "aws_region" {
description = "AWS region"
type = string
default = "ap-south-1"
}

# variable "aws_access_key" {
# description = "AWS access key"
# type = string
# sensitive = true
# }

# variable "aws_secret_key" {
# description = "AWS secret key"
# type = string
# sensitive = true
# }

# variable "aws_session_token" {
# description = "AWS session token"
# type = string
# sensitive = true
# }

# variable "subnet_id" {
# description = "SUBNET ID"
# type = string
# default = "subnet-09358ed2c921fa92a"
# }

variable "ec2_instance_type" {
description = "EC2 instance type"
type = string
default = "t3a.large"
}

variable "dfm_ami" {
description = "DFM AMI ID"
type = string
default = "ami-0e48bf3a4f92e663d"
}

variable "ec2_volume_size" {
description = "EC2 root volume size in GB"
type = number
default = 30
}
