import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import jwt from 'jsonwebtoken';
import { isCpfValido, apenasDigitos, mascararCpf } from '../domain/cpf';
import { CpfInvalidoError, ClienteNaoEncontradoError } from '../domain/erros';
import { buscarPorDocumento } from '../infrastructure/clientes.repository';
import { obterSegredoJwt } from '../infrastructure/segredos';
import { log } from '../infrastructure/log';

interface CorpoRequisicao {
  cpf?: string;
}

interface Resposta {
  accessToken: string;
  expiresIn: number;
  cliente: {
    id: string;
    nome: string;
  };
}

const EXPIRACAO_SEGUNDOS = 15 * 60;

function responder(
  status: number,
  corpo: unknown,
  requestId: string,
): APIGatewayProxyResultV2 {
  return {
    statusCode: status,
    headers: {
      'content-type': 'application/json',
      'x-correlation-id': requestId,
    },
    body: JSON.stringify(corpo),
  };
}

/**
 * Emite um JWT a partir do CPF do cliente.
 *
 * Fluxo: valida o CPF, confirma que o cliente existe na base e devolve um token
 * assinado com o mesmo segredo usado pela aplicacao principal, de modo que o
 * token emitido aqui e aceito tanto pelo authorizer do API Gateway quanto pelos
 * guards do NestJS.
 */
export async function handler(
  evento: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  const requestId = evento.requestContext?.requestId ?? 'sem-request-id';
  const inicio = Date.now();

  try {
    const corpo = JSON.parse(evento.body ?? '{}') as CorpoRequisicao;
    const cpf = corpo.cpf?.trim();

    if (!cpf || !isCpfValido(cpf)) {
      throw new CpfInvalidoError();
    }

    log.info('autenticacao solicitada', {
      requestId,
      cpf: mascararCpf(cpf),
    });

    const cliente = await buscarPorDocumento(cpf);

    if (!cliente) {
      throw new ClienteNaoEncontradoError();
    }

    const segredo = await obterSegredoJwt();

    // O payload espelha o JwtPayload da aplicacao principal para que o mesmo
    // token atravesse o API Gateway e os guards do NestJS sem traducao.
    const accessToken = jwt.sign(
      {
        sub: cliente.id,
        username: cliente.documento,
        nome: cliente.nome,
        tipo: 'cliente',
      },
      segredo,
      { expiresIn: EXPIRACAO_SEGUNDOS },
    );

    log.info('token emitido', {
      requestId,
      clienteId: cliente.id,
      duracaoMs: Date.now() - inicio,
    });

    const resposta: Resposta = {
      accessToken,
      expiresIn: EXPIRACAO_SEGUNDOS,
      cliente: { id: cliente.id, nome: cliente.nome },
    };

    return responder(200, resposta, requestId);
  } catch (erro) {
    if (erro instanceof CpfInvalidoError) {
      log.warn('cpf invalido', { requestId });
      return responder(400, { erro: erro.codigo, mensagem: erro.message }, requestId);
    }

    if (erro instanceof ClienteNaoEncontradoError) {
      log.warn('cliente nao encontrado', { requestId });
      return responder(404, { erro: erro.codigo, mensagem: erro.message }, requestId);
    }

    log.error('falha ao emitir token', {
      requestId,
      erro: erro instanceof Error ? erro.message : String(erro),
    });

    return responder(
      500,
      { erro: 'ERRO_INTERNO', mensagem: 'Nao foi possivel concluir a autenticacao' },
      requestId,
    );
  }
}
