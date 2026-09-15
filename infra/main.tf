# ---------------------------------------------------------------------------
# Dependencias
# A Lambda precisa alcancar o RDS, que vive dentro da VPC e nao tem IP publico.
# Por isso ela e anexada as mesmas subnets do cluster, e o security group do
# banco e liberado especificamente para ela.
# ---------------------------------------------------------------------------
data "aws_iam_role" "lab" {
  name = var.lab_role_name
}

data "terraform_remote_state" "database" {
  backend = "s3"

  config = {
    bucket = "oficina-tfstate-679445922616"
    key    = "database/terraform.tfstate"
    region = "us-east-1"
  }
}

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

data "aws_subnet" "selected" {
  for_each = toset(data.aws_subnets.default.ids)
  id       = each.value
}

locals {
  subnet_ids = [
    for s in data.aws_subnet.selected : s.id
    if s.availability_zone != "us-east-1e"
  ]
}

# ---------------------------------------------------------------------------
# Rede das funcoes
# ---------------------------------------------------------------------------
resource "aws_security_group" "lambda" {
  name        = "${var.project}-lambda-auth-sg"
  description = "Funcoes de autenticacao da oficina"
  vpc_id      = data.aws_vpc.default.id

  tags = {
    Name = "${var.project}-lambda-auth-sg"
  }
}

resource "aws_vpc_security_group_egress_rule" "lambda" {
  security_group_id = aws_security_group.lambda.id
  description       = "Saida para o RDS e para o Secrets Manager"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

resource "aws_vpc_security_group_ingress_rule" "db_from_lambda" {
  security_group_id            = data.terraform_remote_state.database.outputs.db_security_group_id
  description                  = "PostgreSQL a partir das funcoes de autenticacao"
  referenced_security_group_id = aws_security_group.lambda.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
}

# ---------------------------------------------------------------------------
# Segredo de assinatura do JWT
# Compartilhado com a aplicacao principal: o token emitido aqui precisa ser
# aceito pelos guards do NestJS no cluster.
# ---------------------------------------------------------------------------
resource "random_password" "jwt" {
  length  = 64
  special = false
}

resource "aws_secretsmanager_secret" "jwt" {
  name                    = "${var.project}/auth/jwt"
  description             = "Segredo HS256 compartilhado entre a Lambda de autenticacao e a Oficina API"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "jwt" {
  secret_id = aws_secretsmanager_secret.jwt.id

  secret_string = jsonencode({
    JWT_SECRET = random_password.jwt.result
  })
}

# ---------------------------------------------------------------------------
# Funcoes
# Os artefatos sao gerados por `pnpm package` e ficam em ../build.
# ---------------------------------------------------------------------------
resource "aws_cloudwatch_log_group" "token" {
  name              = "/aws/lambda/${var.project}-auth-token"
  retention_in_days = var.log_retention_days
}

resource "aws_lambda_function" "token" {
  function_name = "${var.project}-auth-token"
  description   = "Valida o CPF, confirma o cliente na base e emite um JWT"
  role          = data.aws_iam_role.lab.arn

  filename         = "${path.module}/../build/token.zip"
  source_code_hash = filebase64sha256("${path.module}/../build/token.zip")

  handler = "index.handler"
  runtime = var.runtime

  memory_size = var.token_memory_mb
  timeout     = 20

  vpc_config {
    subnet_ids         = local.subnet_ids
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      DB_SECRET_ARN  = data.terraform_remote_state.database.outputs.db_secret_arn
      JWT_SECRET_ARN = aws_secretsmanager_secret.jwt.arn
      NODE_OPTIONS   = "--enable-source-maps"
    }
  }

  depends_on = [aws_cloudwatch_log_group.token]
}

resource "aws_cloudwatch_log_group" "authorizer" {
  name              = "/aws/lambda/${var.project}-auth-authorizer"
  retention_in_days = var.log_retention_days
}

# O authorizer nao toca no banco, entao fica fora da VPC: isso elimina a ENI e
# reduz o cold start da funcao que e invocada em toda requisicao protegida.
resource "aws_lambda_function" "authorizer" {
  function_name = "${var.project}-auth-authorizer"
  description   = "Valida o JWT das rotas protegidas do API Gateway"
  role          = data.aws_iam_role.lab.arn

  filename         = "${path.module}/../build/authorizer.zip"
  source_code_hash = filebase64sha256("${path.module}/../build/authorizer.zip")

  handler = "index.handler"
  runtime = var.runtime

  memory_size = var.authorizer_memory_mb
  timeout     = 10

  environment {
    variables = {
      JWT_SECRET_ARN = aws_secretsmanager_secret.jwt.arn
    }
  }

  depends_on = [aws_cloudwatch_log_group.authorizer]
}
