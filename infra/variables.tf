variable "region" {
  description = "Regiao AWS. O AWS Academy Learner Lab so libera us-east-1."
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Prefixo aplicado ao nome dos recursos."
  type        = string
  default     = "oficina"
}

variable "lab_role_name" {
  description = "Role de execucao pre-criada pelo Learner Lab. O ambiente nao concede iam:CreateRole."
  type        = string
  default     = "LabRole"
}

variable "runtime" {
  description = "Runtime das funcoes."
  type        = string
  default     = "nodejs20.x"
}

variable "log_retention_days" {
  description = "Retencao dos logs no CloudWatch."
  type        = number
  default     = 7
}

variable "token_memory_mb" {
  description = "Memoria da funcao de emissao de token. Ela abre conexao com o RDS."
  type        = number
  default     = 512
}

variable "authorizer_memory_mb" {
  description = "Memoria do authorizer. Ele so verifica assinatura, entao o minimo basta."
  type        = number
  default     = 256
}
