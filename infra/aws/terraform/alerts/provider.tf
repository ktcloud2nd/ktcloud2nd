terraform {
  required_version = ">= 1.6.0"

  backend "s3" {
    bucket  = "palja-terraform-backend"
    key     = "aws/alerts/terraform.tfstate"
    region  = "ap-northeast-2"
    encrypt = true
  }

  required_providers {
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.5"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}
