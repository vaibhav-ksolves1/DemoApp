#!/bin/bash

# Exit on errors
set -e

# Base directory containing all registration infra folders
BASE_DIR="$HOME/NEW_DEMO_APP/src/infraRegistrations"

# Make sure AWS env variables are set
if [[ -z "$AWS_ACCESS_KEY_ID" || -z "$AWS_SECRET_ACCESS_KEY" || -z "$AWS_SESSION_TOKEN" ]]; then
  echo "Please export AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_SESSION_TOKEN first."
  exit 1
fi

# Loop over all subdirectories (only directories with numeric names)
for dir in "$BASE_DIR"/*/; do
  # Check if folder has main.tf
  if [[ -f "$dir/main.tf" ]]; then
    echo "==============================="
    echo "Destroying Terraform in folder: $dir"
    echo "==============================="

    cd "$dir"

    # Initialize Terraform
    terraform init -input=false

    # Destroy infrastructure using environment variables
    AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID" \
    AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY" \
    AWS_SESSION_TOKEN="$AWS_SESSION_TOKEN" \
    AWS_REGION="${AWS_REGION:-ap-south-1}" \
    terraform destroy -auto-approve
  fi
done

echo "✅ All Terraform infra destroyed!"
