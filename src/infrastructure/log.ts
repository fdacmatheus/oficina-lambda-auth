type Nivel = 'info' | 'warn' | 'error';

/**
 * Log estruturado em JSON, exigido pelo requisito de observabilidade.
 *
 * O campo `requestId` recebido do API Gateway e propagado em toda linha, o que
 * permite correlacionar a autenticacao serverless com os logs da aplicacao no
 * cluster a partir de um unico identificador.
 */
function emitir(nivel: Nivel, mensagem: string, contexto: Record<string, unknown> = {}): void {
  const linha = JSON.stringify({
    timestamp: new Date().toISOString(),
    nivel,
    servico: 'oficina-lambda-auth',
    mensagem,
    ...contexto,
  });

  if (nivel === 'error') {
    console.error(linha);
    return;
  }

  console.log(linha);
}

export const log = {
  info: (mensagem: string, contexto?: Record<string, unknown>) => emitir('info', mensagem, contexto),
  warn: (mensagem: string, contexto?: Record<string, unknown>) => emitir('warn', mensagem, contexto),
  error: (mensagem: string, contexto?: Record<string, unknown>) => emitir('error', mensagem, contexto),
};
