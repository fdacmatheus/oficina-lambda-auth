output "token_function_arn" {
  description = "ARN da funcao de emissao de token. Informar em lambda_token_arn no repositorio oficina-infra-k8s."
  value       = aws_lambda_function.token.arn
}

output "token_invoke_arn" {
  description = "ARN de invocacao usado pela integracao AWS_PROXY do API Gateway."
  value       = aws_lambda_function.token.invoke_arn
}

output "authorizer_function_arn" {
  description = "ARN do authorizer. Informar em lambda_authorizer_arn no repositorio oficina-infra-k8s."
  value       = aws_lambda_function.authorizer.arn
}

output "authorizer_invoke_arn" {
  description = "ARN de invocacao do authorizer."
  value       = aws_lambda_function.authorizer.invoke_arn
}

output "jwt_secret_arn" {
  description = "ARN do segredo de assinatura, consumido tambem pela aplicacao no cluster."
  value       = aws_secretsmanager_secret.jwt.arn
}

output "jwt_secret_name" {
  description = "Nome do segredo no Secrets Manager."
  value       = aws_secretsmanager_secret.jwt.name
}
