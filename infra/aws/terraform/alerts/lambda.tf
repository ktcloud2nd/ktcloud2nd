locals {
  lambda_name      = "${var.name_prefix}-slack-anomaly-notifier"
  lambda_source_dir = "${path.module}/../../lambda/slack-anomaly-notifier"
}

data "terraform_remote_state" "network" {
  backend = "s3"

  config = {
    bucket     = var.network_state_bucket
    key        = var.network_state_key
    region     = var.network_state_region
    access_key = var.network_state_access_key
    secret_key = var.network_state_secret_key
  }
}

data "terraform_remote_state" "data" {
  backend = "s3"

  config = {
    bucket     = var.data_state_bucket
    key        = var.data_state_key
    region     = var.data_state_region
    access_key = var.data_state_access_key
    secret_key = var.data_state_secret_key
  }
}

data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = local.lambda_source_dir
  output_path = "${path.module}/.terraform-build/${local.lambda_name}.zip"
}

data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_security_group" "lambda" {
  name        = "${local.lambda_name}-sg"
  description = "Security group for the Slack anomaly notifier Lambda."
  vpc_id      = data.terraform_remote_state.network.outputs.vpc_id

  egress {
    from_port   = 53
    to_port     = 53
    protocol    = "udp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow DNS UDP egress for name resolution."
  }

  egress {
    from_port   = 53
    to_port     = 53
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow DNS TCP egress for name resolution fallback."
  }

  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow HTTPS egress for Slack webhook delivery."
  }

  egress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow PostgreSQL egress to the RDS endpoint."
  }

  tags = merge(var.tags, {
    Name = "${local.lambda_name}-sg"
  })
}

resource "aws_security_group_rule" "lambda_to_db" {
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.lambda.id
  security_group_id        = data.terraform_remote_state.network.outputs.db_sg_id
  description              = "Allow the notifier Lambda to connect to PostgreSQL."
}

resource "aws_iam_role" "lambda" {
  name               = "${local.lambda_name}-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json

  tags = merge(var.tags, {
    Name = "${local.lambda_name}-role"
  })
}

resource "aws_iam_role_policy_attachment" "basic_execution" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "vpc_access" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${local.lambda_name}"
  retention_in_days = var.log_retention_in_days

  tags = merge(var.tags, {
    Name = "${local.lambda_name}-logs"
  })
}

resource "aws_lambda_function" "notifier" {
  function_name = local.lambda_name
  role          = aws_iam_role.lambda.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  filename      = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  timeout       = var.lambda_timeout_seconds
  memory_size   = var.lambda_memory_size
  reserved_concurrent_executions = 1

  vpc_config {
    subnet_ids         = data.terraform_remote_state.network.outputs.private_app_subnet_ids
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      DB_HOST                     = data.terraform_remote_state.data.outputs.db_endpoint
      DB_PORT                     = tostring(data.terraform_remote_state.data.outputs.db_port)
      DB_NAME                     = data.terraform_remote_state.data.outputs.db_name
      DB_USER                     = data.terraform_remote_state.data.outputs.db_username
      DB_PASSWORD                 = var.db_password
      DB_SSL                      = tostring(var.db_ssl_enabled)
      DB_SSL_REJECT_UNAUTHORIZED  = tostring(var.db_ssl_reject_unauthorized)
      SLACK_WEBHOOK_URL           = var.slack_webhook_url
      CONSUMER_NAME               = var.consumer_name
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.lambda,
    aws_iam_role_policy_attachment.basic_execution,
    aws_iam_role_policy_attachment.vpc_access
  ]

  tags = merge(var.tags, {
    Name = local.lambda_name
  })
}

resource "aws_cloudwatch_event_rule" "schedule" {
  name                = "${local.lambda_name}-schedule"
  description         = "Periodic trigger for the Slack anomaly notifier Lambda."
  schedule_expression = var.schedule_expression

  tags = merge(var.tags, {
    Name = "${local.lambda_name}-schedule"
  })
}

resource "aws_cloudwatch_event_target" "lambda" {
  rule      = aws_cloudwatch_event_rule.schedule.name
  target_id = "slack-anomaly-notifier"
  arn       = aws_lambda_function.notifier.arn
}

resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.notifier.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.schedule.arn
}
