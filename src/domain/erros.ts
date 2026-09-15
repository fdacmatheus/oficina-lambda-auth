export class CpfInvalidoError extends Error {
  readonly codigo = 'CPF_INVALIDO';

  constructor() {
    super('CPF invalido');
    this.name = 'CpfInvalidoError';
  }
}

export class ClienteNaoEncontradoError extends Error {
  readonly codigo = 'CLIENTE_NAO_ENCONTRADO';

  constructor() {
    super('Cliente nao encontrado na base');
    this.name = 'ClienteNaoEncontradoError';
  }
}

export class TokenInvalidoError extends Error {
  readonly codigo = 'TOKEN_INVALIDO';

  constructor(motivo: string) {
    super(motivo);
    this.name = 'TokenInvalidoError';
  }
}
