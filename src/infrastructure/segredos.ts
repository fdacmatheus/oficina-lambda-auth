import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

export interface CredenciaisBanco {
  DB_HOST: string;
  DB_PORT: string;
  DB_NAME: string;
  DB_USER: string;
  DB_PASSWORD: string;
}

const cliente = new SecretsManagerClient({});

// O segredo e resolvido uma vez por container e reaproveitado entre invocacoes,
// evitando uma chamada ao Secrets Manager a cada requisicao.
let cache: CredenciaisBanco | undefined;

export async function obterCredenciais(): Promise<CredenciaisBanco> {
  if (cache) return cache;

  const secretId = process.env.DB_SECRET_ARN;
  if (!secretId) {
    throw new Error('DB_SECRET_ARN nao configurado');
  }

  const resposta = await cliente.send(
    new GetSecretValueCommand({ SecretId: secretId }),
  );

  if (!resposta.SecretString) {
    throw new Error('Secret sem conteudo');
  }

  cache = JSON.parse(resposta.SecretString) as CredenciaisBanco;
  return cache;
}

export async function obterSegredoJwt(): Promise<string> {
  const direto = process.env.JWT_SECRET;
  if (direto) return direto;

  const secretId = process.env.JWT_SECRET_ARN;
  if (!secretId) {
    throw new Error('JWT_SECRET ou JWT_SECRET_ARN precisa estar configurado');
  }

  const resposta = await cliente.send(
    new GetSecretValueCommand({ SecretId: secretId }),
  );

  if (!resposta.SecretString) {
    throw new Error('Secret do JWT sem conteudo');
  }

  const conteudo = JSON.parse(resposta.SecretString) as { JWT_SECRET: string };
  return conteudo.JWT_SECRET;
}
