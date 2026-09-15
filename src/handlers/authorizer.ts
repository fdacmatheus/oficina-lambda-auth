import type {
  APIGatewayRequestAuthorizerEventV2,
  APIGatewaySimpleAuthorizerWithContextResult,
} from 'aws-lambda';
import jwt from 'jsonwebtoken';
import { TokenInvalidoError } from '../domain/erros';
import { obterSegredoJwt } from '../infrastructure/segredos';
import { log } from '../infrastructure/log';

interface ContextoAutorizacao extends Record<string, string | number | boolean> {
  clienteId: string;
  username: string;
}

interface PayloadToken {
  sub: string;
  username: string;
  nome?: string;
  tipo?: string;
}

function extrairToken(cabecalho: string | undefined): string {
  if (!cabecalho) {
    throw new TokenInvalidoError('Cabecalho Authorization ausente');
  }

  const [esquema, valor] = cabecalho.split(' ');

  if (esquema?.toLowerCase() !== 'bearer' || !valor) {
    throw new TokenInvalidoError('Formato esperado: Bearer <token>');
  }

  return valor;
}

/**
 * Authorizer do API Gateway para as rotas sensiveis.
 *
 * Usa resposta simples (`enable_simple_responses`), em que basta devolver
 * `isAuthorized`. O contexto anexado chega a aplicacao nos headers da
 * integracao, dispensando uma segunda decodificacao do token no NestJS.
 */
export async function handler(
  evento: APIGatewayRequestAuthorizerEventV2,
): Promise<APIGatewaySimpleAuthorizerWithContextResult<ContextoAutorizacao>> {
  const requestId = evento.requestContext?.requestId ?? 'sem-request-id';

  const negar = (): APIGatewaySimpleAuthorizerWithContextResult<ContextoAutorizacao> => ({
    isAuthorized: false,
    context: { clienteId: '', username: '' },
  });

  try {
    const cabecalho =
      evento.headers?.authorization ?? evento.headers?.Authorization;

    const token = extrairToken(cabecalho);
    const segredo = await obterSegredoJwt();

    const payload = jwt.verify(token, segredo) as PayloadToken;

    if (!payload.sub) {
      throw new TokenInvalidoError('Token sem identificador de usuario');
    }

    log.info('acesso autorizado', {
      requestId,
      clienteId: payload.sub,
      rota: evento.routeKey,
    });

    return {
      isAuthorized: true,
      context: {
        clienteId: payload.sub,
        username: payload.username ?? '',
      },
    };
  } catch (erro) {
    const motivo =
      erro instanceof jwt.TokenExpiredError
        ? 'token expirado'
        : erro instanceof jwt.JsonWebTokenError
          ? 'assinatura invalida'
          : erro instanceof TokenInvalidoError
            ? erro.message
            : 'falha inesperada';

    log.warn('acesso negado', { requestId, rota: evento.routeKey, motivo });

    return negar();
  }
}
