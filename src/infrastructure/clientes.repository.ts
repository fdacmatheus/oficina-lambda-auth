import { Pool } from 'pg';
import { obterCredenciais } from './segredos';
import { apenasDigitos } from '../domain/cpf';

export interface ClienteEncontrado {
  id: string;
  nome: string;
  documento: string;
  email: string | null;
  ativo: boolean;
}

// O pool vive fora do handler para ser reaproveitado enquanto o container
// estiver quente. Em ambiente Lambda uma unica conexao e suficiente e evita
// esgotar o limite de conexoes do RDS sob concorrencia alta.
let pool: Pool | undefined;

async function obterPool(): Promise<Pool> {
  if (pool) return pool;

  const credenciais = await obterCredenciais();

  pool = new Pool({
    host: credenciais.DB_HOST,
    port: Number(credenciais.DB_PORT),
    database: credenciais.DB_NAME,
    user: credenciais.DB_USER,
    password: credenciais.DB_PASSWORD,
    max: 1,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl: { rejectUnauthorized: false },
  });

  return pool;
}

/**
 * Consulta a existencia e a situacao do cliente pelo documento.
 *
 * A aplicacao guarda o documento somente com digitos, entao a normalizacao
 * acontece aqui para aceitar tambem o CPF formatado enviado pelo consumidor.
 */
export async function buscarPorDocumento(
  documento: string,
): Promise<ClienteEncontrado | null> {
  const conexao = await obterPool();

  const resultado = await conexao.query<{
    id: string;
    nome: string;
    documento: string;
    email: string | null;
  }>(
    `SELECT id, nome, documento, email
       FROM clientes
      WHERE documento = $1
      LIMIT 1`,
    [apenasDigitos(documento)],
  );

  const linha = resultado.rows[0];
  if (!linha) return null;

  return { ...linha, ativo: true };
}
