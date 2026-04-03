output "lambda_function_name" {
  description = "Slack anomaly notifier Lambda function name."
  value       = aws_lambda_function.notifier.function_name
}

output "lambda_function_arn" {
  description = "Slack anomaly notifier Lambda function ARN."
  value       = aws_lambda_function.notifier.arn
}

output "lambda_security_group_id" {
  description = "Security group attached to the notifier Lambda."
  value       = aws_security_group.lambda.id
}

output "event_rule_name" {
  description = "EventBridge rule that triggers the notifier Lambda."
  value       = aws_cloudwatch_event_rule.schedule.name
}
