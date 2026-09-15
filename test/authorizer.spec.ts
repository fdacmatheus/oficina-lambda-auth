import jwt from 'jsonwebtoken';
import type { APIGatewayRequestAuthorizerEventV2 } from 'aws-lambda';

const SEGREDO = 'segredo-de-teste';
process.env.JWT_SECRET = SEGREDO;

import { handler } from '../src/handlers/authorizer';

function evento(authorization?: string): APIGatewayRequestAuthorizerEventV2 {
  return {
    version: '2.0',
    type: 'REQUEST',
    routeArn: 'arn:aws:execute-api:us-east-1:123:abc/$default/GET/api/clientes',
    routeKey: 'GET /api/clientes',
    rawPath: '/api/clientes',
    rawQueryString: '',
    headers: authorization ? { authorization } : {},
    requestContext: { requestId: 'req-teste' },
  } as unknown as APIGatewayRequestAuthorizerEventV2;
}

describe('authorizer do API Gateway', () => {
  it('autoriza um token valido e devolve o contexto do cliente', async () => {
    const token = jwt.sign({ sub: 'cliente-1', username: '52998224725' }, SEGREDO, {
      expiresIn: '15m',
    });

    const resultado = await handler(evento(`Bearer ${token}`));

    expect(resultado.isAuthorized).toBe(true);
    expect(resultado.context.clienteId).toBe('cliente-1');
    expect(resultado.context.username).toBe('52998224725');
  });

  it('nega quando o cabecalho Authorization nao foi enviado', async () => {
    const resultado = await handler(evento());
    expect(resultado.isAuthorized).toBe(false);
  });

  it('nega quando o esquema nao e Bearer', async () => {
    const resultado = await handler(evento('Basic dXNlcjpwYXNz'));
    expect(resultado.isAuthorized).toBe(false);
  });

  it('nega um token assinado com outro segredo', async () => {
    const token = jwt.sign({ sub: 'cliente-1' }, 'segredo-errado');
    const resultado = await handler(evento(`Bearer ${token}`));
    expect(resultado.isAuthorized).toBe(false);
  });

  it('nega um token expirado', async () => {
    const token = jwt.sign({ sub: 'cliente-1' }, SEGREDO, { expiresIn: '-1s' });
    const resultado = await handler(evento(`Bearer ${token}`));
    expect(resultado.isAuthorized).toBe(false);
  });

  it('nega um token sem o campo sub', async () => {
    const token = jwt.sign({ username: 'sem-sub' }, SEGREDO);
    const resultado = await handler(evento(`Bearer ${token}`));
    expect(resultado.isAuthorized).toBe(false);
  });
});
