import jwt from 'jsonwebtoken';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

const SEGREDO = 'segredo-de-teste';
process.env.JWT_SECRET = SEGREDO;

jest.mock('../src/infrastructure/clientes.repository', () => ({
  buscarPorDocumento: jest.fn(),
}));

import { buscarPorDocumento } from '../src/infrastructure/clientes.repository';
import { handler } from '../src/handlers/token';

const buscarMock = buscarPorDocumento as jest.MockedFunction<typeof buscarPorDocumento>;

function evento(corpo: unknown): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'POST /auth',
    rawPath: '/auth',
    body: JSON.stringify(corpo),
    requestContext: { requestId: 'req-teste' },
  } as unknown as APIGatewayProxyEventV2;
}

function corpoDa(resultado: unknown): Record<string, unknown> {
  return JSON.parse((resultado as { body: string }).body);
}

describe('emissao de token por CPF', () => {
  beforeEach(() => jest.clearAllMocks());

  it('emite um JWT valido quando o CPF existe na base', async () => {
    buscarMock.mockResolvedValue({
      id: 'cliente-1',
      nome: 'Maria Souza',
      documento: '52998224725',
      email: 'maria@exemplo.com',
      ativo: true,
    });

    const resultado = await handler(evento({ cpf: '529.982.247-25' }));

    expect((resultado as { statusCode: number }).statusCode).toBe(200);

    const corpo = corpoDa(resultado);
    expect(corpo.expiresIn).toBe(900);
    expect(corpo.cliente).toEqual({ id: 'cliente-1', nome: 'Maria Souza' });

    const payload = jwt.verify(corpo.accessToken as string, SEGREDO) as jwt.JwtPayload;
    expect(payload.sub).toBe('cliente-1');
    expect(payload.username).toBe('52998224725');
    expect(payload.tipo).toBe('cliente');
  });

  it('consulta a base usando apenas os digitos do documento', async () => {
    buscarMock.mockResolvedValue({
      id: 'cliente-1',
      nome: 'Maria Souza',
      documento: '52998224725',
      email: null,
      ativo: true,
    });

    await handler(evento({ cpf: '529.982.247-25' }));

    expect(buscarMock).toHaveBeenCalledWith('529.982.247-25');
  });

  it('responde 400 quando o CPF e invalido', async () => {
    const resultado = await handler(evento({ cpf: '111.111.111-11' }));

    expect((resultado as { statusCode: number }).statusCode).toBe(400);
    expect(corpoDa(resultado).erro).toBe('CPF_INVALIDO');
    expect(buscarMock).not.toHaveBeenCalled();
  });

  it('responde 400 quando o CPF nao foi informado', async () => {
    const resultado = await handler(evento({}));

    expect((resultado as { statusCode: number }).statusCode).toBe(400);
    expect(corpoDa(resultado).erro).toBe('CPF_INVALIDO');
  });

  it('responde 404 quando o cliente nao existe na base', async () => {
    buscarMock.mockResolvedValue(null);

    const resultado = await handler(evento({ cpf: '529.982.247-25' }));

    expect((resultado as { statusCode: number }).statusCode).toBe(404);
    expect(corpoDa(resultado).erro).toBe('CLIENTE_NAO_ENCONTRADO');
  });

  it('responde 500 quando a consulta ao banco falha', async () => {
    buscarMock.mockRejectedValue(new Error('conexao recusada'));

    const resultado = await handler(evento({ cpf: '529.982.247-25' }));

    expect((resultado as { statusCode: number }).statusCode).toBe(500);
    expect(corpoDa(resultado).erro).toBe('ERRO_INTERNO');
  });

  it('propaga o requestId no cabecalho de correlacao', async () => {
    buscarMock.mockResolvedValue(null);

    const resultado = await handler(evento({ cpf: '529.982.247-25' }));
    const headers = (resultado as { headers: Record<string, string> }).headers;

    expect(headers['x-correlation-id']).toBe('req-teste');
  });
});
