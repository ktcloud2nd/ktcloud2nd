variable "aws_region" {
  description = "AWS region for alerts resources."
  type        = string
  default     = "ap-northeast-2"
}

variable "name_prefix" {
  description = "Prefix used for alerts resource names."
  type        = string
  default     = "ktcloud2nd"
}

variable "network_state_bucket" {
  description = "S3 bucket that stores the network terraform state file."
  type        = string
  default     = "palja-terraform-backend"
}

variable "network_state_key" {
  description = "S3 object key for the network terraform state file."
  type        = string
  default     = "aws/network/terraform.tfstate"
}

variable "network_state_region" {
  description = "AWS region of the S3 bucket that stores the network terraform state file."
  type        = string
  default     = "ap-northeast-2"
}

variable "network_state_access_key" {
  description = "Access key used to read the network terraform state from the tfstate S3 account."
  type        = string
  sensitive   = true
}

variable "network_state_secret_key" {
  description = "Secret key used to read the network terraform state from the tfstate S3 account."
  type        = string
  sensitive   = true
}

variable "data_state_bucket" {
  description = "S3 bucket that stores the data terraform state file."
  type        = string
  default     = "palja-terraform-backend"
}

variable "data_state_key" {
  description = "S3 object key for the data terraform state file."
  type        = string
  default     = "aws/data/terraform.tfstate"
}

variable "data_state_region" {
  description = "AWS region of the S3 bucket that stores the data terraform state file."
  type        = string
  default     = "ap-northeast-2"
}

variable "data_state_access_key" {
  description = "Access key used to read the data terraform state."
  type        = string
  sensitive   = true
}

variable "data_state_secret_key" {
  description = "Secret key used to read the data terraform state."
  type        = string
  sensitive   = true
}

variable "db_password" {
  description = "Master password for the PostgreSQL instance."
  type        = string
  sensitive   = true
}

variable "slack_webhook_url" {
  description = "Slack incoming webhook URL used for anomaly notifications."
  type        = string
  sensitive   = true
}

variable "consumer_name" {
  description = "Checkpoint consumer name stored in alert_delivery_state."
  type        = string
  default     = "slack_anomaly_notifier"
}

variable "schedule_expression" {
  description = "EventBridge schedule expression for the notifier Lambda."
  type        = string
  default     = "rate(1 minute)"
}

variable "lambda_timeout_seconds" {
  description = "Lambda timeout in seconds."
  type        = number
  default     = 60
}

variable "lambda_memory_size" {
  description = "Lambda memory size in MB."
  type        = number
  default     = 256
}

variable "log_retention_in_days" {
  description = "CloudWatch log retention in days."
  type        = number
  default     = 14
}

variable "db_ssl_enabled" {
  description = "Whether the notifier Lambda should use SSL when connecting to PostgreSQL."
  type        = bool
  default     = true
}

variable "db_ssl_reject_unauthorized" {
  description = "Whether the notifier Lambda should reject unauthorized PostgreSQL certificates."
  type        = bool
  default     = false
}

variable "tags" {
  description = "Additional tags applied to all alerts resources."
  type        = map(string)
  default = {
    Environment = "dev"
    Owner       = "infra3"
    Service     = "alerts"
  }
}
