const enviar = jest.fn();

jest.mock('@aws-sdk/client-secrets-manager', () => ({
  SecretsManagerClient: jest.fn(() => ({ send: enviar })),
  GetSecretValueCommand: jest.fn((input: unknown) => ({ input })),
}));

describe('acesso ao Secrets Manager', () => {
  beforeEach(() => {
    jest.resetModules();
    enviar.mockReset();
    delete process.env.JWT_SECRET;
    delete process.env.JWT_SECRET_ARN;
    delete process.env.DB_SECRET_ARN;
  });

  describe('credenciais do banco', () => {
    it('resolve o segredo e devolve as credenciais', async () => {
      process.env.DB_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:1:secret:db';
      enviar.mockResolvedValue({
        SecretString: JSON.stringify({
          DB_HOST: 'rds.exemplo',
          DB_PORT: '5432',
          DB_NAME: 'oficina',
          DB_USER: 'oficina',
          DB_PASSWORD: 'senha',
        }),
      });

      const { obterCredenciais } = await import('../src/infrastructure/segredos');
      const c = await obterCredenciais();

      expect(c.DB_HOST).toBe('rds.exemplo');
      expect(c.DB_PORT).toBe('5432');
    });

    it('reaproveita o valor entre invocacoes do mesmo container', async () => {
      process.env.DB_SECRET_ARN = 'arn:db';
      enviar.mockResolvedValue({ SecretString: JSON.stringify({ DB_HOST: 'rds' }) });

      const { obterCredenciais } = await import('../src/infrastructure/segredos');
      await obterCredenciais();
      await obterCredenciais();

      // Uma unica chamada ao Secrets Manager, mesmo com duas invocacoes.
      expect(enviar).toHaveBeenCalledTimes(1);
    });

    it('falha quando DB_SECRET_ARN nao esta configurado', async () => {
      const { obterCredenciais } = await import('../src/infrastructure/segredos');
      await expect(obterCredenciais()).rejects.toThrow('DB_SECRET_ARN nao configurado');
    });

    it('falha quando o segredo volta vazio', async () => {
      process.env.DB_SECRET_ARN = 'arn:db';
      enviar.mockResolvedValue({});

      const { obterCredenciais } = await import('../src/infrastructure/segredos');
      await expect(obterCredenciais()).rejects.toThrow('Secret sem conteudo');
    });
  });

  describe('segredo de assinatura do JWT', () => {
    it('prefere a variavel de ambiente, sem chamar o Secrets Manager', async () => {
      process.env.JWT_SECRET = 'segredo-direto';

      const { obterSegredoJwt } = await import('../src/infrastructure/segredos');

      await expect(obterSegredoJwt()).resolves.toBe('segredo-direto');
      expect(enviar).not.toHaveBeenCalled();
    });

    it('busca no Secrets Manager quando so o ARN esta configurado', async () => {
      process.env.JWT_SECRET_ARN = 'arn:jwt';
      enviar.mockResolvedValue({ SecretString: JSON.stringify({ JWT_SECRET: 'do-secrets-manager' }) });

      const { obterSegredoJwt } = await import('../src/infrastructure/segredos');

      await expect(obterSegredoJwt()).resolves.toBe('do-secrets-manager');
    });

    it('falha quando nem a variavel nem o ARN estao configurados', async () => {
      const { obterSegredoJwt } = await import('../src/infrastructure/segredos');
      await expect(obterSegredoJwt()).rejects.toThrow(
        'JWT_SECRET ou JWT_SECRET_ARN precisa estar configurado',
      );
    });

    it('falha quando o segredo do JWT volta vazio', async () => {
      process.env.JWT_SECRET_ARN = 'arn:jwt';
      enviar.mockResolvedValue({});

      const { obterSegredoJwt } = await import('../src/infrastructure/segredos');
      await expect(obterSegredoJwt()).rejects.toThrow('Secret do JWT sem conteudo');
    });
  });
});
